-- ============================================================
-- NMZ GO — Migratie 007: auth-herstel en foto-opslag
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Twee problemen die aan het licht kwamen toen de app voor het
-- eerst echt in gebruik werd genomen.
--
--   A. Er kon geen beheerder meer ontstaan. Migratie 005 zette de
--      rol bij registratie vast op 'medewerker' — terecht, want die
--      kwam uit client-metadata en was dus te sturen. Maar daarmee
--      verdween ook de enige weg naar een eerste beheerder. Zodra
--      alle beheerders verwijderd waren, zat het systeem op slot:
--      de app staat rolwijziging alleen een beheerder toe, en die
--      was er niet meer.
--
--   B. De opslagbucket voor foto's bestond niet. `useFotos` uploadt
--      naar 'werkbon-fotos', maar storage.buckets was leeg — elke
--      foto-upload zou dus mislukken. Foto-bewijs is de kern van het
--      werkbonproces, dus dit is geen randgeval.
--
-- Voegt toe en vervangt één functie. Raakt geen bestaande data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. EERSTE BEHEERDER VAN EEN TENANT ───────────────────────
-- De regel: is er in de tenant nog geen enkele beheerder, dan wordt
-- de eerste die binnenkomt beheerder. Daarna geldt weer onverkort
-- wat 005 vastlegde — iedereen is medewerker tot een beheerder hem
-- promoveert.
--
-- Dit is bewust een afweging, geen vanzelfsprekendheid. Het betekent
-- dat wie zich als eerste in een lege tenant registreert de sleutels
-- krijgt. Dat is te verdedigen omdat een tenant alleen handmatig
-- wordt aangemaakt: er is geen weg waarlangs een buitenstaander een
-- lege tenant kan laten ontstaan en zich daar vervolgens in kan
-- schrijven. Zonder deze regel is de prijs veel hoger: één keer de
-- verkeerde gebruiker verwijderen en niemand kan er nog bij, ook de
-- eigenaar niet.

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_token  text := new.raw_user_meta_data->>'uitnodiging_token';
  v_tenant uuid;
  v_rol    text := 'medewerker';
begin
  if v_token is not null then
    update public.uitnodigingen
       set gebruikt = true
     where token = v_token
       and not gebruikt
       and (verloopt_op is null or verloopt_op > now())
    returning tenant_id into v_tenant;
  end if;

  v_tenant := coalesce(v_tenant, public.get_mijn_tenant());

  -- Alleen wanneer de tenant nog geen beheerder heeft.
  if not exists (
    select 1 from public.profiles
    where tenant_id = v_tenant and rol = 'beheerder'
  ) then
    v_rol := 'beheerder';
  end if;

  insert into public.profiles (id, naam, rol, tenant_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'naam',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    -- Nog steeds nooit uit de metadata: die is client-gestuurd.
    v_rol,
    v_tenant
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


-- ── B. OPSLAG VOOR WERKBONFOTO'S ─────────────────────────────
-- Bewust een besloten bucket, geen publieke. Dit zijn foto's van
-- de woningen van bewoners — binnenshuis, met hun spullen erop.
-- Een publieke bucket betekent dat iedereen met de URL erbij kan,
-- voor altijd, zonder login. Dat is bij dit soort beeldmateriaal
-- niet te verdedigen.
--
-- De app haalt daarom een tijdelijke, ondertekende URL op in plaats
-- van een permanente publieke link (zie `useFotos.getUrl`).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'werkbon-fotos', 'werkbon-fotos', false,
  15728640,                                          -- 15 MB per foto
  array['image/jpeg','image/png','image/heic','image/heif','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- Het pad is `<werkbon_id>/<taak_id>/<bestandsnaam>`. Wie bij de
-- werkbon mag, mag bij de foto's — dezelfde regel als op de tabel
-- `fotos`, hier één keer vastgelegd zodat beide niet uit elkaar
-- kunnen lopen.
create or replace function public.mag_bij_werkbon(p_werkbon uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.werkbonnen w
    where w.id = p_werkbon
      and w.tenant_id = public.get_mijn_tenant()
      and (
        public.get_mijn_rol() = 'beheerder'
        or exists (
          select 1 from public.werkbon_medewerkers wm
          where wm.werkbon_id = w.id and wm.medewerker_id = auth.uid()
        )
      )
  );
$$;

revoke execute on function public.mag_bij_werkbon(uuid) from public, anon;
grant  execute on function public.mag_bij_werkbon(uuid) to authenticated;


drop policy if exists "werkbon_fotos_select" on storage.objects;
create policy "werkbon_fotos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'werkbon-fotos'
    and public.mag_bij_werkbon(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "werkbon_fotos_insert" on storage.objects;
create policy "werkbon_fotos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'werkbon-fotos'
    and public.mag_bij_werkbon(((storage.foldername(name))[1])::uuid)
  );

-- Verwijderen is beheerderswerk: foto's zijn bewijs, en een monteur
-- hoort zijn eigen bewijs niet te kunnen wissen.
drop policy if exists "werkbon_fotos_delete" on storage.objects;
create policy "werkbon_fotos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'werkbon-fotos'
    and public.get_mijn_rol() = 'beheerder'
    and public.mag_bij_werkbon(((storage.foldername(name))[1])::uuid)
  );


-- ── C. VERIFICATIE ────────────────────────────────────────────

select 'A: eerste gebruiker wordt beheerder' as controle,
       (select case when pg_get_functiondef(oid) like '%rol = ''beheerder''%'
                    then 'ja' else 'NEE' end
        from pg_proc where proname = 'handle_new_user'
          and pronamespace = 'public'::regnamespace) as uitslag
union all
select 'B: bucket werkbon-fotos bestaat',
       case when exists (select 1 from storage.buckets where id = 'werkbon-fotos')
            then 'ja' else 'NEE' end
union all
select 'B: bucket is besloten (niet publiek)',
       (select case when public then 'NEE — staat publiek' else 'ja' end
        from storage.buckets where id = 'werkbon-fotos')
union all
select 'B: aantal policies op de bucket',
       (select count(*)::text from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like 'werkbon_fotos%');

commit;

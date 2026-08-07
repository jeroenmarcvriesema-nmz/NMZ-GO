-- ============================================================
-- NMZ GO — Migratie 005: bevindingen uit de rollentest dichten
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Drie gaten uit de rollentest van `supabase/tests/rollentest.sql`,
-- plus één die tijdens het schrijven van deze fix boven kwam en
-- zwaarder weegt dan de rest (blok C).
--
--   A. Een toegewezen medewerker kon zijn eigen werkbon niet op
--      voltooid zetten. De app dacht van wel en meldde succes.
--   B. `uitnodigingen` stond open voor iedereen — ook zonder login.
--   C. De rol bij registratie kwam uit client-metadata. Wie zich
--      registreerde kon zichzelf beheerder maken.
--   D. Een uitgenodigde belandde altijd in de oudste tenant, niet
--      in de tenant die hem uitnodigde.
--
-- Voegt toe en vervangt policies/functies. Raakt geen data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. WERKBON AFRONDEN DOOR DE TOEGEWEZEN MEDEWERKER ────────
-- Het probleem: `werkbonnen_update` staat alleen een beheerder toe.
-- WerkbonUitvoeren.tsx zet de bon op 'voltooid', die update raakt
-- nul rijen, en PostgREST geeft daar geen fout op — een update die
-- niets raakt is een geldige lege respons. De monteur zag dus
-- "voltooid" terwijl er niets was opgeslagen.
--
-- De fix is dezelfde tweetrapsopzet als in 003, en om dezelfde
-- reden: een policy kan wel bepalen *welke rij* je mag aanraken,
-- maar niet *welke kolom*. Dat laatste kan alleen een trigger, die
-- OLD en NEW naast elkaar ziet.
--
--   1. Een extra update-policy voor wie op de bon staat.
--   2. Een trigger die zo iemand tot `status` beperkt, en tot de
--      waarden die bij uitvoeren horen.

drop policy if exists "werkbonnen_update_toegewezen" on public.werkbonnen;
create policy "werkbonnen_update_toegewezen"
  on public.werkbonnen for update
  using (
    tenant_id = public.get_mijn_tenant()
    and auth.uid() in (
      select medewerker_id from public.werkbon_medewerkers
      where werkbon_id = werkbonnen.id
    )
  )
  with check (
    tenant_id = public.get_mijn_tenant()
    and auth.uid() in (
      select medewerker_id from public.werkbon_medewerkers
      where werkbon_id = werkbonnen.id
    )
  );

create or replace function public.guard_werkbon_kolommen()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- Serverzijde (service_role, SQL Editor, Edge Function): geen JWT,
  -- dus geen eindgebruiker om tegen te beschermen.
  if auth.uid() is null then
    return new;
  end if;

  -- Een beheerder beheert de hele bon; die beperken we niet.
  if public.get_mijn_rol() = 'beheerder' then
    return new;
  end if;

  -- Vanaf hier: een medewerker die op de bon staat. `updated_at`
  -- laten we buiten beschouwing, dat zet de trigger update_updated_at
  -- zelf. Door de vergelijking over de hele rij te doen in plaats van
  -- kolom voor kolom, blijft deze afscherming ook kloppen als er later
  -- kolommen bij komen.
  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Een medewerker mag alleen de status van een werkbon wijzigen'
      using errcode = '42501';
  end if;

  if new.status not in ('bezig', 'voltooid') then
    raise exception 'Een medewerker mag een werkbon alleen op bezig of voltooid zetten'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_werkbon_kolommen() from public, anon, authenticated;

drop trigger if exists werkbonnen_guard_kolommen on public.werkbonnen;
create trigger werkbonnen_guard_kolommen
  before update on public.werkbonnen
  for each row execute function public.guard_werkbon_kolommen();


-- ── B. UITNODIGINGEN DICHTZETTEN ─────────────────────────────
-- Het lek: `uitnodigingen_select` had als voorwaarde letterlijk
-- `true`. De anon-key staat in de browserbundel, dus iedereen kon
-- alle uitnodigingen van alle tenants opvragen, mét `token`. Eén
-- ongebruikt token volstond om je in die tenant in te schrijven.
-- Aangetoond met een testrij tijdens de rollentest.
--
-- `uitnodigingen_update` was net zo ruim: elke ingelogde gebruiker
-- kon de uitnodiging van een willekeurige andere tenant op
-- `gebruikt` zetten.
--
-- De tabel gaat nu dicht voor iedereen behalve de beheerder van de
-- eigen tenant. Registreer.tsx moet vóór de login nog wél kunnen
-- controleren of een link geldig is; dat loopt vanaf nu via een
-- functie die één token als argument neemt en alleen ja of nee
-- teruggeeft — geen rij, geen tenant, geen lijst.

drop policy if exists "uitnodigingen_select" on public.uitnodigingen;
create policy "uitnodigingen_select"
  on public.uitnodigingen for select
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

drop policy if exists "uitnodigingen_update" on public.uitnodigingen;
create policy "uitnodigingen_update"
  on public.uitnodigingen for update
  using      ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' )
  with check ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

create or replace function public.uitnodiging_controleren(p_token text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.uitnodigingen
    where token = p_token
      and not gebruikt
      and (verloopt_op is null or verloopt_op > now())
  );
$$;

revoke execute on function public.uitnodiging_controleren(text) from public;
grant  execute on function public.uitnodiging_controleren(text) to anon, authenticated;


-- ── C. ROL BIJ REGISTRATIE ───────────────────────────────────
-- Zwaarder dan A en B, en niet zichtbaar in de rollentest omdat het
-- buiten RLS om gaat: `handle_new_user` draait als SECURITY DEFINER
-- en las de rol uit `new.raw_user_meta_data->>'rol'`. Die metadata
-- komt rechtstreeks uit `supabase.auth.signUp({ options: { data } })`
-- en is dus volledig door de client te bepalen:
--
--   supabase.auth.signUp({ email, password,
--     options: { data: { rol: 'beheerder' } } })
--
-- Eén registratie volstond om beheerder te worden. De `with check`
-- op profiles_insert_own uit migratie 003 hielp hier niet: een
-- SECURITY DEFINER-trigger gaat langs RLS heen.
--
-- Vanaf nu staat de rol vast op 'medewerker'. Een beheerder maak je
-- door een bestaande beheerder — dat kan al, en gaat langs de
-- trigger uit 003.
--
-- D. Meteen meegenomen: de tenant kwam uit de fallback van
-- get_mijn_tenant() (de oudste tenant), niet uit de uitnodiging.
-- Met één tenant viel dat niet op; met twee zou iedereen bij de
-- verkeerde klant binnenkomen. De uitnodiging draagt de tenant, dus
-- die lezen we hier uit en verzilveren we in dezelfde transactie —
-- daarmee is een token ook niet meer twee keer te gebruiken.

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_token  text := new.raw_user_meta_data->>'uitnodiging_token';
  v_tenant uuid;
begin
  if v_token is not null then
    update public.uitnodigingen
       set gebruikt = true
     where token = v_token
       and not gebruikt
       and (verloopt_op is null or verloopt_op > now())
    returning tenant_id into v_tenant;
  end if;

  insert into public.profiles (id, naam, rol, tenant_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'naam',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    -- Bewust niet uit de metadata: die is client-gestuurd.
    'medewerker',
    -- Zonder geldige uitnodiging blijft het oude gedrag staan:
    -- de fallback van get_mijn_tenant(), de oudste tenant.
    coalesce(v_tenant, public.get_mijn_tenant())
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


-- ── E. VERIFICATIE ────────────────────────────────────────────
-- Draai dit na de migratie. Alles hoort 'ja' of 'aanwezig' te zijn.

select 'A: policy werkbonnen_update_toegewezen' as controle,
       case when exists (select 1 from pg_policies
                         where schemaname='public' and tablename='werkbonnen'
                           and policyname='werkbonnen_update_toegewezen')
            then 'aanwezig' else 'ONTBREEKT' end as uitslag
union all
select 'A: trigger werkbonnen_guard_kolommen',
       case when exists (select 1 from pg_trigger
                         where tgrelid='public.werkbonnen'::regclass
                           and tgname='werkbonnen_guard_kolommen')
            then 'aanwezig' else 'ONTBREEKT' end
union all
select 'B: uitnodigingen_select niet meer open',
       case when (select qual from pg_policies
                  where schemaname='public' and tablename='uitnodigingen'
                    and policyname='uitnodigingen_select') like '%get_mijn_rol%'
            then 'dicht' else 'NOG OPEN' end
union all
select 'C: handle_new_user leest rol niet meer uit metadata',
       case when pg_get_functiondef(p.oid) like '%raw_user_meta_data->>''rol''%'
            then 'NOG LEK' else 'dicht' end
from pg_proc p where p.proname = 'handle_new_user' and p.pronamespace = 'public'::regnamespace;

commit;

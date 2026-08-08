-- ============================================================
-- NMZ GO — Migratie 008: rollen en bevoegdheden
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Tot nu toe kende het systeem twee rollen en toetste elke policy
-- letterlijk op `get_mijn_rol() = 'beheerder'`. Dat waren 26 policies
-- over 10 tabellen, plus de opslag. Elke nieuwe rol zou betekenen:
-- alles opnieuw nalopen. Dat is precies waar fouten in sluipen.
--
-- Deze migratie doet twee dingen tegelijk, en dat is bewust:
--
--   1. Vijf rollen in plaats van twee.
--   2. Policies toetsen niet meer op een rolnaam maar op een
--      BEVOEGDHEID. Een zesde rol is daarna één functie aanpassen
--      in plaats van dertig policies herschrijven.
--
-- Verder wordt vastgelegd wat een zwamsaneerder wél en niet mag met
-- een werkbon die af is, en wordt het eigenaarsaccount beschermd
-- tegen de fout die dit systeem eerder heeft platgelegd: alle
-- beheerders verwijderen en niet meer binnenkomen.
--
-- Raakt geen bestaande data behalve de rol van de eigenaar.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. VIJF ROLLEN ────────────────────────────────────────────
-- In de database blijft de uitvoerende rol `medewerker` heten. Dat
-- is de generieke term: komt er ooit een ander vak bij, dan hoeft
-- het model niet op de schop. Op het scherm staat "Zwamsaneerder".

alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add  constraint profiles_rol_check
  check (rol in ('eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'medewerker'));

-- Functietitel staat los van het rechtenniveau. "Operationeel
-- Manager" is een functie, geen bevoegdheid; een tweede Operationeel
-- Manager met minder rechten hoeft straks geen eigen rol te krijgen.
alter table public.profiles add column if not exists functie text;


-- ── B. BEVOEGDHEDEN ──────────────────────────────────────────
-- Hier staat het hele rechtenmodel, op één plek. Alles hieronder
-- verwijst naar deze drie functies en nooit meer naar een rolnaam.

create or replace function public.is_eigenaar()
  returns boolean language sql stable security definer set search_path = public
as $$ select public.get_mijn_rol() = 'eigenaar'; $$;

-- Wachtwoorden resetten, uitnodigen, rollen toekennen.
create or replace function public.mag_gebruikers_beheren()
  returns boolean language sql stable security definer set search_path = public
as $$ select public.get_mijn_rol() in ('eigenaar', 'beheerder'); $$;

-- Werkbonnen maken en wijzigen, alles inzien, zoeken, plannen.
create or replace function public.mag_werk_beheren()
  returns boolean language sql stable security definer set search_path = public
as $$ select public.get_mijn_rol() in ('eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider'); $$;

revoke execute on function public.is_eigenaar()            from public, anon;
revoke execute on function public.mag_gebruikers_beheren() from public, anon;
revoke execute on function public.mag_werk_beheren()       from public, anon;
grant  execute on function public.is_eigenaar()            to authenticated;
grant  execute on function public.mag_gebruikers_beheren() to authenticated;
grant  execute on function public.mag_werk_beheren()       to authenticated;


-- ── C. POLICIES ──────────────────────────────────────────────
-- Alle policies opnieuw, nu op bevoegdheid. De structuur blijft
-- gelijk aan wat er stond; alleen de rolvraag verandert.

-- profiles ---------------------------------------------------
drop policy if exists "profiles_select_beheerder" on public.profiles;
create policy "profiles_select_kantoor"
  on public.profiles for select
  using ( public.mag_werk_beheren() and tenant_id = public.get_mijn_tenant() );

drop policy if exists "profiles_update_beheerder" on public.profiles;
create policy "profiles_update_gebruikersbeheer"
  on public.profiles for update
  using      ( public.mag_gebruikers_beheren() and tenant_id = public.get_mijn_tenant() )
  with check ( public.mag_gebruikers_beheren() and tenant_id = public.get_mijn_tenant() );

drop policy if exists "profiles_delete_beheerder" on public.profiles;
create policy "profiles_delete_gebruikersbeheer"
  on public.profiles for delete
  using ( public.mag_gebruikers_beheren() and tenant_id = public.get_mijn_tenant() );

-- werkbonnen -------------------------------------------------
drop policy if exists "werkbonnen_select" on public.werkbonnen;
create policy "werkbonnen_select"
  on public.werkbonnen for select
  using (
    tenant_id = public.get_mijn_tenant()
    and ( public.mag_werk_beheren()
          or auth.uid() in (select medewerker_id from public.werkbon_medewerkers
                            where werkbon_id = werkbonnen.id) )
  );

drop policy if exists "werkbonnen_insert" on public.werkbonnen;
create policy "werkbonnen_insert"
  on public.werkbonnen for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "werkbonnen_update" on public.werkbonnen;
create policy "werkbonnen_update"
  on public.werkbonnen for update
  using      ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() )
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "werkbonnen_delete" on public.werkbonnen;
create policy "werkbonnen_delete"
  on public.werkbonnen for delete
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

-- taken ------------------------------------------------------
drop policy if exists "taken_select" on public.taken;
create policy "taken_select"
  on public.taken for select
  using (
    tenant_id = public.get_mijn_tenant()
    and ( public.mag_werk_beheren()
          or exists (select 1 from public.werkbon_medewerkers wm
                     where wm.werkbon_id = taken.werkbon_id and wm.medewerker_id = auth.uid()) )
  );

-- Een zwamsaneerder vinkt af zolang de bon loopt. Zodra die op
-- voltooid staat is het werk vastgelegd en komt hij er niet meer bij.
drop policy if exists "taken_update" on public.taken;
create policy "taken_update"
  on public.taken for update
  using (
    tenant_id = public.get_mijn_tenant()
    and ( public.mag_werk_beheren()
          or ( exists (select 1 from public.werkbon_medewerkers wm
                       where wm.werkbon_id = taken.werkbon_id and wm.medewerker_id = auth.uid())
               and exists (select 1 from public.werkbonnen w
                           where w.id = taken.werkbon_id and w.status <> 'voltooid') ) )
  );

drop policy if exists "taken_insert" on public.taken;
create policy "taken_insert"
  on public.taken for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "taken_delete" on public.taken;
create policy "taken_delete"
  on public.taken for delete
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

-- fotos ------------------------------------------------------
drop policy if exists "fotos_select" on public.fotos;
create policy "fotos_select"
  on public.fotos for select
  using (
    tenant_id = public.get_mijn_tenant()
    and ( public.mag_werk_beheren()
          or exists (select 1 from public.werkbon_medewerkers wm
                     where wm.werkbon_id = fotos.werkbon_id and wm.medewerker_id = auth.uid()) )
  );

-- Foto's toevoegen mag óók op een afgeronde bon: bewijs achteraf
-- aanvullen is legitiem. Alleen op een bon waar je op staat.
drop policy if exists "fotos_insert" on public.fotos;
create policy "fotos_insert"
  on public.fotos for insert
  with check (
    tenant_id = public.get_mijn_tenant()
    and uploader_id = auth.uid()
    and public.mag_bij_werkbon(werkbon_id)
  );

drop policy if exists "fotos_delete" on public.fotos;
create policy "fotos_delete"
  on public.fotos for delete
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

-- projecten --------------------------------------------------
drop policy if exists "projecten_select" on public.projecten;
create policy "projecten_select"
  on public.projecten for select
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "projecten_insert" on public.projecten;
create policy "projecten_insert"
  on public.projecten for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "projecten_update" on public.projecten;
create policy "projecten_update"
  on public.projecten for update
  using      ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() )
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "projecten_delete" on public.projecten;
create policy "projecten_delete"
  on public.projecten for delete
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

-- werkbon_medewerkers ----------------------------------------
drop policy if exists "werkbon_medewerkers_select" on public.werkbon_medewerkers;
create policy "werkbon_medewerkers_select"
  on public.werkbon_medewerkers for select
  using ( tenant_id = public.get_mijn_tenant()
          and (medewerker_id = auth.uid() or public.mag_werk_beheren()) );

drop policy if exists "werkbon_medewerkers_insert" on public.werkbon_medewerkers;
create policy "werkbon_medewerkers_insert"
  on public.werkbon_medewerkers for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "werkbon_medewerkers_delete" on public.werkbon_medewerkers;
create policy "werkbon_medewerkers_delete"
  on public.werkbon_medewerkers for delete
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

-- uitnodigingen — gebruikersbeheer, dus strenger ---------------
drop policy if exists "uitnodigingen_select" on public.uitnodigingen;
create policy "uitnodigingen_select"
  on public.uitnodigingen for select
  using ( tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren() );

drop policy if exists "uitnodigingen_insert" on public.uitnodigingen;
create policy "uitnodigingen_insert"
  on public.uitnodigingen for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren() );

drop policy if exists "uitnodigingen_update" on public.uitnodigingen;
create policy "uitnodigingen_update"
  on public.uitnodigingen for update
  using      ( tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren() )
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren() );

-- werkdag_logs -----------------------------------------------
drop policy if exists "werkdag_logs_select" on public.werkdag_logs;
create policy "werkdag_logs_select"
  on public.werkdag_logs for select
  using ( tenant_id = public.get_mijn_tenant()
          and (medewerker_id = auth.uid() or public.mag_werk_beheren()) );

drop policy if exists "werkdag_logs_delete" on public.werkdag_logs;
create policy "werkdag_logs_delete"
  on public.werkdag_logs for delete
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

-- verwerkingswachtrij — meekijken mag kantoor ------------------
drop policy if exists "verwerkingstaken_select" on public.verwerkingstaken;
create policy "verwerkingstaken_select"
  on public.verwerkingstaken for select
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "verwerkingsronden_select" on public.verwerkingsronden;
create policy "verwerkingsronden_select"
  on public.verwerkingsronden for select
  using ( public.mag_werk_beheren() );

-- opslag -----------------------------------------------------
drop policy if exists "werkbon_fotos_delete" on storage.objects;
create policy "werkbon_fotos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'werkbon-fotos'
    and public.mag_werk_beheren()
    and public.mag_bij_werkbon(((storage.foldername(name))[1])::uuid)
  );

-- taak_aanmaken() toetste ook op de rolnaam --------------------
-- Eerst weg: Postgres staat niet toe dat `create or replace` de
-- standaardwaarden van bestaande parameters wijzigt.
drop function if exists public.taak_aanmaken(text, jsonb, uuid, integer);

create or replace function public.taak_aanmaken(
  p_soort text, p_payload jsonb, p_volgnummer uuid default null, p_prioriteit integer default 100
) returns uuid
  language plpgsql volatile security definer set search_path = public
as $$
declare nieuw_id uuid;
begin
  if auth.uid() is not null and not public.mag_werk_beheren() then
    raise exception 'Je hebt geen rechten om een verwerkingstaak aan te maken'
      using errcode = '42501';
  end if;

  insert into public.verwerkingstaken (soort, payload, volgnummer, prioriteit)
  values (p_soort, p_payload, coalesce(p_volgnummer, gen_random_uuid()), p_prioriteit)
  returning id into nieuw_id;

  return nieuw_id;
end;
$$;

revoke execute on function public.taak_aanmaken(text, jsonb, uuid, integer) from public, anon;
grant  execute on function public.taak_aanmaken(text, jsonb, uuid, integer) to authenticated;


-- ── D. HET EIGENAARSACCOUNT BESCHERMEN ───────────────────────
-- De fout die dit systeem eerder heeft platgelegd: alle beheerders
-- verwijderd, en toen kon niemand er meer bij. Alleen via de
-- databaseconsole was er nog een weg terug.
--
-- Drie sloten:
--   * rol wijzigen mag alleen wie gebruikers beheert
--   * de rol 'eigenaar' geven of afnemen mag alleen een eigenaar
--   * de laatste eigenaar kan niet worden gedegradeerd of verwijderd,
--     door niemand — ook niet door zichzelf

create or replace function public.guard_profiel_rol_tenant()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Serverzijde (service_role, SQL-editor): geen JWT, geen
  -- eindgebruiker om tegen te beschermen. Dit is bewust de
  -- ontsnappingsroute als er in de app niets meer kan.
  if auth.uid() is null then
    return new;
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Tenant van een profiel wijzigen mag niet via de app'
      using errcode = '42501';
  end if;

  if new.rol is distinct from old.rol then
    if not public.mag_gebruikers_beheren() then
      raise exception 'Je hebt geen rechten om een rol te wijzigen'
        using errcode = '42501';
    end if;

    -- Niemand deelt een hogere rang uit dan hij zelf heeft.
    if (new.rol = 'eigenaar' or old.rol = 'eigenaar') and not public.is_eigenaar() then
      raise exception 'Alleen een eigenaar kan de rol eigenaar toekennen of afnemen'
        using errcode = '42501';
    end if;

    -- De laatste eigenaar blijft staan.
    if old.rol = 'eigenaar' and new.rol <> 'eigenaar'
       and (select count(*) from public.profiles
            where tenant_id = old.tenant_id and rol = 'eigenaar') <= 1 then
      raise exception 'Dit is de laatste eigenaar; degraderen zou niemand meer toegang geven'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_profiel_verwijderen()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return old;
  end if;

  if old.rol = 'eigenaar'
     and (select count(*) from public.profiles
          where tenant_id = old.tenant_id and rol = 'eigenaar') <= 1 then
    raise exception 'Dit is de laatste eigenaar; verwijderen zou niemand meer toegang geven'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

revoke execute on function public.guard_profiel_verwijderen() from public, anon, authenticated;

drop trigger if exists profiles_guard_verwijderen on public.profiles;
create trigger profiles_guard_verwijderen
  before delete on public.profiles
  for each row execute function public.guard_profiel_verwijderen();


-- ── E. WANNEER EEN WERKBON OP SLOT GAAT ──────────────────────
-- Tot nu toe stond "alle punten afgevinkt" alleen in de schermcode.
-- Wie de app omzeilt kon een bon zo op voltooid zetten. Nu controleert
-- de database het: élk punt afgevinkt, én elk punt met minstens één
-- foto. Daarna is de bon dicht voor de uitvoerende.

create or replace function public.guard_werkbon_kolommen()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_open      int;
  v_zonderfoto int;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Kantoor mag een bon administratief bijwerken en heropenen.
  if public.mag_werk_beheren() then
    return new;
  end if;

  -- Vanaf hier: een zwamsaneerder die op de bon staat.
  if old.status = 'voltooid' then
    raise exception 'Deze werkbon is afgerond en kan niet meer worden gewijzigd'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Je mag alleen de status van een werkbon wijzigen'
      using errcode = '42501';
  end if;

  if new.status not in ('bezig', 'voltooid') then
    raise exception 'Je mag een werkbon alleen op bezig of voltooid zetten'
      using errcode = '42501';
  end if;

  if new.status = 'voltooid' then
    select count(*) into v_open
      from public.taken t where t.werkbon_id = new.id and not t.voltooid;

    if v_open > 0 then
      raise exception 'Er % nog % niet afgevinkt; afronden kan pas als alles klaar is',
        case when v_open = 1 then 'is' else 'zijn' end,
        case when v_open = 1 then '1 punt' else v_open || ' punten' end
        using errcode = '42501';
    end if;

    select count(*) into v_zonderfoto
      from public.taken t
      where t.werkbon_id = new.id
        and not exists (select 1 from public.fotos f where f.taak_id = t.id);

    if v_zonderfoto > 0 then
      raise exception 'Er % nog % zonder foto; elk punt heeft fotobewijs nodig',
        case when v_zonderfoto = 1 then 'is' else 'zijn' end,
        case when v_zonderfoto = 1 then '1 punt' else v_zonderfoto || ' punten' end
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


-- ── F. SMALLE DOORKIJK OP DE PLANNING ────────────────────────
-- Een zwamsaneerder mag zien wáár een collega zit — handig om af te
-- stemmen — maar niet wat er op diens bon staat. Deze functie geeft
-- daarom uitsluitend datum, adres en naam terug. Geen taken, geen
-- foto's, geen opmerkingen, geen bon-id.

create or replace function public.planning_overzicht(p_van date, p_tot date)
  returns table (datum date, adres text, plaats text, medewerker text)
  language sql stable security definer set search_path = public
as $$
  select w.datum, w.adres, w.plaats, p.naam
  from public.werkbonnen w
  join public.werkbon_medewerkers wm on wm.werkbon_id = w.id
  join public.profiles p on p.id = wm.medewerker_id
  where w.tenant_id = public.get_mijn_tenant()
    and w.datum between p_van and p_tot
  order by w.datum, p.naam;
$$;

revoke execute on function public.planning_overzicht(date, date) from public, anon;
grant  execute on function public.planning_overzicht(date, date) to authenticated;


-- ── G. DE EIGENAAR ───────────────────────────────────────────

update public.profiles
   set rol = 'eigenaar',
       functie = coalesce(functie, 'Operationeel Manager')
 where id = (select id from auth.users where email = 'jeroenmarcvriesema@gmail.com');

commit;

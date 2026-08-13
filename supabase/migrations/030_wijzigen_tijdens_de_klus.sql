-- 030 — Wijzigen tijdens een lopende klus, met terugkoppeling naar ClickUp
--
-- Tot nu toe was een werkbon na de import zo goed als bevroren. Wie er
-- op stond kwam uit ClickUp en werd elke ronde opnieuw overschreven; de
-- datums waren wél te wijzigen maar bleven in NMZ GO hangen. In de
-- praktijk verandert er van alles ná het inplannen: iemand valt uit, de
-- klus loopt uit, er komt werk bij.
--
-- Drie functies, één regel: wat hier verandert gaat terug naar ClickUp.
-- Anders lopen het planbord en de uitvoering uit elkaar, en dan is de
-- vraag "wie heeft gelijk" niet meer te beantwoorden.
--
-- De terugkoppeling loopt via de wachtrij en niet rechtstreeks. Ligt
-- ClickUp er even uit, dan blijft de taak staan en volgt hij later — de
-- planner hoort nooit op ClickUp te wachten om iemand van een klus te
-- halen.

-- ── De ploeg ────────────────────────────────────────────────────

create or replace function public.werkbon_ploeg_zetten(
  p_werkbon uuid,
  p_personen uuid[]
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_bon    public.werkbonnen%rowtype;
  v_namen  text;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen kantoor kan de ploeg op een klus wijzigen'
      using errcode = '42501';
  end if;

  select * into v_bon from public.werkbonnen
   where id = p_werkbon and tenant_id = v_tenant;
  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  -- Elke persoon moet bij deze tenant horen. Zonder deze toets kan een
  -- willekeurige uuid op een bon belanden.
  if exists (
    select 1 from unnest(coalesce(p_personen, '{}'::uuid[])) as g(id)
    where not exists (
      select 1 from public.personen p
       where p.id = g.id and p.tenant_id = v_tenant
    )
  ) then
    raise exception 'Onbekende medewerker in de selectie' using errcode = '23503';
  end if;

  -- Alles weg en opnieuw. `handmatig` staat bewust op true: de
  -- synchronisatieronde veegt elke ronde iedereen weg die dat niet is,
  -- en dan zou deze keuze binnen vijf minuten verdwenen zijn. Zodra
  -- ClickUp is bijgewerkt zet de ronde dezelfde mensen er nog een keer
  -- bij, maar die botsen op de primaire sleutel en worden genegeerd.
  delete from public.werkbon_medewerkers where werkbon_id = p_werkbon;

  insert into public.werkbon_medewerkers (tenant_id, werkbon_id, persoon_id, handmatig)
  select v_tenant, p_werkbon, g.id, true
  from unnest(coalesce(p_personen, '{}'::uuid[])) as g(id);

  select string_agg(p.naam, ', ' order by p.naam) into v_namen
  from public.personen p
  where p.id = any(coalesce(p_personen, '{}'::uuid[]));

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'ploeg_gewijzigd',
          coalesce(v_namen, 'niemand meer op deze klus'), auth.uid());

  perform public.taak_aanmaken(
    'clickup.werkbon_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'ploeg'));

  return jsonb_build_object('ploeg', coalesce(v_namen, ''), 'aantal',
                            coalesce(array_length(p_personen, 1), 0));
end;
$$;

-- ── De planning ─────────────────────────────────────────────────

create or replace function public.werkbon_planning_zetten(
  p_werkbon uuid,
  p_start   date,
  p_eind    date
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_bon    public.werkbonnen%rowtype;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen kantoor kan de planning van een klus wijzigen'
      using errcode = '42501';
  end if;

  if p_start is null then
    raise exception 'Een klus heeft een startdatum nodig' using errcode = '23514';
  end if;

  if p_eind is not null and p_eind < p_start then
    raise exception 'De opleverdatum ligt vóór de startdatum' using errcode = '23514';
  end if;

  select * into v_bon from public.werkbonnen
   where id = p_werkbon and tenant_id = v_tenant;
  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  -- `datum` schuift mee met de startdatum. Die kolom bepaalt op welke
  -- dag de bon in "Vandaag" en "Mijn week" opduikt; laat je hem staan,
  -- dan verzet je de klus in de planning terwijl de zwamsaneerder hem
  -- op de oude dag in beeld houdt.
  update public.werkbonnen
     set geplande_start = p_start,
         geplande_eind  = p_eind,
         datum          = p_start
   where id = p_werkbon;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'planning_gewijzigd',
          to_char(p_start, 'DD-MM-YYYY') ||
          coalesce(' t/m ' || to_char(p_eind, 'DD-MM-YYYY'), ''), auth.uid());

  perform public.taak_aanmaken(
    'clickup.werkbon_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'planning'));

  return jsonb_build_object('start', p_start, 'eind', p_eind);
end;
$$;

-- ── Een punt erbij ──────────────────────────────────────────────
--
-- Meerwerk dat op de klus zelf wordt afgesproken. Gaat niet naar
-- ClickUp: de punten komen uit de werkopdracht-PDF en daar bestaat aan
-- de ClickUp-kant geen veld voor. Het punt hoort wel in de bon, anders
-- staat het nergens en wordt er ook geen foto van gevraagd.

create or replace function public.werkbon_punt_toevoegen(
  p_werkbon      uuid,
  p_titel        text,
  p_foto_vereist boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_titel  text := btrim(coalesce(p_titel, ''));
  v_id     uuid;
  v_plek   integer;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen kantoor kan een punt aan een klus toevoegen'
      using errcode = '42501';
  end if;

  if length(v_titel) < 3 then
    raise exception 'Schrijf op wat er gedaan moet worden' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.werkbonnen
     where id = p_werkbon and tenant_id = v_tenant
  ) then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  select coalesce(max(volgorde), -1) + 1 into v_plek
  from public.taken where werkbon_id = p_werkbon;

  insert into public.taken (tenant_id, werkbon_id, titel, volgorde, foto_vereist)
  values (v_tenant, p_werkbon, v_titel, v_plek, coalesce(p_foto_vereist, true))
  returning id into v_id;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'punt_toegevoegd', v_titel, auth.uid());

  return jsonb_build_object('taak_id', v_id, 'volgorde', v_plek);
end;
$$;

revoke all on function public.werkbon_ploeg_zetten(uuid, uuid[])      from public, anon;
revoke all on function public.werkbon_planning_zetten(uuid, date, date) from public, anon;
revoke all on function public.werkbon_punt_toevoegen(uuid, text, boolean) from public, anon;

grant execute on function public.werkbon_ploeg_zetten(uuid, uuid[])      to authenticated;
grant execute on function public.werkbon_planning_zetten(uuid, date, date) to authenticated;
grant execute on function public.werkbon_punt_toevoegen(uuid, text, boolean) to authenticated;

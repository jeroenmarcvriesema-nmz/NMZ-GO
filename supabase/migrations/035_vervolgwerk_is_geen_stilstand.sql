-- 035 — "Nog spuiten/isoleren" is geen stilgelegde klus
--
-- Er staan vier knoppen op de werkbon en alle vier riepen
-- `werkbon_stilleggen()` aan. Voor stilleggen en asbest klopt dat: het
-- werk ligt stil en niemand kan verder. Voor de andere twee niet.
--
--   ● "Nog spuiten/isoleren" betekent dat het grondwerk klaar is en dat
--     er nog gespoten of geïsoleerd moet worden. Er ligt niets stil —
--     er moet nog wat gebeuren, en het is bekend wát.
--   ● "Opnieuw inplannen/later" betekent dat er een nieuwe datum komt.
--     De klus is heel; hij wacht op de planner.
--
-- Allebei zijn het statussen op het bord in ClickUp, en geen toestand
-- van de klus in NMZ GO. Toch zette de knop `stilgelegd_op`, en daarmee
-- gaat de hele app erin mee: `klusstand()` leest die kolom als eerste,
-- dus het kaartje wordt rood, de planning zet er "Ligt stil" op, de
-- containerlijst rekent hem als een klus die stilligt, en het dashboard
-- telt hem bij het werk dat vastzit. Woorden van de eigenaar: "dat is
-- niet zo namelijk".
--
-- Wat deze migratie doet:
--
--   1. Drie kolommen op `werkbonnen` die vastleggen dát er vervolgwerk
--      is gemeld en waarom — los van stilleggen.
--   2. `werkbon_vervolg_melden()` — meldt het, koppelt terug naar
--      ClickUp, en laat `stilgelegd_op` met rust.
--   3. `werkbon_vervolg_afronden()` — haalt de melding er weer af en
--      zet de taak terug op de gewone status.
--   4. De twee bonnen die er nu ten onrechte als stilgelegd in staan
--      worden rechtgezet.
--
-- Geen wijziging aan `werkbon_stilleggen()` of `werkbon_hervatten()`.
-- Die blijven precies wat ze zijn, voor de gevallen waarin het werk
-- écht stilligt.

-- ── 1. De kolommen ───────────────────────────────────────────
-- Apart van `stilleg_reden`, en niet in plaats daarvan. Een klus kan
-- allebei tegelijk hebben: er moet nog geïsoleerd worden én de bewoner
-- heeft asbest gevonden. Ze in één kolom persen zou betekenen dat de
-- laatste melding de vorige wist.

alter table public.werkbonnen
  add column if not exists vervolg_soort text
    check (vervolg_soort is null or vervolg_soort in ('spuiten_isoleren', 'opnieuw_inplannen')),
  add column if not exists vervolg_reden text,
  add column if not exists vervolg_op    timestamptz,
  add column if not exists vervolg_door  uuid references public.profiles(id);

comment on column public.werkbonnen.vervolg_soort is
  'Welk vervolgwerk er is gemeld: spuiten_isoleren of opnieuw_inplannen. '
  'Dit is een status op het ClickUp-bord en géén stilstand — de klus loopt door. '
  'Voor werk dat wél stilligt is er stilgelegd_op.';

-- ── 2. Melden ────────────────────────────────────────────────

create or replace function public.werkbon_vervolg_melden(
  p_werkbon uuid,
  p_soort   text,
  p_reden   text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_reden  text := btrim(coalesce(p_reden, ''));
  v_bon    public.werkbonnen%rowtype;
  v_status text;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan vervolgwerk melden'
      using errcode = '42501';
  end if;

  if p_soort not in ('spuiten_isoleren', 'opnieuw_inplannen') then
    raise exception 'Onbekend soort vervolgwerk: %', p_soort using errcode = '23514';
  end if;

  -- Dezelfde eis als bij stilleggen. De reden is wat de planner leest
  -- om te weten wie hij nodig heeft; zonder die zin is de status een
  -- vlaggetje zonder inhoud.
  if length(v_reden) < 3 then
    raise exception 'Geef aan wat er nog moet gebeuren' using errcode = '23514';
  end if;

  select * into v_bon from public.werkbonnen
   where id = p_werkbon and tenant_id = v_tenant;
  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  if v_bon.opgeleverd_op is not null then
    raise exception 'Deze klus is opgeleverd; daar valt geen vervolgwerk meer op te melden'
      using errcode = '23514';
  end if;

  -- De statusnaam alvast meeschrijven, zodat het scherm meteen laat
  -- zien wat er op het bord komt te staan. De verwerker zet er straks
  -- dezelfde waarde overheen zodra ClickUp bevestigd heeft; gaat dat
  -- mis, dan blijft de taak in de wachtrij staan en is dat zichtbaar.
  select case p_soort
           when 'spuiten_isoleren' then coalesce(i.status_spuiten_isoleren, i.status_stilgelegd, 'on hold')
           else coalesce(i.status_opnieuw_inplannen, i.status_stilgelegd, 'on hold')
         end
    into v_status
    from public.clickup_instellingen i
   where i.tenant_id = v_tenant;

  update public.werkbonnen
     set vervolg_soort  = p_soort,
         vervolg_reden  = v_reden,
         vervolg_op     = now(),
         vervolg_door   = auth.uid(),
         clickup_status = coalesce(v_status, clickup_status)
   where id = p_werkbon;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'vervolg_gemeld',
          (case p_soort
             when 'spuiten_isoleren' then 'Nog spuiten/isoleren'
             else 'Opnieuw inplannen/later'
           end) || ': ' || v_reden,
          auth.uid());

  perform public.taak_aanmaken(
    'clickup.status_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', p_soort));

  return jsonb_build_object('gemeld', true, 'soort', p_soort, 'clickup_status', v_status);
end;
$$;

revoke all on function public.werkbon_vervolg_melden(uuid, text, text) from public, anon;
grant execute on function public.werkbon_vervolg_melden(uuid, text, text) to authenticated;

comment on function public.werkbon_vervolg_melden(uuid, text, text) is
  'Meldt dat er nog gespoten/geïsoleerd moet worden of dat de klus opnieuw '
  'ingepland wordt, en zet de bijbehorende status in ClickUp. Raakt '
  'stilgelegd_op niet aan: de klus ligt niet stil.';

-- ── 3. De melding er weer af ─────────────────────────────────

create or replace function public.werkbon_vervolg_afronden(p_werkbon uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_soort  text;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan dit afronden'
      using errcode = '42501';
  end if;

  select vervolg_soort into v_soort from public.werkbonnen
   where id = p_werkbon and tenant_id = v_tenant;
  if v_soort is null then
    raise exception 'Op deze werkbon staat geen vervolgwerk' using errcode = 'P0002';
  end if;

  update public.werkbonnen
     set vervolg_soort = null, vervolg_reden = null,
         vervolg_op = null, vervolg_door = null
   where id = p_werkbon and tenant_id = v_tenant;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'vervolg_afgerond', v_soort, auth.uid());

  -- Terug naar de gewone werkstatus. Hergebruikt bewust 'hervat': die
  -- zet in de verwerker `trigger_status`, en dat is precies waar deze
  -- klus weer thuishoort. Een tweede pad dat hetzelfde doet zou het
  -- alleen maar uit elkaar kunnen laten lopen.
  perform public.taak_aanmaken(
    'clickup.status_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'hervat'));

  return jsonb_build_object('afgerond', true);
end;
$$;

revoke all on function public.werkbon_vervolg_afronden(uuid) from public, anon;
grant execute on function public.werkbon_vervolg_afronden(uuid) to authenticated;

-- ── 4. Rechtzetten wat er al fout in staat ───────────────────
-- Twee klussen zijn met de knop "Nog spuiten/isoleren" stilgelegd en
-- staan sindsdien in de hele app als "Ligt stil". Hun ClickUp-status is
-- wél goed ('nog spuiten/isoleren'), dus daar hoeft niets naartoe — dit
-- is puur het opruimen van een toestand die NMZ GO zichzelf heeft
-- aangepraat.
--
-- Op de tekst van de reden en niet op een lijst met id's, zodat dit ook
-- klopt voor bonnen die er tussen het schrijven en het draaien van deze
-- migratie nog bij komen. Hetzelfde voorzetsel dat de knop schrijft.

update public.werkbonnen
   set vervolg_soort = case
         when stilleg_reden ilike 'nog spuiten/isoleren:%' then 'spuiten_isoleren'
         else 'opnieuw_inplannen'
       end,
       vervolg_reden = btrim(split_part(stilleg_reden, ':', 2)),
       vervolg_op    = stilgelegd_op,
       vervolg_door  = stilgelegd_door,
       stilgelegd_op   = null,
       stilleg_reden   = null,
       stilgelegd_door = null
 where stilgelegd_op is not null
   and (stilleg_reden ilike 'nog spuiten/isoleren:%'
        or stilleg_reden ilike 'opnieuw inplannen:%');

-- Controle na afloop:
--
--   select adres, stilgelegd_op is not null as ligt_stil,
--          vervolg_soort, vervolg_reden, clickup_status
--     from public.werkbonnen
--    where vervolg_soort is not null or stilgelegd_op is not null;
--
-- Verwacht: de asbestklussen staan nog op ligt_stil, de klussen met
-- spuiten/isoleren niet meer — met hun toelichting in vervolg_reden.

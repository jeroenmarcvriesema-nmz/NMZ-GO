-- ============================================================
-- NMZ GO — Migratie 043: de standen komen ook terug uit ClickUp
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- De koppeling was voor status eenrichtingsverkeer. NMZ GO schreef
-- naar ClickUp — stilgelegd, hervat, opgeleverd, vervolgwerk — en las
-- er niets van terug. Dat werkt zolang iedereen in de app werkt, en
-- dat doet nog niet iedereen. Kantoor vinkt af in ClickUp, en die klus
-- bleef in NMZ GO op "nog niet gestart" staan.
--
-- Bij de eerste telling waren dat er negen, waarvan de oudste tien
-- dagen. Die zijn handmatig gelijkgetrokken; deze migratie zorgt dat
-- het niet opnieuw uit de pas loopt.
--
-- De ronde zelf staat in de Edge Function (`standenOphalen`). Hier
-- staat wat er per werkbon mag gebeuren, want dat is de kant waar het
-- fout kan gaan: een status uit ClickUp mag nooit stilzwijgend
-- overschrijven wat iemand in de app heeft vastgelegd.
--
-- Drie regels, en ze staan hieronder in code in plaats van in een
-- afspraak:
--
--   1. **Opgeleverd is eenrichtingsverkeer.** Staat een klus in NMZ GO
--      op opgeleverd, dan zet geen enkele ClickUp-status hem terug.
--      Aan een oplevering hangt een opleverrapport en een fotoketen;
--      die maak je niet ongedaan met een muisklik op een planbord.
--
--   2. **Stilstand mag wél terug — maar alleen die van de koppeling
--      zelf.** "On hold" is per definitie tijdelijk: kan de sync hem
--      niet opheffen, dan staat elke klus die ooit even stillag voor
--      altijd rood. Het onderscheid loopt via `stilgelegd_door`: leeg
--      betekent dat de koppeling hem heeft gezet en hem dus ook weer
--      mag weghalen, gevuld betekent dat een mens die afweging heeft
--      gemaakt en dan blijft hij staan. Hetzelfde voor `vervolg_door`.
--
--   3. **Spreken ze elkaar tegen, dan wint niemand.** Ligt een klus in
--      NMZ GO stil terwijl ClickUp "opgeleverd" zegt, dan wordt er
--      niets gewijzigd en gaat er een melding naar kantoor. Dat is
--      precies het geval waarin de twee systemen iets werkelijk
--      verschillends beweren, en dat wil je zien in plaats van
--      gladgestreken krijgen.
--
-- Wat deze migratie bewust niet doet: bestaande werkbonnen bijwerken.
-- De inhaalslag is los gedaan en verantwoord; een migratie die en
-- passant negen bonnen sluit is niet terug te draaien zonder te weten
-- welke negen dat waren.
--
-- Geen nieuwe soort in `werkbon_gebeurtenissen`: dit gebruikt
-- 'opgeleverd', 'stilgelegd', 'hervat', 'vervolg_gemeld' en
-- 'vervolg_afgerond', die alle vijf al in de check staan. Zie migratie
-- 039 voor waarom dat geen detail is.
-- ============================================================

begin;

-- ── A. TOT WAAR IS ER GEKEKEN ────────────────────────────────
-- Zonder dit moet elke ronde de hele lijst opnieuw langs. Mét dit
-- vraagt de ronde alleen naar taken die sinds de vorige keer zijn
-- aangeraakt, en dat is meestal niets.

alter table public.clickup_instellingen
  add column if not exists standen_gesynct_tot timestamptz;

comment on column public.clickup_instellingen.standen_gesynct_tot is
  'Tot welk moment de standenronde de ClickUp-statussen heeft nagelopen. '
  'Leeg = nog nooit; dan kijkt de eerste ronde één keer naar alles.';


-- ── B. ÉÉN STAND OVERNEMEN ───────────────────────────────────
-- Als functie en niet als losse updates vanuit de Edge Function, om
-- de reden uit migratie 039: de wijziging en de logregel horen in
-- dezelfde transactie. Een gebeurtenis die achteraf apart wordt
-- weggeschreven kan ontbreken zonder dat iemand het merkt.

create or replace function public.clickup_stand_overnemen(
  p_werkbon uuid,
  p_stand   text,
  p_moment  timestamptz,
  p_status  text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_bon    record;
  v_reden  text;
begin
  if p_stand not in ('opgeleverd', 'stilgelegd', 'spuiten_isoleren',
                     'opnieuw_inplannen', 'loopt') then
    raise exception 'onbekende stand: %', p_stand using errcode = '22023';
  end if;

  select id, tenant_id, adres, status, opgeleverd_op, stilgelegd_op,
         stilgelegd_door, vervolg_soort, vervolg_op, vervolg_door
    into v_bon
    from public.werkbonnen
   where id = p_werkbon;

  if not found then
    raise exception 'werkbon % bestaat niet', p_werkbon using errcode = 'P0002';
  end if;

  v_reden := 'Overgenomen uit ClickUp: ' || coalesce(p_status, p_stand);

  -- ── Regel 1: opgeleverd blijft opgeleverd ──
  if v_bon.opgeleverd_op is not null then
    if p_stand = 'opgeleverd' then
      return jsonb_build_object('uitkomst', 'ongewijzigd');
    end if;
    return jsonb_build_object(
      'uitkomst', 'botsing',
      'reden', 'in NMZ GO opgeleverd, in ClickUp "' || coalesce(p_status, '?') || '"');
  end if;

  -- ── Opleveren ──
  if p_stand = 'opgeleverd' then
    -- Een stilstand die een mens heeft gezet weegt zwaarder dan een
    -- statuswissel op het planbord: die persoon wist iets.
    if v_bon.stilgelegd_op is not null and v_bon.stilgelegd_door is not null then
      return jsonb_build_object(
        'uitkomst', 'botsing',
        'reden', 'ligt in NMZ GO stil, maar staat in ClickUp op opgeleverd');
    end if;

    update public.werkbonnen
       set status         = 'voltooid',
           opgeleverd_op  = p_moment,
           opleverdatum   = p_moment::date,
           -- Een stilstand van de koppeling zelf is achterhaald zodra
           -- de klus af is; anders blijft de bon rood én opgeleverd.
           stilgelegd_op   = null,
           stilleg_reden   = null,
           vervolg_soort   = null,
           vervolg_reden   = null,
           vervolg_op      = null,
           clickup_status  = p_status
     where id = p_werkbon;

    -- `door` blijft leeg: niemand heeft hier op een knop gedrukt. Dat
    -- is ook precies wat de tijdlijn hoort te laten zien.
    insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door, created_at)
    values (v_bon.tenant_id, p_werkbon, 'opgeleverd', v_reden, null, p_moment);

    return jsonb_build_object('uitkomst', 'opgeleverd');
  end if;

  -- ── Weer aan het werk ──
  if p_stand = 'loopt' then
    -- Alleen opheffen wat de koppeling zelf heeft gezet (regel 2).
    if v_bon.stilgelegd_op is not null and v_bon.stilgelegd_door is null then
      update public.werkbonnen
         set stilgelegd_op = null, stilleg_reden = null, clickup_status = p_status
       where id = p_werkbon;

      insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door, created_at)
      values (v_bon.tenant_id, p_werkbon, 'hervat', v_reden, null, p_moment);

      return jsonb_build_object('uitkomst', 'hervat');
    end if;

    if v_bon.vervolg_op is not null and v_bon.vervolg_door is null then
      update public.werkbonnen
         set vervolg_soort = null, vervolg_reden = null, vervolg_op = null,
             clickup_status = p_status
       where id = p_werkbon;

      insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door, created_at)
      values (v_bon.tenant_id, p_werkbon, 'vervolg_afgerond', v_reden, null, p_moment);

      return jsonb_build_object('uitkomst', 'vervolg_afgerond');
    end if;

    return jsonb_build_object('uitkomst', 'ongewijzigd');
  end if;

  -- ── Stilleggen ──
  if p_stand = 'stilgelegd' then
    if v_bon.stilgelegd_op is not null then
      return jsonb_build_object('uitkomst', 'ongewijzigd');
    end if;

    update public.werkbonnen
       set stilgelegd_op   = p_moment,
           stilleg_reden   = v_reden,
           stilgelegd_door = null,
           clickup_status  = p_status
     where id = p_werkbon;

    insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door, created_at)
    values (v_bon.tenant_id, p_werkbon, 'stilgelegd', v_reden, null, p_moment);

    return jsonb_build_object('uitkomst', 'stilgelegd');
  end if;

  -- ── Vervolgwerk (migratie 035: dit is geen stilstand) ──
  if v_bon.vervolg_soort is not distinct from p_stand then
    return jsonb_build_object('uitkomst', 'ongewijzigd');
  end if;

  if v_bon.vervolg_door is not null then
    return jsonb_build_object(
      'uitkomst', 'botsing',
      'reden', 'in NMZ GO is ander vervolgwerk gemeld dan ClickUp aangeeft ("'
               || coalesce(p_status, '?') || '")');
  end if;

  update public.werkbonnen
     set vervolg_soort  = p_stand,
         vervolg_reden  = v_reden,
         vervolg_op     = p_moment,
         vervolg_door   = null,
         clickup_status = p_status
   where id = p_werkbon;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door, created_at)
  values (v_bon.tenant_id, p_werkbon, 'vervolg_gemeld', v_reden, null, p_moment);

  return jsonb_build_object('uitkomst', 'vervolg_gemeld');
end;
$$;

comment on function public.clickup_stand_overnemen(uuid, text, timestamptz, text) is
  'Neemt één ClickUp-stand over op een werkbon. Opgeleverd is eenrichtingsverkeer; '
  'stilstand en vervolgwerk mogen alleen worden opgeheven als de koppeling ze zelf '
  'heeft gezet. Spreken beide systemen elkaar tegen, dan wijzigt er niets en komt '
  'er "botsing" terug.';

revoke execute on function public.clickup_stand_overnemen(uuid, text, timestamptz, text)
  from public, anon, authenticated;
grant  execute on function public.clickup_stand_overnemen(uuid, text, timestamptz, text)
  to service_role;


-- ── C. EEN BOTSING MELDEN ────────────────────────────────────
-- Naar iedereen boven een zwamsaneerder, net als bij de andere
-- meldingen (migratie 039). Hooguit één keer per klus per dag: de
-- ronde draait elke vijf minuten en een verschil dat blijft bestaan
-- hoort niet elke vijf minuten opnieuw te piepen.

create or replace function public.clickup_botsing_melden(
  p_werkbon uuid,
  p_tekst   text
)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant uuid;
  v_aantal integer := 0;
begin
  select tenant_id into v_tenant from public.werkbonnen where id = p_werkbon;
  if not found then
    return 0;
  end if;

  if exists (
    select 1 from public.meldingen m
     where m.soort = 'clickup_botsing'
       and m.werkbon_id = p_werkbon
       and m.created_at > now() - interval '24 hours'
  ) then
    return 0;
  end if;

  with verstuurd as (
    insert into public.meldingen (tenant_id, voor_profile_id, soort, tekst, werkbon_id)
    select v_tenant, pr.id, 'clickup_botsing', left(p_tekst, 500), p_werkbon
      from public.profiles pr
     where pr.tenant_id = v_tenant
       and pr.rol in ('eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner')
    returning 1
  )
  select count(*) into v_aantal from verstuurd;

  return v_aantal;
end;
$$;

comment on function public.clickup_botsing_melden(uuid, text) is
  'Meldt aan kantoor dat ClickUp en NMZ GO iets verschillends beweren over een klus. '
  'Hooguit één keer per klus per etmaal.';

revoke execute on function public.clickup_botsing_melden(uuid, text)
  from public, anon, authenticated;
grant  execute on function public.clickup_botsing_melden(uuid, text) to service_role;


-- ── D. DE HARTSLAG NEEMT DE RONDE MEE ────────────────────────
-- Geen tweede cron-job. Eén hartslag die twee rondes inplant houdt het
-- ritme op één plek; twee schema's die uit elkaar lopen is een storing
-- die je pas ziet als je hem zoekt.

create or replace function public.clickup_hartslag()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant record;
  v_soort  text;
  v_aantal integer := 0;
begin
  for v_tenant in
    select tenant_id from public.clickup_instellingen where actief
  loop
    foreach v_soort in array array['clickup.synchroniseren', 'clickup.standen_ophalen']
    loop
      -- Ligt er al een ronde te wachten of loopt er een, dan slaan we
      -- deze over. Zonder dit stapelen de taken op zodra ClickUp traag
      -- is of even uit de lucht, en dan draait de verwerker een uur
      -- later dezelfde ronde tien keer achter elkaar.
      if exists (
        select 1 from public.verwerkingstaken
        where soort = v_soort
          and tenant_id = v_tenant.tenant_id
          and status not in ('geslaagd', 'mislukt', 'onverwerkbaar')
      ) then
        continue;
      end if;

      perform public.taak_aanmaken(
        v_soort,
        jsonb_build_object('tenant_id', v_tenant.tenant_id)
      );
      v_aantal := v_aantal + 1;
    end loop;
  end loop;

  return v_aantal;
end;
$$;

comment on function public.clickup_hartslag() is
  'Zet per tenant met een actieve koppeling twee rondes in de wachtrij: nieuwe '
  'klussen ophalen, en de standen uit ClickUp overnemen. Slaat een ronde over als '
  'die al wacht of loopt.';

revoke execute on function public.clickup_hartslag() from public, anon;
grant  execute on function public.clickup_hartslag() to service_role;

commit;


-- ── E. VERIFICATIE ────────────────────────────────────────────
-- Draai deze na de migratie; alles hoort 'ja' of het verwachte getal
-- te zeggen.

select 'de kolom staat er' as controle,
       (select count(*)::text from information_schema.columns
         where table_schema = 'public' and table_name = 'clickup_instellingen'
           and column_name = 'standen_gesynct_tot') as gevonden,
       '1' as verwacht
union all
select 'beide functies bestaan',
       (select count(*)::text from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('clickup_stand_overnemen', 'clickup_botsing_melden')),
       '2'
union all
select 'niemand buiten service_role mag ze aanroepen',
       (select count(*)::text from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('clickup_stand_overnemen', 'clickup_botsing_melden')
           and (has_function_privilege('authenticated', p.oid, 'execute')
             or has_function_privilege('anon', p.oid, 'execute'))),
       '0'
union all
select 'de gebruikte gebeurtenissoorten mogen in het logboek',
       (select count(*)::text
          from unnest(array['opgeleverd','stilgelegd','hervat',
                            'vervolg_gemeld','vervolg_afgerond']) s
         where pg_get_constraintdef(
                 (select oid from pg_constraint
                   where conname = 'werkbon_gebeurtenissen_soort_check')
               ) like '%''' || s || '''%'),
       '5'
union all
select 'de hartslag staat nog ingepland',
       (select case when active then schedule else 'NEE — staat uit' end
          from cron.job where jobname = 'nmzgo-clickup-hartslag'),
       '*/5 4-19 * * *';

-- 039 — Een klus die om half negen nog stilstaat
--
-- Kantoor merkt nu pas dat er iets niet loopt als iemand toevallig op
-- het dashboard kijkt, of als de opdrachtgever belt. Een ploeg die niet
-- is komen opdagen, een bus die stuk staat, een adres waar niemand
-- opendoet — dat kost een dag, en die dag is om half negen nog te
-- redden.
--
-- ── Wie krijgt het ──
-- Iedereen boven een zwamsaneerder: eigenaar, beheerder, uitvoerder,
-- werkvoorbereider en planner. Dat is dezelfde groep als
-- `mag_werk_beheren()`, en dat is geen toeval — wie het werk mag
-- inplannen hoort te weten dat het niet loopt. De ploeg zelf krijgt
-- niets: die staat er al, of juist niet, en in beide gevallen helpt een
-- melding op hun eigen telefoon niemand.
--
-- ── Wanneer ──
-- Vanaf 08:30 Nederlandse tijd, en niet op zondag. De cron draait in
-- UTC en dat verschuift een uur met de zomertijd, dus de klok wordt
-- hier vergeleken en niet in het schema. Een melding die een half jaar
-- lang een uur te vroeg komt is een melding die niemand meer leest.
--
-- ── Eén keer per klus per dag ──
-- De cron draait elk kwartier; zonder deze grendel zou dezelfde klus
-- twaalf keer voorbijkomen. Er is bewust geen herinnering later op de
-- dag: wie om half negen niet reageert, doet dat om tien uur ook niet,
-- en de tweede melding leert mensen alleen de eerste weg te tikken.

create or replace function public.meld_niet_gestarte_klussen()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_lokaal timestamp := (now() at time zone 'Europe/Amsterdam');
  v_dag    date      := v_lokaal::date;
  v_aantal integer   := 0;
begin
  if v_lokaal::time < time '08:30' then return 0; end if;
  -- Zondag wordt er niet gewerkt, dus valt er ook niets te melden.
  if extract(isodow from v_dag) = 7 then return 0; end if;

  with stil as (
    select w.id, w.tenant_id, w.adres,
           coalesce(
             (select string_agg(pe.naam, ' en ' order by pe.naam)
                from public.werkbon_medewerkers wm
                join public.personen pe on pe.id = wm.persoon_id
               where wm.werkbon_id = w.id),
             'niemand ingepland'
           ) as ploeg
      from public.werkbonnen w
     where w.opgeleverd_op is null
       and w.stilgelegd_op is null
       and w.status is distinct from 'voltooid'
       -- Loopt vandaag: dezelfde regel als looptOp() in de app.
       and coalesce(w.geplande_start, w.datum) <= v_dag
       and coalesce(w.geplande_eind, w.geplande_start, w.datum) >= v_dag
       -- Er is vandaag niemand ingeklokt.
       and not exists (
         select 1 from public.werkdag_logs l
          where l.werkbon_id = w.id and l.datum = v_dag
       )
       -- En er is vandaag nog niet over gemeld.
       and not exists (
         select 1 from public.meldingen m
          where m.soort = 'klus_niet_gestart'
            and m.werkbon_id = w.id
            and (m.created_at at time zone 'Europe/Amsterdam')::date = v_dag
       )
  ),
  verstuurd as (
    insert into public.meldingen (tenant_id, voor_profile_id, soort, tekst, werkbon_id)
    select s.tenant_id, pr.id, 'klus_niet_gestart',
           'Nog niet gestart om 08:30 — ' || coalesce(s.adres, 'onbekend adres') ||
             ' (' || s.ploeg || ')',
           s.id
      from stil s
      join public.profiles pr
        on pr.tenant_id = s.tenant_id
       and pr.rol in ('eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner')
    returning 1
  )
  select count(*) into v_aantal from verstuurd;

  return v_aantal;
end;
$$;

revoke execute on function public.meld_niet_gestarte_klussen() from public, anon, authenticated;

comment on function public.meld_niet_gestarte_klussen() is
  'Meldt klussen die vandaag lopen maar om 08:30 nog niet zijn aangemeld, aan iedereen boven een zwamsaneerder. Eén keer per klus per dag.';

-- Elk kwartier in de ochtend; de functie beslist zelf of het al tijd
-- is. Het venster loopt door tot 09:00 UTC zodat het ook in de winter
-- ruim na half negen Nederlandse tijd valt.
select cron.unschedule('klus-niet-gestart')
 where exists (select 1 from cron.job where jobname = 'klus-niet-gestart');

select cron.schedule(
  'klus-niet-gestart',
  '*/15 5-9 * * 1-6',
  $cron$ select public.meld_niet_gestarte_klussen(); $cron$
);

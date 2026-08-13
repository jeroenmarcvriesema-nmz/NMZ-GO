-- ============================================================
-- NMZ GO — Migratie 031: een werkdag die niet wordt afgemeld
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Een werkdag start met een druk op de knop en stopt met een tweede.
-- Die tweede blijft geregeld uit: de telefoon gaat in de zak, de bus
-- rijdt weg, en de rij in `werkdag_logs` blijft openstaan. Zo'n rij is
-- daarna waardeloos — `usePersoonDetail` slaat een log zonder stoptijd
-- over, dus die dag telt voor nul uren, en op het dashboard staat
-- iemand tot in de nacht "aan het werk".
--
-- Op 12 augustus stond de werkdag van Jeffrey nog open om zeven uur
-- 's avonds, en die van 10 augustus stond er al twee dagen bij.
--
-- Vanaf nu wordt zo'n dag om 17:00 dichtgezet. Dat is een aanname en
-- geen meting, en daarom staat het er ook bij: `automatisch_afgesloten`
-- maakt het verschil zichtbaar tussen "hij heeft afgemeld" en "de
-- computer heeft het dichtgezet". Zonder die kolom zou niemand later
-- nog kunnen zien welke uren echt zijn opgeschreven.
--
-- Wat dit **niet** is: urenregistratie. Er komt geen pauze, geen
-- correctie en geen goedkeuring bij — die grens uit migratie 006 blijft
-- staan. Dit repareert alleen het gat waarin een dag helemaal niet
-- meetelde.
--
-- Voegt alleen toe en werkt bestaande rijen bij. Veilig meerdere keren
-- uitvoerbaar (idempotent): een rij die al een stoptijd heeft, blijft
-- ongemoeid.
-- ============================================================

begin;

-- ── A. HERKOMST VAN DE STOPTIJD ───────────────────────────────

alter table public.werkdag_logs
  add column if not exists automatisch_afgesloten boolean not null default false;

comment on column public.werkdag_logs.automatisch_afgesloten is
  'Waar als de stoptijd door werkdagen_afsluiten() is gezet en niet door de '
  'medewerker zelf. Een aanname (17:00), geen meting — bij twijfel over uren '
  'is dit de kolom die dat vertelt.';


-- ── B. DE AFSLUITER ───────────────────────────────────────────
-- 17:00 in Amsterdamse tijd, niet in UTC: anders verschuift het
-- afsluitmoment een uur zodra de zomertijd omgaat, en dat is precies
-- het soort verschil waar niemand aan denkt tot het misgaat.

create or replace function public.werkdagen_afsluiten()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_aantal integer;
begin
  with af as (
    update public.werkdag_logs l
       set stop_tijd = greatest(
             (l.datum + time '17:00') at time zone 'Europe/Amsterdam',
             -- Wie ná vijven begon, krijgt zijn eigen starttijd. Een
             -- stoptijd vóór de starttijd weigert de check-constraint
             -- uit migratie 006, en terecht: dat zijn negatieve uren.
             l.start_tijd
           ),
           automatisch_afgesloten = true
     where l.stop_tijd is null
       -- Alleen dagen waarvan vijf uur al geweest is. De werkdag van
       -- vandaag om half drie 's middags blijft dus gewoon lopen.
       and ((l.datum + time '17:00') at time zone 'Europe/Amsterdam') <= now()
    returning 1
  )
  select count(*) into v_aantal from af;

  return v_aantal;
end;
$$;

comment on function public.werkdagen_afsluiten() is
  'Zet werkdagen die niet zijn afgemeld dicht op 17:00 (Europe/Amsterdam) van '
  'hun eigen datum. Idempotent: een tweede ronde vindt niets meer.';

-- Niemand met een account heeft hier iets te zoeken: dit hoort bij de
-- cron, niet bij een scherm. Zelfde lijn als de andere onderhoudsfuncties.
revoke execute on function public.werkdagen_afsluiten() from public, anon, authenticated;

commit;


-- ── C. DE CRON ────────────────────────────────────────────────
-- Elk uur, en niet één keer om 17:00. Twee redenen: de zomertijd
-- verschuift dat moment in UTC, en een ronde die één keer per dag
-- draait en dan uitvalt, laat een dag voor altijd openstaan. De
-- functie kijkt zelf of vijf uur al geweest is, dus vaker draaien
-- verandert de uitkomst niet — het maakt hem alleen minder afhankelijk
-- van één moment.

do $mig$
begin
  if exists (select 1 from cron.job where jobname = 'nmzgo-werkdagen-afsluiten') then
    perform cron.unschedule('nmzgo-werkdagen-afsluiten');
  end if;
  perform cron.schedule(
    'nmzgo-werkdagen-afsluiten',
    '5 * * * *',
    'select public.werkdagen_afsluiten();'
  );
end $mig$;


-- ── D. DE ACHTERSTAND ─────────────────────────────────────────
-- Wat er nu al openstaat, meteen dichtzetten. Zonder deze regel
-- blijven de dagen van vóór vandaag hangen tot de volgende ronde —
-- en zichtbaar is het verschil nul, want de cron doet hierna precies
-- hetzelfde.

select public.werkdagen_afsluiten() as nu_afgesloten;


-- ── E. VERIFICATIE ────────────────────────────────────────────

select 'openstaande werkdagen van voorbije dagen' as controle,
       (select count(*)::text from public.werkdag_logs
         where stop_tijd is null
           and ((datum + time '17:00') at time zone 'Europe/Amsterdam') <= now()) as gevonden,
       '0' as verwacht
union all
select 'de cron staat klaar',
       (select count(*)::text from cron.job where jobname = 'nmzgo-werkdagen-afsluiten'), '1'
union all
select 'niemand met een account mag de functie draaien',
       (select case when has_function_privilege('authenticated', 'public.werkdagen_afsluiten()', 'execute')
                    then 'NEE — authenticated mag het' else 'ja' end), 'ja';

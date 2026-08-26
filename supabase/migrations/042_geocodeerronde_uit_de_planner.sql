-- 042 — De geocodeerronde staat niet in de planner
--
-- Migratie 040 zette `nmzgo-geocoderen` elke tien minuten in de cron.
-- Toen de afstandsmeting werd geparkeerd tot de grondslag rond is, is
-- die ronde in de productiedatabase uit de planner gehaald — maar niet
-- in de repo. Daarmee liepen de twee uit elkaar op precies het soort
-- punt waar dat pijn doet: wie de database opnieuw zou opbouwen uit
-- deze migraties, kreeg de ronde er ongevraagd bij terug.
--
-- Deze migratie legt de werkelijkheid vast in plaats van andersom. De
-- functies blijven staan — `geocode_hartslag`, `afstand_meters`,
-- `locaties_opruimen` en `meld_afstand_bij_aanmelden` doen niets
-- zolang niemand ze aanroept, en ze weggooien zou betekenen dat een
-- latere proefronde opnieuw gebouwd moet worden.
--
-- `nmzgo-locaties-opruimen` blijft wél draaien. Die beschermt en doet
-- niets zolang er niets staat; hem weghalen zou betekenen dat een
-- latere proefronde geen bewaartermijn meer heeft.
--
-- Aanzetten is: deze ronde opnieuw inplannen, de vlag in de app
-- omzetten en de verwerker uitrollen. Drie handelingen, met opzet.

do $$
begin
  -- Idempotent: `cron.unschedule` gooit een fout als de taak er niet
  -- is, en deze migratie moet ook draaien op een database waar hij nooit
  -- heeft gestaan.
  if exists (select 1 from cron.job where jobname = 'nmzgo-geocoderen') then
    perform cron.unschedule('nmzgo-geocoderen');
  end if;
end;
$$;

comment on function public.geocode_hartslag() is
  'Geparkeerd. Staat bewust niet in de cron (migratie 042) tot de grondslag voor de afstandsmeting rond is. Aanzetten vraagt om opnieuw inplannen, de vlag in de app en een uitrol van de verwerker.';

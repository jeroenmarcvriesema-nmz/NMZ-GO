-- 019 — Hartslag op vijf minuten, en meer dan één triggerstatus
--
-- Ook deze twee wijzigingen zijn destijds rechtstreeks toegepast zonder
-- bestand in de repo. Hier alsnog vastgelegd, idempotent, zodat een
-- verse omgeving op dezelfde stand uitkomt.

-- ── Deel 1: de synchronisatie kijkt naar méér dan één status ──
--
-- De sync vroeg ClickUp alleen om taken met status "volgende week".
-- ClickUp schuift die in het weekend automatisch door naar "deze week",
-- en alles wat op dat moment nog niet was opgehaald werd daarmee
-- onzichtbaar voor NMZ GO. Zes werkbonnen stonden zo maandagochtend
-- nergens. Eén kolom in plaats van één waarde, zodat we beide statussen
-- tegelijk kunnen bevragen.
--
-- `trigger_status` blijft staan als terugvaloptie voor het geval de
-- lijst leeg is; de verwerker leest eerst `trigger_statussen`.

alter table public.clickup_instellingen
  add column if not exists trigger_statussen text[]
    not null default array['volgende week', 'deze week'];

comment on column public.clickup_instellingen.trigger_statussen is
  'Alle ClickUp-statussen die opgehaald worden. Leeg = terugvallen op trigger_status.';

-- ── Deel 2: de hartslag van tien naar vijf minuten ──
--
-- Tien minuten was merkbaar: iemand zet een klus klaar in ClickUp en
-- staat te wachten tot hij in NMZ GO verschijnt. Een ronde kost drie
-- seconden en downloadt niets zolang er niets nieuws is, dus vaker
-- kijken is bijna gratis. Buiten 04:00–19:00 UTC slaapt hij: er wordt
-- 's nachts niets ingepland.

do $mig$
begin
  if exists (select 1 from cron.job where jobname = 'nmzgo-clickup-hartslag') then
    perform cron.unschedule('nmzgo-clickup-hartslag');
  end if;
  perform cron.schedule(
    'nmzgo-clickup-hartslag',
    '*/5 4-19 * * *',
    'select public.clickup_hartslag();'
  );
end $mig$;

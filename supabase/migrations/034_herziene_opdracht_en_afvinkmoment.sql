-- 034 — Een herziene werkopdracht opnieuw kunnen lezen, en wanneer er
--       is afgevinkt
--
-- Twee kolommen die allebei een gat dichten dat pas zichtbaar werd toen
-- er iets op gebouwd werd.
--
-- ── werkbonnen.opdracht_datum ──
-- De synchronisatieronde slaat een bon met een opdracht_pad over: hij
-- haalt de PDF niet opnieuw op, en dat is met opzet — anders wordt bij
-- elke ronde vijfenveertig keer een PDF gedownload en ontleed. Gevolg
-- was wel dat een herziene opdracht nooit meer binnenkwam. Ging de
-- container daarin van 6 naar 10 kuub, dan bleef in NMZ GO 6 staan, en
-- op die 6 wordt besteld.
--
-- Hierin staat de datum die ClickUp aan de bijlage geeft. Die staat in
-- het taakantwoord dat we tóch al ophalen, dus vergelijken kost niets;
-- alleen als hij nieuwer is dan wat we hebben wordt de PDF opnieuw
-- gehaald.
--
-- ── taken.voltooid_op ──
-- Een punt wist of het af was, niet wannéér. Voor een activiteitenfeed
-- is dat precies het ontbrekende stuk: "om 10:14 afgevinkt" is een
-- gebeurtenis, "afgevinkt" is een toestand.
--
-- Blijft leeg voor alles wat vóór deze migratie is afgevinkt. Dat is
-- eerlijker dan er de tijd van de migratie in zetten — dan zou het
-- lijken alsof honderd punten tegelijk zijn afgevinkt.

alter table public.werkbonnen
  add column if not exists opdracht_datum timestamptz;

comment on column public.werkbonnen.opdracht_datum is
  'Datum die ClickUp aan de werkopdracht-bijlage geeft. Is de bijlage daar nieuwer, dan leest de synchronisatie de opdracht opnieuw.';

alter table public.taken
  add column if not exists voltooid_op timestamptz;

comment on column public.taken.voltooid_op is
  'Wanneer dit punt is afgevinkt. Leeg als het niet af is, en leeg voor alles van vóór migratie 034.';

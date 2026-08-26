-- 039 — De check op `werkbon_gebeurtenissen.soort` loopt weer gelijk
--       met wat de functies er daadwerkelijk in schrijven
--
-- Migratie 015 zette de gebeurtenissenlijst op met drie soorten:
-- 'stilgelegd', 'hervat' en 'opgeleverd'. Daarna zijn er zeven
-- handelingen bijgekomen die óók een regel in dat logboek schrijven,
-- zonder dat de check ooit is meegegroeid. Resultaat:
--
--   new row for relation "werkbon_gebeurtenissen"
--   violates check constraint "werkbon_gebeurtenissen_soort_check"
--
-- Dat is geen ontbrekende logregel maar een kapotte knop. De insert is
-- de laatste stap ín de functie, en een functie is één transactie: de
-- exception rolt de hele handeling terug. Kantoor zette dus een nieuwe
-- ploeg op de bon, kreeg een foutmelding, en de ploeg stond er niet op.
-- Hetzelfde voor de planning verzetten, een punt toevoegen of weghalen,
-- een container afvinken, en vervolgwerk melden of afronden.
--
-- De check blijft staan en gaat niet weg. Deze tabel is het dossier
-- waar je bij een discussie over uitloop of meerwerk op terugvalt, en
-- er wordt hard op `soort` gefilterd — een typfout betekent daar
-- stilzwijgend een gebeurtenis die niemand meer terugvindt. Wat wél
-- verandert is de volgorde van werken: wie een nieuwe soort in een
-- functie schrijft, zet hem hier in dezelfde migratie erbij.
-- `tests/migraties.test.ts` bewaakt dat vanaf nu in de CI.
--
-- Bestaande rijen hoeven niet opgeruimd te worden: er staan alleen
-- soorten in die al waren toegestaan — de rest is nooit binnengekomen.

alter table public.werkbon_gebeurtenissen
  drop constraint if exists werkbon_gebeurtenissen_soort_check;

alter table public.werkbon_gebeurtenissen
  add  constraint werkbon_gebeurtenissen_soort_check
  check (soort in (
    -- 015 — de bon zelf
    'stilgelegd',
    'hervat',
    'opgeleverd',
    -- 030 — wijzigen tijdens de klus
    'ploeg_gewijzigd',
    'planning_gewijzigd',
    'punt_toegevoegd',
    -- 032 — een punt weghalen
    'punt_verwijderd',
    -- 033 — container en dixi
    'voorziening',
    -- 035 — vervolgwerk is geen stilstand
    'vervolg_gemeld',
    'vervolg_afgerond'
  ));

comment on constraint werkbon_gebeurtenissen_soort_check
  on public.werkbon_gebeurtenissen is
  'Schrijf je een nieuwe soort in een functie? Zet hem hier in dezelfde migratie erbij. De insert is de laatste stap in die functies, dus een ontbrekende soort rolt de hele handeling terug in plaats van alleen de logregel. tests/migraties.test.ts bewaakt dit.';

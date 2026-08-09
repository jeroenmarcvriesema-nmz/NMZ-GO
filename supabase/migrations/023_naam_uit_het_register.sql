-- 023 — De naam uit het personenregister, niet uit het mailadres
--
-- Het begroetingsscherm zei "Goedemorgen, jeroenmarcvriesema". Dat komt
-- doordat oudere accounts hun naam uit het mailadres kregen: alles vóór
-- de apenstaart. Voor het eerste account was er ook geen alternatief —
-- het personenregister bestond nog niet.
--
-- Sinds migratie 014 doet `handle_new_user()` het al goed: staat er een
-- persoon op de uitnodiging, dan wint die naam. Iedereen die vanaf nu
-- wordt uitgenodigd krijgt dus gewoon "Jeffrey" of "Sami", precies zoals
-- hij in ClickUp staat. Alleen de accounts van daarvóór hangen nog aan
-- hun mailadres.
--
-- Deze migratie haalt die in. Bewust met een strenge voorwaarde: alleen
-- wanneer de huidige naam letterlijk het stuk vóór de apenstaart is.
-- Wie een echte naam heeft — zelf ingevuld of door een beheerder gezet —
-- houdt die. Een migratie die namen overschrijft die iemand bewust heeft
-- gekozen is erger dan de kwaal.

update public.profiles p
   set naam = pe.naam
  from public.personen pe
 where pe.profile_id = p.id
   and p.email is not null
   and p.naam = split_part(p.email, '@', 1)
   and pe.naam is not null
   and btrim(pe.naam) <> '';

comment on column public.profiles.naam is
  'De naam zoals hij op het scherm staat. Komt bij een uitnodiging uit '
  'personen.naam — dat is de naam waaronder iemand in ClickUp bekend is — '
  'en valt alleen terug op het mailadres als er niets anders is.';

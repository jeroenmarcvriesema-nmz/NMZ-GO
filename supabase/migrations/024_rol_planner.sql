-- 024 — De planner als eigen rol
--
-- Anthony plant. Dat is geen bijrol van een uitvoerder maar zijn vak:
-- hij zet de week in elkaar, schuift bij als er iets stilvalt, en is
-- degene die het merkt als twee ploegen op hetzelfde adres staan.
--
-- Qua bevoegdheden is hij gelijk aan een uitvoerder en een
-- werkvoorbereider: alles rond het werk inzien en wijzigen, niets rond
-- accounts. Hem daarom "uitvoerder" noemen zou werken maar liegen — en
-- dan staat er straks op zijn scherm en in elke lijst een vak dat hij
-- niet doet. Een rol kost hier één regel; een verkeerde naam kost
-- uitleg, elke keer weer.
--
-- Dat dit één regel is, is precies waarom de policies op bevoegdheid
-- toetsen en niet op rolnaam. Was dat niet zo, dan raakte deze migratie
-- alle zevenenveertig policies.

alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add  constraint profiles_rol_check
  check (rol in ('eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner', 'medewerker'));

-- Werkbonnen maken en wijzigen, alles inzien, zoeken, plannen.
create or replace function public.mag_werk_beheren()
  returns boolean language sql stable security definer set search_path = public
as $$
  select public.get_mijn_rol() in
    ('eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner');
$$;

-- mag_gebruikers_beheren() blijft ongemoeid: een planner beheert geen
-- accounts, deelt geen rollen uit en reset geen wachtwoorden.

-- De uitnodiging mag de rol ook uitdelen. 'eigenaar' blijft er bewust
-- buiten — die rol is niet uit te nodigen.
alter table public.uitnodigingen drop constraint if exists uitnodigingen_rol_check;
alter table public.uitnodigingen add  constraint uitnodigingen_rol_check
  check (rol in ('beheerder', 'uitvoerder', 'werkvoorbereider', 'planner', 'medewerker'));

comment on constraint profiles_rol_check on public.profiles is
  'Zes rollen. Planner heeft dezelfde bevoegdheden als uitvoerder en '
  'werkvoorbereider; het verschil is het vak, niet het rechtenniveau.';

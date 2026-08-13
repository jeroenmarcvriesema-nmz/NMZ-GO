-- ============================================================
-- NMZ GO — Migratie 030: storingen zijn alleen voor de eigenaar
-- ============================================================
-- De crashes van de app (tabel `fouten`, migratie 021) stonden open
-- voor iedereen die werk mag beheren: eigenaar, beheerder, uitvoerder,
-- werkvoorbereider en planner. Vijf rollen dus.
--
-- Dat was ruimer dan bedoeld. Een stacktrace is beheer van het
-- gereedschap en geen operationele informatie: een uitvoerder die zijn
-- week inplant heeft er niets aan, en er staat in wat er misging op het
-- toestel van een collega — pad, browser, en de naam van degene bij wie
-- het gebeurde. Dat hoort bij één persoon.
--
-- Het scherm is verhuisd naar een eigen pagina met een route-guard,
-- maar een guard is gemak en geen beveiliging: `fouten` is met de
-- ingelogde sleutel rechtstreeks te bevragen. Zonder deze migratie zou
-- het wegstoppen van de pagina niets betekenen.
--
-- `public.is_eigenaar()` bestaat al sinds migratie 008 en werd tot nu
-- toe nergens gebruikt. Geen nieuwe functie dus, en geen tweede
-- rollenmodel ernaast.
--
-- Wat er níét verandert:
--   - melden blijft voor elke ingelogde gebruiker (fouten_insert_eigen),
--     want de app meldt vanaf het toestel waar het misging en die
--     gebruiker is zelden de eigenaar;
--   - opruimen blijft bij wie gebruikers beheert (fouten_delete_beheer).
--
-- Wijzigt alleen een policy. Geen tabellen, kolommen of data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- De oude, ruimere leespolicy eruit. Bij naam, want een `create or
-- replace` bestaat niet voor policies en twee policies naast elkaar
-- zijn een OR: dan zou de ruimere blijven gelden.
drop policy if exists fouten_select_kantoor on public.fouten;
drop policy if exists fouten_select_eigenaar on public.fouten;

create policy fouten_select_eigenaar on public.fouten
  for select to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.is_eigenaar());

comment on table public.fouten is
  'Crashes uit de app, gemeld door de client zelf. Melden mag iedereen die '
  'is ingelogd; lezen alleen de eigenaar (zie /storingen).';

commit;

-- ── Controle ─────────────────────────────────────────────────
-- Verwacht: precies één select-policy op `fouten`, en die toetst op
-- is_eigenaar(). Draai dit na het toepassen.
--
--   select polname, pg_get_expr(polqual, polrelid) as voorwaarde
--     from pg_policy
--    where polrelid = 'public.fouten'::regclass and polcmd = 'r';

# TESTING.md — Kwaliteitsproces

Dit document is de operationele checklist voor het valideren van werk aan NMZ GO. Het herhaalt (in meer detail) de build-/testafspraken uit `CLAUDE.md` en `GIT_WORKFLOW.md` zodat er één plek is om vlak vóór het afronden van een taak te raadplegen.

---

## Geautomatiseerde tests

Sinds de audit is er een testrunner: **Vitest**, met `npm test` (of `npm run controle` voor typecheck + tests in één). Stand op 14 augustus 2026: **198 tests in 14 bestanden, allemaal groen.** De tests staan in `tests/` en draaien in Node — er zit bewust geen enkele test in die een browser of een database nodig heeft.

Wat er getest wordt is niet willekeurig gekozen. Het is de pure logica op de plekken waar aantoonbaar fouten zaten:

| Bestand | Wat het bewaakt |
| --- | --- |
| `tests/ontleden.test.ts` | De werkopdracht-parser: ankers, opsommingstekens, doorlopende zinnen, genummerde punten, het lege kluiscode-veld dat het kopje eronder opslokte. |
| `tests/opdracht.test.ts` | `controleerDocument()`: welk bestand als werkopdracht of werktekening geaccepteerd wordt. |
| `tests/planning.test.ts` | `kiesVandaag()` (gaf ooit het adres van de klus die het verst weg lag), weekberekening, en `isoDatum()` dat in UTC de dag ervóór teruggaf. |
| `tests/klusstand.test.ts` | `klusstand()`: de afgeleide stand van een klus, de enige bron van de kleurtaal. |
| `tests/klusgroepen.test.ts` | Het groeperen van losse bonnen tot klusgroepen op de projectenpagina. |
| `tests/statusregels.test.ts` | Van een vrije reden naar de juiste ClickUp-status, inclusief de voorrang van asbest. |
| `tests/voorzieningen.test.ts` | Containers en dixi's: besteld/afgemeld en wat dat voor de kaart betekent. |
| `tests/bestelstand.test.ts` | De bestelstand van een voorziening: wat er besteld is, wat nog moet, en wat afgemeld is. |
| `tests/rollen.test.ts` | Het menu tegen de routes: geen knop die de gebruiker terugstuurt. Zie `src/lib/rollen.ts`. |
| `tests/zoeken.test.ts` | Het zoekveld over de tien velden waar het in kijkt. |
| `tests/taakid.test.ts` | Het taak-id uit een geplakte ClickUp-link halen. |
| `tests/export.test.ts` | De CSV-export: puntkomma, BOM, en velden met een puntkomma of aanhalingsteken erin. |
| `tests/foutfilter.test.ts` | Rommel van browserextensies buiten de storingenlijst houden. |
| `tests/uploadfout.test.ts` | Een mislukte foto-upload vertalen naar mensentaal. |

Elke test hoort bij een fout die echt is voorgekomen. Voeg je er een toe, houd die regel dan aan: een test die nooit iets had kunnen vangen, vangt straks ook niets.

**Let op het verschil tussen de commando's.** `npm run build` typecheckt bewust alleen `src/`; `npm run controle` en de CI doen ook `tests/`. Een fout in een test hoort geen uitrol tegen te houden.

`.github/workflows/controle.yml` draait bij elke push `tsc --noEmit`, `npm test` en een productiebuild. Er staan geen sleutels in die workflow en dat blijft zo — hij praat niet met Supabase of ClickUp.

**Wat automatisch testen hier níet dekt:** alles wat door RLS, Storage of ClickUp loopt. Daar is de handmatige procedure hieronder voor, plus `supabase/tests/rollentest.sql`.

---

## Handmatige testprocedure

De geautomatiseerde tests dekken de rekenkundige kant; de procedure hieronder dekt de rest en blijft verplicht bij elke taak:

1. **Build-check:** `npm run build` slaagt zonder TypeScript- of build-fouten.
2. **Dev-server-check:** `npm run dev`, en de betrokken flow handmatig doorlopen in de browser.
3. **Beide kanten van de rolgrens testen** waar relevant: elke wijziging aan gedeelde componenten, hooks, routing of RLS-policies wordt getest als **kantoorrol én als medewerker**. Raakt de wijziging gebruikersbeheer of storingen, test dan ook de smallere sloten (beheerder vs. uitvoerder, eigenaar vs. de rest) — zie `src/lib/rollen.ts`.
4. **Volledige gebruikersflow doorlopen**, niet alleen het gewijzigde scherm in isolatie — bv. bij een wijziging aan taken: van inloggen, naar werkbon openen, taak afvinken, foto uploaden, tot terug naar het overzicht.
5. **Randgevallen:**
   - Lege staten (geen werkbonnen, geen taken, geen medewerkers).
   - Een mislukte Supabase-call (bv. door tijdelijk een ongeldige ID te gebruiken).
   - Een niet-geautoriseerde rol die een beheerder-route probeert te openen.
   - Trage/haperende verbinding (relevant voor foto-upload door medewerkers in het veld).
6. **Responsiveness:** de flow op mobiele breedte (device of browser-simulatie) én op desktop-breedte.
7. **Console-check:** geen onverwachte errors/warnings die aan de wijziging te wijten zijn.
8. **Routing-check:** nieuwe/gewijzigde routes zijn correct toegevoegd in `App.tsx` én in `ROUTE_SLOT` in `src/lib/rollen.ts`, met het juiste slot (`kantoor`/`gebruikersbeheer`/`eigenaar`/`ingelogd`), geen dode of dubbele route. `tests/rollen.test.ts` houdt het menu hiertegenaan — een route die je alleen in `App.tsx` zet, laat die test vallen.
9. **Import-check:** geen ongebruikte imports, geen gebroken `@/`-paden, geen circulaire imports.
10. **Thema-check:** het gewijzigde scherm bekijken in **licht én donker**. Beide thema's zijn volledig uitgerold en gelijkwaardig; light is de standaard. Elke nieuwe kleur krijgt een `dark:`-variant — controleer vooral tinten die in donkere modus dichter bij elkaar komen te liggen (zie `PRODUCT_VISION.md`).

---

## Build procedure

- **Development:** `npm run dev` (Vite dev server, standaard `http://localhost:5173`). Vereist `.env.local` met `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`.
- **Build:** `npm run build` → `tsc` (typecheck) gevolgd door `vite build`. **Beide stappen moeten slagen.**
- **Preview:** `npm run preview` om de productiebuild lokaal te bekijken.
- Zie `DEPLOYMENT.md` voor hoe de build zich verhoudt tot de daadwerkelijke Netlify-deploy.

---

## Definition of Done

Een wijziging is pas "klaar" als:

1. `npm run build` slaagt zonder TypeScript- of build-fouten.
2. De betrokken flow is handmatig getest volgens de procedure hierboven, inclusief happy path én minstens één randgeval.
3. Beide rollen zijn gecheckt waar relevant (beheerder + medewerker).
4. Mobiel én desktop zijn gecontroleerd op responsiveness.
5. Geen console errors/warnings die aan de wijziging zelf te wijten zijn.
6. RLS-policies kloppen als de database is aangeraakt: geen recursieve policies, geen overbroad-condities, idempotente migratie.
7. Elke nieuwe Supabase-call heeft foutafhandeling — geen onbehandelde promise, geen oneindige loading state.
8. Routing en imports zijn gecontroleerd.
9. `CHANGELOG.md` is bijgewerkt bij een zichtbare of functionele wijziging.
10. Geen losse debug-code (`console.log`, tijdelijke debug-UI, achtergebleven TODO's).
11. Geen duplicate componenten geïntroduceerd waar een bestaande component (zie `COMPONENT_LIBRARY.md`) uitgebreid had kunnen worden.
12. Bij een wijziging over meerdere bestanden: er was eerst een kort implementatieplan.

---

## Release checklist

Te doorlopen vóór het samenvoegen van een sprint-checkpoint naar `main` (zie `SPRINTS.md`/`DEPLOYMENT.md`):

- [ ] Alle taken binnen de sprint voldoen individueel aan de Definition of Done hierboven.
- [ ] `npm run build` slaagt op de uiteindelijke, samengevoegde stand (niet alleen per losse taak).
- [ ] Volledige regressietest van de kernflows: inloggen (beide rollen), werkbon aanmaken (beheerder), taak afvinken + foto uploaden (medewerker), uitloggen.
- [ ] Nieuwe/gewijzigde Supabase-migraties zijn handmatig uitgevoerd en geverifieerd op de gebruikte Supabase-omgeving (zie README/`DEPLOYMENT.md`).
- [ ] Environment-variabelen zijn compleet en correct ingesteld in de Netlify-omgeving, niet alleen lokaal.
- [ ] `CHANGELOG.md` bevat een samenvatting van deze sprint/release.
- [ ] `SPRINTS.md` is bijgewerkt met het nieuwe sprint-checkpoint (zie `SPRINTS.md` → Sprintwerkwijze).
- [ ] Geen openstaande `console.log`/debug-code in de samengevoegde stand.
- [ ] Geen achtergebleven `.env`-waarden, keys of andere secrets in gecommitte bestanden.

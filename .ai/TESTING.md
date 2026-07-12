# TESTING.md — Kwaliteitsproces

Dit document is de operationele checklist voor het valideren van werk aan NMZ GO. Het herhaalt (in meer detail) de build-/testafspraken uit `CLAUDE.md` en `GIT_WORKFLOW.md` zodat er één plek is om vlak vóór het afronden van een taak te raadplegen.

---

## Handmatige testprocedure

Er is **geen geautomatiseerde testsuite** in dit project (geen test-runner in `package.json` — zie `ARCHITECTURE.md`/`ROADMAP.md`). Kwaliteitsborging loopt volledig via deze handmatige procedure, verplicht bij elke taak:

1. **Build-check:** `npm run build` slaagt zonder TypeScript- of build-fouten.
2. **Dev-server-check:** `npm run dev`, en de betrokken flow handmatig doorlopen in de browser.
3. **Beide rollen testen** waar relevant: elke wijziging aan gedeelde componenten, hooks, routing of RLS-policies wordt getest als **zowel beheerder als medewerker**.
4. **Volledige gebruikersflow doorlopen**, niet alleen het gewijzigde scherm in isolatie — bv. bij een wijziging aan taken: van inloggen, naar werkbon openen, taak afvinken, foto uploaden, tot terug naar het overzicht.
5. **Randgevallen:**
   - Lege staten (geen werkbonnen, geen taken, geen medewerkers).
   - Een mislukte Supabase-call (bv. door tijdelijk een ongeldige ID te gebruiken).
   - Een niet-geautoriseerde rol die een beheerder-route probeert te openen.
   - Trage/haperende verbinding (relevant voor foto-upload door medewerkers in het veld).
6. **Responsiveness:** de flow op mobiele breedte (device of browser-simulatie) én op desktop-breedte.
7. **Console-check:** geen onverwachte errors/warnings die aan de wijziging te wijten zijn.
8. **Routing-check:** nieuwe/gewijzigde routes zijn correct toegevoegd in `App.tsx`, met het juiste guard-type (`BeheerderGuard`/`AuthGuard`), geen dode of dubbele route.
9. **Import-check:** geen ongebruikte imports, geen gebroken `@/`-paden, geen circulaire imports.
10. **Thema-check:** zolang er geen volledig dark-mode-systeem is uitgerold (zie `PRODUCT_VISION.md`), controleren dat er geen onbedoelde `dark:`-variants zijn geïntroduceerd en dat het bestaande lichte thema consistent blijft.

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

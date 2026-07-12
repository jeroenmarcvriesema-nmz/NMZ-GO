# SPRINTS.md — Sprintwerkwijze en sprintlog

## Sprintwerkwijze

Dit project ontwikkelt in **sprints**. Een sprint-checkpoint markeert een punt waarop de app **aantoonbaar werkt**, niet zomaar een verzameling losse commits.

- **Elke sprint werkt richting een "werkende versie"-checkpoint**: aan het einde van een sprint bouwt de app zonder fouten, en zijn de kernflows van beide rollen (beheerder + medewerker) handmatig doorlopen (zie `GIT_WORKFLOW.md` → Testprocedure).
- **Sprintnummering** volgt `Sprint <major>.<minor>` in de commit-boodschap van het checkpoint (bv. `Sprint 2.1 werkende versie`). Tussentijdse commits binnen een sprint mogen kleiner en incrementeel zijn; het sprint-checkpoint zelf is altijd een bouwbare, geteste stand.
- **Scope per sprint is begrensd**: een sprint pakt een afgebakend stuk functionaliteit (bv. "planningscherm", "projectdetail"), geen mix van ongerelateerde wijzigingen door elkaar.
- **Geen sprint-checkpoint committen met een falende build** — als `npm run build` niet slaagt, is de sprint niet klaar.
- Bij het starten van een nieuwe sprint: lees eerst de laatste sprint-checkpoint-commit en `CHANGELOG.md` (projectroot) om te begrijpen wat de actuele, werkende stand van de app is voordat je verder bouwt.
- Werk deze log bij zodra een sprint-checkpoint wordt gecommit — kort: wat is toegevoegd/gefixed, wat is de status.

> **Let op over dit logboek:** de git-geschiedenis van dit project bevat op het moment van schrijven één zichtbare checkpoint-commit (`Sprint 2.1 werkende versie`). Eerdere sprints (bv. wat tot "2.0" of "2.1" leidde) zijn niet reconstrueerbaar uit de huidige git-historie — vermoedelijk is eerdere geschiedenis samengevoegd of niet los gecommit. De log hieronder begint bij wat daadwerkelijk verifieerbaar is uit `git log` en `CHANGELOG.md`, niet uit aannames.

---

## Sprintlog

### MVP / v1.0.0 — basis werkend (zie `CHANGELOG.md`)

Bevestigd werkend na deze release:
- Login met Supabase Auth, sessieherstel bij refresh, logout.
- Rolgebaseerde redirect (beheerder → dashboard, medewerker → mijn werkbonnen).
- RLS: medewerker ziet alleen eigen werkbonnen, beheerder ziet alles.

Kritieke fixes in deze release:
- **Auth race condition** opgelost via één centrale `AuthInitializer` (zie `ARCHITECTURE.md` → Auth-architectuur).
- **RLS infinite recursion (`42P17`)** opgelost via `SECURITY DEFINER`-functie `get_mijn_rol()`.
- **`werkbon_medewerkers`**-policy gesplitst in aparte `INSERT`/`DELETE` met correcte `WITH CHECK`.
- **`uitnodigingen_update`**-policy beperkt (was `or true`).
- Debug-`console.log`-statements (51 stuks) en debug-UI verwijderd uit productiecode.

### Sprint 2.1 — werkende versie (commit `977effd`)

Laatste gecommitte, geteste checkpoint op het moment van schrijven van deze documentatie. Details van wat specifiek in deze sprint is toegevoegd t.o.v. de MVP-release zijn niet apart gedocumenteerd in `CHANGELOG.md` — bij een volgende sprint-checkpoint wordt aanbevolen `CHANGELOG.md` bij te werken met de functionele delta van elke sprint, zodat dit sprintlog daarop kan voortbouwen.

### Sprint 3 — Projecten & Planning (mock-data scope)

Vervolg op de hierboven genoemde "sprint in uitvoering": die stand bleek middenin een afgebroken restyling van `Sidebar.tsx`/`MobileNav.tsx` te zitten, waardoor de build niet meer slaagde. Sprint 3 is afgerond met de volgende scope-beslissing: **alleen de UI afmaken en testen op mock data** — een echte `projecten`-databasetabel, migratie en RLS blijven bewust een volgende sprint (zie `FEATURE_BACKLOG.md`).

Opgeleverd:
- Build hersteld (`Sidebar.tsx`/`MobileNav.tsx` afgemaakt met het donkere navthema, "Projecten"/"Planning" toegevoegd aan beide navigaties).
- Projectenoverzicht, projectdetail en weekplanning volledig bruikbaar op mock data.
- Projectdetail → Planning-tab toont echte (mock) ingeplande dagen; "Medewerkers koppelen" werkt functioneel in-memory.
- Visuele audit tegen `PRODUCT_VISION.md`/`UI_GUIDELINES.md` uitgevoerd: lege-staat op Projecten gecorrigeerd (emoji → Tabler-icoon + uitleg + actie), hover-transities op Planning verfijnd. Dashboard bleek al compliant.
- `npm run build` slaagt.

Bewust niet in deze sprint: echte `projecten`-tabel/migratie/RLS, dark-mode-uitrol. Zie `CHANGELOG.md` voor het volledige overzicht.

**Testkanttekening:** volledige geauthenticeerde browser-doorloop kon niet automatisch worden uitgevoerd (geen Supabase-testcredentials en geen browser-automatiseringstool beschikbaar in deze omgeving zonder een nieuwe dependency te installeren). Geverifieerd is: een schone productie-build (`tsc` + `vite build`, alle modules), een dev-server-smoketest, en een grondige handmatige codereview van elk gewijzigd bestand. Een menselijke doorloop van de kernflows (zie `TESTING.md`) wordt aanbevolen vóór het sprint-checkpoint als definitief "werkend" wordt gemarkeerd.

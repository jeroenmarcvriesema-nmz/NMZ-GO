# DEPLOYMENT.md — Git workflow, build, productie en rollback

Voor de volledige commit-/code-conventies zie [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md) en [`CODING_STANDARDS.md`](./CODING_STANDARDS.md). Dit document richt zich specifiek op de weg van code naar productie.

---

## Git workflow (overzicht)

- `main` is de enige beschermde branch en moet **altijd** deploybaar zijn — Netlify bouwt automatisch vanaf `main`.
- Werk voor iets groter dan een triviale fix in een kortlevende branch (`feature/<korte-naam>`, `fix/<korte-naam>`), merge terug via een PR of expliciete review.
- Commit messages: kort, imperatief, met prefix waar zinvol (`fix:`, `feat:`, `refactor:`, `chore:`, `docs:`); kritieke fixes gemarkeerd als `[CRITICAL FIX]` (zie `CHANGELOG.md`).
- Sprint-checkpoints worden gecommit als een bouwbare, geteste stand (zie `SPRINTS.md`).
- Volledige regels: `--force`-verbod, geen `--no-verify`, geen destructieve git-acties zonder bevestiging — zie `GIT_WORKFLOW.md` en `CLAUDE.md` → Verboden acties.

## Branches

| Branch(type) | Doel |
|---|---|
| `main` | Enige productiebranch. Netlify bouwt hiervandaan. Moet altijd groen zijn (`npm run build` slaagt). |
| `feature/<naam>` | Nieuwe functionaliteit, samengevoegd na review/test. |
| `fix/<naam>` | Bugfixes, inclusief kritieke fixes (auth/RLS/data). |

Er is (nog) geen aparte `staging`/`develop`-branch — de app is klein genoeg dat sprint-checkpoints direct op `main` landen na handmatige verificatie (zie `TESTING.md` → Release checklist). Als de teamgrootte of releasefrequentie toeneemt, is een staging-branch een bewuste, apart te bespreken uitbreiding (zie `ROADMAP.md`).

---

## Build

- **Commando:** `npm run build` → `tsc` (typecheck, geen emit) gevolgd door `vite build`.
- **Output:** `dist/` — statische assets, klaar voor hosting.
- **Vereiste omgevingsvariabelen tijdens build:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Vite bakt deze in tijdens de build — ze moeten dus in de build-omgeving aanwezig zijn, niet pas at runtime).
- Zie `TESTING.md` → Build procedure voor de lokale ontwikkel-/previewstappen.

---

## Productie

- **Hosting:** Netlify, geconfigureerd via `netlify.toml`:
  - Build command: `npm run build`
  - Publish directory: `dist`
  - SPA-redirect: alle routes (`/*`) vallen terug op `index.html` met status 200, zodat client-side routing (`react-router-dom`) correct werkt bij directe URL's/refreshes.
- **Trigger:** een push/merge naar `main` triggert een nieuwe Netlify-build en -deploy.
- **Environment-variabelen in productie:** worden apart in de Netlify-projectinstellingen ingesteld (niet uit `.env.local`, dat bestand wordt niet gecommit). Bij het toevoegen van een nieuwe env-variabele: **altijd** ook de Netlify-omgeving bijwerken, anders faalt of misgedraagt de productiebuild stil.
- **Edge functions** (`supabase/functions/`) staan los van de Netlify-deploy en worden **apart** naar Supabase gezet. Een wijziging in `verwerker/` of `opdracht-lezen/` is dus pas live ná zo'n deploy, ook al staat de code op `main`. Let op de padopbouw: `opdracht-lezen/index.ts` importeert `../verwerker/werkopdracht.ts`, dus de bestanden gaan mee met hun map ervoor (`opdracht-lezen/index.ts`, `verwerker/werkopdracht.ts`, `verwerker/ontleden.ts`) en het startpunt is `opdracht-lezen/index.ts`. Plat aanleveren breekt die import. De parser staat bewust op één plek: twee kopieën lopen uit de pas en dan geeft dezelfde opdracht twee verschillende takenlijsten.
- **Database/storage** (Supabase) is een aparte, niet-Netlify-beheerde omgeving — migraties en storage-bucket-configuratie worden **handmatig** uitgevoerd via de Supabase SQL Editor / dashboard (zie README in de projectroot), niet automatisch bij een Netlify-deploy.
- **Vóór elke productie-waardige merge naar `main`:** doorloop de Release checklist in `TESTING.md`.

---

## Rollback

Er is geen geautomatiseerde rollback-pipeline; rollback verloopt via Netlify en git, met deze voorkeursvolgorde:

1. **Netlify-deploy terugzetten (snelste, voorkeursoptie voor een productie-incident):** in het Netlify-dashboard naar de vorige, bekend-werkende deploy gaan en die opnieuw publiceren ("publish deploy"). Dit herstelt de frontend onmiddellijk zonder een nieuwe git-actie, en is niet-destructief voor de git-geschiedenis.
2. **Revert-commit op `main` (voorkeur boven het herschrijven van geschiedenis):** `git revert <commit>` voor de probleemcommit(s), gevolgd door een normale push — dit triggert een nieuwe, correcte Netlify-build. Geen `git reset --hard` + force-push op `main` (zie `CLAUDE.md` → Verboden acties).
3. **Database-wijzigingen zijn apart en vaak niet zomaar terug te draaien.** Een migratie die averechts uitpakt, wordt niet "rollback" via een oude migratie-file terugzetten (migraties zijn append-only, zie `ARCHITECTURE.md` → Database) — er wordt een **nieuwe, corrigerende migratie** geschreven die het probleem herstelt. Bij dataverlies-risico: eerst overleg met de gebruiker vóór enige corrigerende actie tegen een gedeelde/productie Supabase-omgeving.
4. **Na een rollback:** incident kort vastleggen in `CHANGELOG.md` (wat ging mis, wat is de fix/rollback-actie) en, indien het een architecturale les oplevert, de relevante `.ai/`-documentatie bijwerken (bv. een nieuwe regel in `CLAUDE.md` → Verboden acties als het een herhaalbare valkuil betreft).

**Belangrijk:** elke rollback-actie tegen productie (Netlify of Supabase) wordt vooraf expliciet met de gebruiker bevestigd, tenzij de gebruiker autonoom incident-response al heeft geautoriseerd — zie `CLAUDE.md` en de algemene regels rond risicovolle acties.

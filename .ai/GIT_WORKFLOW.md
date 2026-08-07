# GIT_WORKFLOW.md — Branching, commits, build en testprocedure

## Git workflow

- `main` is de enige beschermde branch en moet altijd deploybaar zijn (Netlify bouwt vanaf `main`).
- Werk voor iets groter dan een triviale fix in een kortlevende branch (`feature/<korte-naam>`, `fix/<korte-naam>`), en merge terug via een PR of expliciete review.
- **Commit messages:** kort, imperatief, beschrijf het *waarom*, niet alleen het *wat*. Gebruik prefixen waar zinvol: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`. Kritieke fixes (auth, RLS, data-integriteit) worden duidelijk gemarkeerd, zoals `[CRITICAL FIX]` in `CHANGELOG.md`.
- **Nooit** `--force` pushen naar `main`, nooit `--no-verify`, nooit destructieve git-commando's (`reset --hard`, `clean -f`, branch-verwijdering) zonder expliciete bevestiging van de gebruiker.
- Migraties die al zijn uitgevoerd op een omgeving: nooit aanpassen in een latere commit — altijd een nieuwe migratie (zie `ARCHITECTURE.md` → Database).
- `CHANGELOG.md` wordt bijgewerkt bij functionele wijzigingen, bugfixes en breaking changes — dit bestand is de leesbare geschiedenis voor het team, niet de ruwe `git log`.
- Zie `SPRINTS.md` voor hoe commits zich verhouden tot sprint-checkpoints.

---

## Build procedure

- **Development:** `npm run dev` (Vite dev server, standaard op `http://localhost:5173`). Vereist een `.env.local` met `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` (zie `.env.example`).
- **Build:** `npm run build` voert `tsc` (typecheck, geen emit) uit gevolgd door `vite build`. **Beide stappen moeten slagen** — een taak is nooit klaar als deze stap faalt.
- **Preview van een build:** `npm run preview`.
- **Deployment:** Netlify bouwt automatisch vanaf `main` met `npm run build` en publiceert `dist/` (zie `netlify.toml`). SPA-routing wordt afgehandeld via de `redirects`-regel naar `index.html`.
- **Vóór elke deploy-waardige wijziging:** controleer dat de vereiste env-variabelen zijn ingesteld in de Netlify-omgeving (niet alleen lokaal in `.env.local`), zeker bij het toevoegen van nieuwe env-variabelen.
- **Migraties zijn geen onderdeel van de app-build** — die worden apart, handmatig via de Supabase SQL Editor uitgevoerd (zie README in de projectroot). Een sessie voert zelf geen destructieve SQL uit tegen een gedeelde/productie Supabase-omgeving zonder expliciete bevestiging van de gebruiker.

---

## Testprocedure

Er is **geen geautomatiseerde testsuite** in dit project (geen test-runner in `package.json`). Kwaliteitsborging gebeurt via een **verplichte handmatige testprocedure** die bij elke taak wordt doorlopen voordat iets als afgerond geldt:

1. **Build-check:** `npm run build` slaagt zonder TypeScript- of build-fouten.
2. **Dev-server-check:** `npm run dev`, en de betrokken flow handmatig doorlopen in de browser.
3. **Beide rollen testen** waar relevant: iedere wijziging aan gedeelde componenten, hooks, routing of RLS-policies wordt getest als **zowel beheerder als medewerker**.
4. **Volledige gebruikersflow doorlopen**, niet alleen het gewijzigde scherm in isolatie — bv. bij een wijziging aan taken: van inloggen, naar werkbon openen, taak afvinken, foto uploaden, tot terug naar het overzicht.
5. **Randgevallen:** lege staten (geen werkbonnen, geen taken), een mislukte Supabase-call, en een niet-geautoriseerde rol die een beheerder-route probeert te openen.
6. **Responsiveness:** de flow op mobiele breedte (telefoon-simulatie of echt device) én op desktop-breedte.
7. **Console-check:** geen onverwachte errors/warnings die aan de wijziging te wijten zijn.
8. **Routing-check:** nieuwe/gewijzigde routes zijn correct toegevoegd in `App.tsx`, met het juiste guard-type, en er is geen dode of dubbele route achtergebleven.
9. **Import-check:** geen ongebruikte imports, geen gebroken `@/`-paden, geen circulaire imports geïntroduceerd.

Als een toekomstige sessie een geautomatiseerde testsuite introduceert, is dat een expliciete, apart besproken beslissing (zie `ROADMAP.md`) — niet iets dat stilzwijgend in een feature-taak wordt meegenomen.

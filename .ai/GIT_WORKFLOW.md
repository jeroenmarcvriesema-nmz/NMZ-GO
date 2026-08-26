# GIT_WORKFLOW.md — Branching, commits, build en testprocedure

## Git workflow

- `main` is de enige beschermde branch en moet altijd deploybaar zijn (Netlify bouwt vanaf `main`).
- Werk voor iets groter dan een triviale fix in een kortlevende branch (`feature/<korte-naam>`, `fix/<korte-naam>`), en merge terug via een PR of expliciete review. In de praktijk wordt er vaak rechtstreeks op `main` gewerkt en zijn de PR's die er ooit waren gesloten zonder merge; dat mag, maar dan geldt de regel hieronder over parallelle sessies des te sterker.

### Meerdere sessies tegelijk

Het komt regelmatig voor dat er twee of drie sessies naast elkaar aan dit project werken. Dat gaat goed zolang ze niet in dezelfde bestanden schrijven — git voegt dat niet netjes samen. Afspraken:

- **Eerst `git pull`, elke keer.** Ook als je denkt dat je de enige bent.
- **Verdeel per map, niet per taak.** Bijvoorbeeld: de ene sessie in `supabase/functions/` en migraties, de andere in `src/`. Spreek dat expliciet af voordat je begint.
- **Migratienummers: draai `npm run migraties`.** Die print het eerstvolgende vrije nummer. Tel niet met de hand en verzin er geen. Dit is inmiddels **drie keer** misgegaan — `027`, daarna `030`/`031`, daarna `039` — telkens doordat twee sessies tegelijk hetzelfde nummer pakten. De inhoud verschilde, dus de database klopt, maar de map is er misleidend van geworden en de volgorde is niet meer aan de naam af te lezen. Een `pre-commit`-hook weigert dit nu; die staat in `.githooks/` en wordt bij het starten van een sessie automatisch aangezet.
- **Documentatie in `.ai/` is gedeeld terrein.** Werk je die bij, doe het dan in één afgebakende commit en push meteen, zodat het venster waarin een andere sessie erop kan botsen zo klein mogelijk is.
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

Er is **wél een geautomatiseerde testsuite**: Vitest, in `tests/`. Draai `npm test`, of `npm run controle` voor typecheck én tests in één. `.github/workflows/controle.yml` doet hetzelfde bij elke push.

Let op het verschil: `npm run build` typecheckt bewust alleen `src/`; `npm run controle` en de CI doen ook `tests/`. Een fout in een test hoort geen uitrol tegen te houden.

De tests dekken de rekenkundige kant — parser, planning, statusregels, rollen, export. Wat er níét doorheen komt is alles wat door RLS, Storage of ClickUp loopt; daar is de handmatige procedure hieronder voor, plus `supabase/tests/rollentest.sql`. Zie `TESTING.md` voor wat elk testbestand precies bewaakt.

De handmatige procedure blijft dus verplicht bij elke taak, náást de tests:

1. **Build-check:** `npm run build` slaagt zonder TypeScript- of build-fouten.
1b. **Testcheck:** `npm test` is groen (of `npm run controle` voor typecheck + tests).
2. **Dev-server-check:** `npm run dev`, en de betrokken flow handmatig doorlopen in de browser.
3. **Beide kanten van de rolgrens testen** waar relevant: iedere wijziging aan gedeelde componenten, hooks, routing of RLS-policies wordt getest als **kantoorrol én als medewerker**. Raakt de wijziging gebruikersbeheer of de storingen, test dan ook de smallere sloten (beheerder vs. uitvoerder, eigenaar vs. de rest) — zie `src/lib/rollen.ts`.
4. **Volledige gebruikersflow doorlopen**, niet alleen het gewijzigde scherm in isolatie — bv. bij een wijziging aan taken: van inloggen, naar werkbon openen, taak afvinken, foto uploaden, tot terug naar het overzicht.
5. **Randgevallen:** lege staten (geen werkbonnen, geen taken), een mislukte Supabase-call, en een niet-geautoriseerde rol die een beheerder-route probeert te openen.
6. **Responsiveness:** de flow op mobiele breedte (telefoon-simulatie of echt device) én op desktop-breedte.
7. **Console-check:** geen onverwachte errors/warnings die aan de wijziging te wijten zijn.
8. **Routing-check:** nieuwe/gewijzigde routes zijn correct toegevoegd in `App.tsx`, met het juiste guard-type, en er is geen dode of dubbele route achtergebleven.
9. **Import-check:** geen ongebruikte imports, geen gebroken `@/`-paden, geen circulaire imports geïntroduceerd.
10. **Thema-check:** het gewijzigde scherm in licht én donker bekijken. Elke nieuwe kleur krijgt een `dark:`-variant.

Voeg je een test toe, houd dan de regel aan die de bestaande suite volgt: **elke test hoort bij een fout die daadwerkelijk is voorgekomen.** Een test die nooit iets had kunnen vangen, vangt straks ook niets.

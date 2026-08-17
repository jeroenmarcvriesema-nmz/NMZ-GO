# SPRINTS.md — Sprintwerkwijze en sprintlog

## Sprintwerkwijze

Dit project ontwikkelt in **sprints**. Een sprint-checkpoint markeert een punt waarop de app **aantoonbaar werkt**, niet zomaar een verzameling losse commits.

- **Elke sprint werkt richting een "werkende versie"-checkpoint**: aan het einde van een sprint bouwt de app zonder fouten, en zijn de kernflows van beide rollen (beheerder + medewerker) handmatig doorlopen (zie `GIT_WORKFLOW.md` → Testprocedure).
- **Sprintnummering** volgt `Sprint <major>.<minor>` in de commit-boodschap van het checkpoint (bv. `Sprint 2.1 werkende versie`). Tussentijdse commits binnen een sprint mogen kleiner en incrementeel zijn; het sprint-checkpoint zelf is altijd een bouwbare, geteste stand.
- **Scope per sprint is begrensd**: een sprint pakt een afgebakend stuk functionaliteit (bv. "planningscherm", "projectdetail"), geen mix van ongerelateerde wijzigingen door elkaar.
- **Geen sprint-checkpoint committen met een falende build** — als `npm run build` niet slaagt, is de sprint niet klaar.
- Bij het starten van een nieuwe sprint: lees eerst de laatste sprint-checkpoint-commit en `CHANGELOG.md` (projectroot) om te begrijpen wat de actuele, werkende stand van de app is voordat je verder bouwt.
- Werk deze log bij zodra een sprint-checkpoint wordt gecommit — kort: wat is toegevoegd/gefixed, wat is de status.

> **Let op over dit logboek:** de sprintnummering is halverwege dit project doodgebloed. Vanaf Epic 4 wordt er niet meer in genummerde sprints gewerkt maar in **fasen van een epic**, en sinds augustus 2026 in de praktijk gewoon in kleine, doorlopende commits rechtstreeks op `main` — vaak met meerdere sessies tegelijk. Dat is de werkelijke werkwijze; doe niet alsof er nog sprint-checkpoints worden gezet.
>
> Wat daarvoor in de plaats is gekomen als geheugen: `CHANGELOG.md` voor de functionele geschiedenis, en `HANDOVER.md` hoofdstuk 0 voor de actuele stand. Lees díé twee als je wilt weten waar het project staat — niet het logboek hieronder, dat vooral geschiedenis is.
>
> Eerdere sprints (wat tot "2.0" of "2.1" leidde) zijn niet reconstrueerbaar uit de git-historie; die is bij een her-init samengevoegd.

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

### Sprint 3.1 — Premium redesign + dark mode (branch `feature/dark-mode-redesign`, PR #1)

Bouwt het ontbrekende dark-mode-systeem (theme store met `persist`, FOUC-preventie via een inline script in `index.html`, Tailwind class-strategie) en past `dark:` consistent toe over alle gedeelde componenten en pagina's. Daarna omgedraaid naar **light-primair** met meer zichtbare merkkleur, een `SectionHeading`-component met gele kicker, en theme-reactieve navigatie in plaats van een permanent donkere balk.

Nog binnen deze branch toegevoegd na een visuele review:
- `MeldingItem` van gekleurde vlakken naar een neutrale kaart met accentrand links (commit op de branch). Vijf verzadigde balken onder elkaar lieten geen enkele melding nog urgentie communiceren, en de gele tint werd bruinig in dark mode. Waarschuwingsrood naar `brand-red`, en een doelloos hover-effect verwijderd op een element dat niet klikbaar is.

**Nog openstaand op deze branch:** de KPI-rij op het dashboard heeft zes gelijkwaardige kaarten zonder onderlinge hiërarchie (en de eerste mist de gekleurde onderrand die de andere vijf wél hebben), en het Planning-scherm laat circa 80% van het scherm leeg zonder bruikbare lege staat.

---

## Epic 4 — Intelligent Work Preparation

Architectuur volledig uitgewerkt; zie hoofdstuk 0 van `HANDOVER.md` voor de link en de kernbesluiten. Epic 4 verandert NMZ GO van een invoerapplicatie in een systeem dat werk automatisch uit ClickUp overneemt.

### Fase 0 — Fundament (afgerond)

- **Migratie 002** (`supabase/migrations/002_projecten_tenants_rapportvelden.sql`): `tenants`-tabel met `tenant_id` op alle tabellen, `get_mijn_tenant()` in dezelfde `SECURITY DEFINER`-stijl als `get_mijn_rol()`, de `projecten`-tabel met `project_id` op werkbonnen, en de velden die het opleverrapport vereist. Alle bestaande RLS-policies uitgebreid met een tenant-voorwaarde; de rolscheiding uit 001 is ongewijzigd gebleven.
- **`useProjecten.ts`** (commit `587ba30`): van mock data naar echte Supabase-queries, in hetzelfde geneste-select-idioom als `useWerkbonnen`. `MOCK_MEDEWERKERS` vervangen door `useMedewerkers()`; `koppelMedewerkers` schrijft nu echt weg naar `werkbon_medewerkers`.

**Testkanttekening:** de rollentest (beheerder + medewerker) na deze RLS-wijziging is nog niet uitgevoerd — `supabase.co` is niet bereikbaar vanuit de ontwikkelomgeving. `GIT_WORKFLOW.md` schrijft die test voor; doe hem alsnog vóór dit als afgerond geldt.

### Fase 1 t/m 5 — afgerond

De serverlaag staat en draait in productie. Wat er sinds fase 0 is gebouwd, in grote lijnen:

| Fase | Wat | Stand |
|---|---|---|
| 1 | Edge function `verwerker`, takenwachtrij in Postgres (`verwerkingstaken`/`verwerkingsronden`), periodieke starter via pg_cron | ✅ |
| 2 | ClickUp lezen: klussen met status `volgende week` stromen binnen uit *Uitvoering 2026 Diemen* én *Leek* | ✅ |
| 3 | Waarneembaarheid: rondes, overgeslagen klussen met reden, `clickup.tekstproef` om te zien wat de parser leest | ✅ |
| 4 | Documenten binnenhalen (werkopdracht, werktekening), privé-opslag | ✅ |
| 4b | Werkopdracht uitlezen naar punten met een deterministische parser — geen taalmodel, dus geen hallucinatierisico | ✅ |
| 5 | Terugkoppeling naar ClickUp: status, opmerking, ploeg en planning schrijven direct terug | ✅ |
| — | Opleverrapport als PDF | ❌ nog niet gebouwd, zie `FEATURE_BACKLOG.md` |

**Drie kernbesluiten van de eigenaar die hierbij horen** (en die blijven gelden):

1. **Serverlaag bij de bestaande leverancier.** Supabase Edge Functions, geen nieuwe partij erbij.
2. **Multi-tenancy meteen inbouwen**, vooruitlopend op een mogelijke SaaS/white-label-toekomst — omdat het achteraf toevoegen betekent dat elke RLS-policy herschreven moet worden.
3. **ClickUp is leidend, NMZ GO schrijft direct terug.** Elke wijziging in NMZ GO gaat *direct* terug, niet pas bij afronding — anders overschrijft een synchronisatieronde het werk van de monteur.

### Wat er van ClickUp vastligt

- Alleen Space **Werkvoorbereiding** (`90152805075`) doet mee, niet de 98 "Project Management X"-spaces. Eén taak = één adres = één werkbon.
- Twee lijsten synchroniseren: **Uitvoering 2026 Diemen** (`901517814355`) en **Uitvoering 2026 Leek** (`901522829990`). De losse lijst *Uitvoering* (`901506909996`) blijft er bewust buiten; die lijkt een restant. Ze staan als constante bij elkaar bovenin de handler, zodat een derde vestiging één regel is.
- **Status `volgende week` betekent "klaar voor uitvoering"** — dat is de synchronisatietrigger. Elk weekend wordt die handmatig omgezet naar `deze week`; die omzetting ís de vrijgavebeslissing, dus NMZ GO heeft geen eigen vrijgaveknop nodig.
- Van de 30 custom fields doen er drie mee: **Kluiscode**, **Werkopdracht (PDF)** en **Werktekening**. De rest staat al op de werkopdracht zelf.
- Datums gaan als **middernacht UTC** naar ClickUp (`naarMs`), de omkering van `datum()` die met `toISOString()` leest. In een Nederlandse werkruimte toont ClickUp dat als 02:00 dezelfde dag. Zou het bedrijf ooit in een tijdzone vóór UTC gaan werken, dan valt die tijdstempel op de vorige dag — dán moet dit mee.
- Datums worden ná de eerste import **níét** meer uit ClickUp gezet: de ronde slaat een bon met `opdracht_pad` over. Er is dus geen strijd om die velden.

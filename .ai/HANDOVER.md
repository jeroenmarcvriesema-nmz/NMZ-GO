# HANDOVER.md — Overdracht tussen sessies

**Doel van dit document:** een volgende sessie moet dit project kunnen overnemen **zonder enig contextverlies**. Geen enkel feit hieronder is aangenomen; alles is geverifieerd tegen de daadwerkelijke codebase, database, git-historie en documentatie.

Lees hoofdstuk 0 als eerste — dat is de actuele stand. De hoofdstukken daarna beschrijven de architectuur, de visie van de eigenaar en de geschiedenis; die blijven geldig, maar zijn geschreven vóór Epic 4.

---

# 0. Actuele stand — augustus 2026

**De laatste sessie stond volledig in het teken van Epic 4: Intelligent Work Preparation.** Dat is de koppeling tussen ClickUp en NMZ GO, plus de intelligentielaag daarbovenop.

## Het architectuurdocument

De volledige architectuur van Epic 4 is uitgewerkt en staat hier:
**https://claude.ai/code/artifact/68edd097-0c39-4c48-9789-dad233cf8e64**

Lees dat vóór je aan Epic 4 werkt. Alles erin is geverifieerd tegen de echte ClickUp-werkruimte, een echte werkopdracht en een echt opleverrapport — niet tegen aannames.

## Drie kernbesluiten van de eigenaar

1. **Serverlaag: Supabase Edge Functions.** De huidige client-only opzet kan Epic 4 niet dragen — een ClickUp-token hoort niet in browsercode, een webhook heeft een altijd bereikbare URL nodig. Blijft bij de bestaande leverancier.
2. **Multi-tenancy nu inbouwen.** De ambitie is SaaS en white label; tenant-isolatie achteraf toevoegen betekent elke RLS-policy herschrijven. Uitgevoerd in migratie 002.
3. **ClickUp is leidend, NMZ GO schrijft direct terug.** ClickUp blijft de bron van waarheid voor alles wat het kan uitdrukken. Elke wijziging in NMZ GO gaat *direct* terug, niet pas bij afronding — anders overschrijft een synchronisatie het werk van de monteur. Gevolg voor de planning: de synchronisatie mag niet in productie vóór de terugkoppeling er is.

## Wat er van ClickUp geverifieerd is

- Alleen Space **Werkvoorbereiding** doet mee (niet de 98 "Project Management X"-spaces). Folder *Planning overzicht - 2026*, lijst *Uitvoering 2026 Diemen*. Eén taak = één adres = één werkbon.
- **`volgende week` betekent "klaar voor uitvoering"** — dat is de synchronisatietrigger. Elk weekend wordt die status handmatig omgezet naar `deze week`; die omzetting ís de vrijgavebeslissing, dus NMZ GO heeft geen eigen vrijgaveknop nodig.
- Terugkoppeling bij oplevering: `opgeleverd` als de foto's compleet zijn, anders `wacht op foto's`.
- Van de 30 custom fields doen er drie mee: **Kluiscode**, **Werkopdracht (PDF)**, **Werktekening**. De rest staat al op de werkopdracht zelf.
- De werkopdracht is een vast sjabloon met labels en opsommingstekens. De uit te voeren punten zijn daarom **met een deterministische parser** uit te lezen — geen taalmodel nodig, en dus geen hallucinatierisico.
- Foto's: "voor" komt van de inspecteur, "na" van de monteur. Het rapport combineert beide.

## Fase 0 is afgerond

| Wat | Waar | Status |
|---|---|---|
| Migratie 002 — tenants, projecten, rapportvelden | `supabase/migrations/002_projecten_tenants_rapportvelden.sql` | Gedraaid door de eigenaar |
| `useProjecten.ts` van mock naar echte queries | commit `587ba30` | Gepusht, build groen |

Concreet toegevoegd: een `tenants`-tabel met `tenant_id` op alle tabellen, `get_mijn_tenant()` in dezelfde `SECURITY DEFINER`-stijl als `get_mijn_rol()`, de `projecten`-tabel met `project_id` op werkbonnen, en de velden die het opleverrapport vereist (postcode/plaats, opdrachtnummer, opleverdatum, vier vrije tekstblokken, `fase` op foto's).

**De projectenschermen tonen nu een lege lijst. Dat is correct** — de tabel bestaat, er staat alleen nog niets in. De vulling komt via de ClickUp-synchronisatie in fase 2.

## Openstaand — eerst afmaken

- ~~**Verificatiequery** na migratie 002~~ — **gedaan.** Rollen kloppen (`jeroenmarcvriesema@gmail.com` = beheerder), `get_mijn_rol()` en `get_mijn_tenant()` staan als `SECURITY DEFINER` met vaste `search_path`, geen `42P17` recursie.
- ~~**Rollentest** (beheerder + medewerker)~~ — **gedaan, en die vond een kritiek lek.** Zie hieronder; opgelost in migratie 003.
- **Twee vragen liggen bij de eigenaar:** welk veld leidend is (`Werktekening` óf `Werktekening (PDF)` — er zijn er twee), en of het opleverrapport de fotopagina's apart exporteert.

## Migratie 003 — rol-escalatie gedicht

De voorgeschreven rollentest heeft een privilege escalation aangetoond die al sinds migratie 001 in het schema zat en in 002 is meegekopieerd. `profiles_update_own` had wel een `using`- maar geen `with check`-clausule. Postgres valt dan voor de controle op de nieuwe rij terug op `using ( auth.uid() = id )`, en `id` verandert niet bij een update — dus elke kolom van de eigen rij was vrij bewerkbaar.

Eén PostgREST-call als gewone medewerker volstond:

```
PATCH /rest/v1/profiles?id=eq.<eigen-id>
{ "rol": "beheerder", "tenant_id": "<andere-tenant>" }
```

Daarmee vielen de rolscheiding én de tenant-isolatie uit 002 tegelijk om: de medewerker werd beheerder in de tenant van een andere klant en kon diens werkbonnen lezen. Dit is aangetoond in een transactie met `rollback`; er is geen productiedata gewijzigd.

`003_fix_rolescalatie_profiles.sql` zet er twee sloten op: een `before update`-trigger die rol- en `tenant_id`-wijzigingen tegenhoudt (een trigger ziet `OLD`/`NEW`, een policy niet), plus `with check` op beide update-policies als tweede laag. `profiles_insert_own` had hetzelfde gat bij het aanmaken en is meegenomen. **Deze migratie is al toegepast op de database.**

Blijvend aandachtspunt: een tenant-verhuizing kan nu bewust alleen nog via `service_role`, niet via de app — ook niet door een beheerder.

Twee losse eindjes die geen blokkade vormen: `tenants` heeft RLS aan met nul policies (alles dicht — veilig, maar zodra een scherm de tenantnaam wil tonen is een select-policy nodig), en leaked-password-protection staat uit in Supabase Auth.

## Volgende stap

**Fase 1: serverlaag en verwerkingswachtrij.** Eerste Edge Function, takenwachtrij in Postgres, periodieke starter, en een beheerdersscherm dat toont wat er draait — bewust nog zonder ClickUp, om het patroon te bewijzen op iets ongevaarlijks.

## Beperkingen van de ontwikkelomgeving

- **`supabase.co` is geblokkeerd** vanuit de Claude-container (netwerkpolicy). De app kan daar dus niet ingelogd getest worden. Database-toegang loopt via de **Supabase-connector**, die buiten die blokkade om werkt — als die connector wegvalt, is een nieuwe sessie starten de betrouwbaarste oplossing.
- Om ingelogde schermen te bekijken is er een truc: zet tijdelijk een mock-profiel in `AuthInitializer` (`App.tsx`) achter een env-vlag. Dashboard, Projecten en Planning draaien op data die geen echte login vereist. **Draai die wijziging altijd terug voor je commit.**

---

# 1. Projectoverzicht

**NMZ GO** is een interne webapplicatie voor NMZ waarmee monteurs en beheerders **werkbonnen** (werkopdrachten) digitaal aanmaken, plannen, uitvoeren en afronden.

- **Voor wie:** ~30 medewerkers van NMZ, dagelijks gebruik. Geen externe/klant-facing toegang — dit is intern gereedschap, geen product dat verkocht wordt.
- **Bedrijfscontext:** NMZ is een bedrijf met monteurs die op locatie (bij klanten, op daken, in schakelkasten) werk uitvoeren. Vóór deze app werd dit proces papieren/ad-hoc bijgehouden.
- **Doel van de software:** één digitale, betrouwbare bron van waarheid voor het werkbonnenproces — projecten → werkbonnen → taken → foto-bewijs → afronding → rapportage.
- **Gebruikersrollen** (hard gescheiden in UI én database via RLS):
  - **Beheerder** — maakt projecten/werkbonnen aan, plant medewerkers in, beheert medewerkers, bekijkt dashboard/rapportages. Werkt vaker op desktop, moet ook op tablet werken.
  - **Medewerker** — ziet uitsluitend eigen werkbonnen, vinkt taken af, uploadt foto's als bewijs. Werkt vrijwel altijd op een telefoon, vaak buiten, met wisselende connectiviteit.
- **Huidige ontwikkelfase:** post-MVP, sprintgewijze doorontwikkeling. Zie hoofdstuk 0 voor de actuele stand — de tekst hieronder in dit hoofdstuk beschrijft de situatie van vóór Epic 4 en is op onderdelen achterhaald.
- **Let op — de scope is verbreed.** Dit hoofdstuk en `PROJECT.md` beschrijven NMZ GO als intern gereedschap dat niet verkocht wordt. Dat is niet langer het uitgangspunt: de eigenaar wil het platform later als **SaaS en white label** aanbieden. Daarom is multi-tenancy al ingebouwd (migratie 002) en is "configuratie boven code" een leidend principe geworden. Zie het architectuurdocument in hoofdstuk 0.

---

# 2. Technische Architectuur

NMZ GO is een **client-only single-page application** — geen eigen backend-server. De React-app praat rechtstreeks met Supabase; **Row Level Security (RLS) is de enige autorisatielaag**.

**Stack:**
- **React 18** — functiecomponenten + hooks only, geen class components.
- **Vite 5** — dev server (`npm run dev`, poort 5173) en build (`npm run build` = `tsc` + `vite build`).
- **TypeScript 5**, `strict: true` in `tsconfig.json`. `noUnusedLocals`/`noUnusedParameters` staan uit, maar ongebruikte imports worden desondanks als hygiëne vermeden.
- **Tailwind CSS 3** — alle styling via utility-classes en de tokens in `tailwind.config.ts` (merkkleuren `brand.yellow`/`brand.red`, `surface`-lagen, radius-/shadow-schaal). Geen CSS-modules, geen losse `<style>`-blokken.
- **Zustand** — **uitsluitend** voor auth-state (`authStore.ts`: profile/loading/error/signOut). Geen tweede globale store.
- **Supabase** — Postgres + Auth + Storage. Eén client in `src/lib/supabase.ts`. Env-variabelen `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` verplicht (`.env.local`, niet gecommit).
- **react-router-dom 6** — routing centraal in `src/App.tsx`.

**Routering:** elke route hangt achter een guard.
- `BeheerderGuard`: `/dashboard`, `/projecten`, `/projecten/:id`, `/planning`, `/werkbonnen`, `/werkbonnen/nieuw`, `/werkbonnen/:id`, `/medewerkers`, `/rapporten`.
- `AuthGuard` (elke ingelogde gebruiker): `/mijn-werkbonnen`, `/werkbon/:id`, `/afgerond`.
- Zonder guard: `/login`, `/registreer`, `/` (→ `RootRedirect`, stuurt door op basis van rol).

**Auth-architectuur:** één `AuthInitializer`-component in `App.tsx` initialiseert sessie + auth-listener **eenmalig**. Guards lezen alleen uit de Zustand-store, starten nooit een eigen listener — dit is een **opgeloste kritieke bug** (race condition/oneindige laadstatus) en mag nooit terugkomen.

**Componentstructuur:**
```
components/
├── ui/        Button, Card, Badge/StatusBadge, Input/Textarea, Modal, Avatar, ProgressBar, Spinner/PageLoader
├── layout/    Sidebar, MobileNav, Topbar/MobileTopbar, PageWrapper
├── dashboard/ KpiCard, StatCard, ActivityFeed, MeldingItem, ProjectTabel
├── werkbon/   WerkbonKaart
└── taak/      TaakItem
```
Nog **niet** gebouwd (zie `.ai/COMPONENT_LIBRARY.md`): `Select`, generieke `Table`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`.

**Hooks** (`src/hooks/`): `useAuth` (pure store-reader), `useWerkbonnen`/`useWerkbon` (échte Supabase-queries), `useTaken`, `useFotos`, `useProjecten`/`useProject`/`usePlanning` (**mock data**, zie hoofdstuk 3), `useDashboard` (**mock data**), `useWerkdag` (mock/sessionStorage, wacht op een `werkdag_logs`-tabel).

**Pagina's** (`src/pages/`): `auth/` (Login, Registreer), `beheerder/` (Dashboard, Projecten, ProjectDetail, Planning, Werkbonnen, WerkbonNieuw, WerkbonDetail, Medewerkers, Rapporten), `medewerker/` (MijnWerkbonnen, WerkbonUitvoeren, Afgerond).

**Layoutstructuur:** `PageWrapper` is de enige paginaschil (Sidebar+Topbar op desktop, MobileTopbar+MobileNav op mobiel). Elke pagina rendert binnen `<PageWrapper title="..." actions={...}>`.

**Mappenstructuur (volledig):**
```
nmzgo/
├── CLAUDE.md                 # wijst uitsluitend naar .ai/CLAUDE.md
├── .ai/                      # volledige projectdocumentatie (zie hoofdstuk 5)
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   ├── components/ (zie boven)
│   ├── pages/ (zie boven)
│   ├── hooks/ (zie boven)
│   ├── lib/          supabase.ts, utils.ts
│   ├── store/        authStore.ts
│   └── types/        index.ts
└── supabase/
    └── migrations/   001_initial.sql (enige migratie tot nu toe)
```

---

# 3. Huidige status van het project

**Afgeronde sprints (gecommit):**
- **MVP / v1.0.0** — auth (login, sessieherstel, logout, rolgebaseerde redirect), RLS-basis (medewerker ziet alleen eigen werkbonnen, beheerder ziet alles). Zie `CHANGELOG.md`.
- **Sprint 2.1 — werkende versie** (commit `977effd`, enige commit in de git-historie).

**Sprint 3 — Projecten & Planning (deze sessie afgerond, nog niet gecommit):**
- Build gerepareerd (`Sidebar.tsx`/`MobileNav.tsx` waren middenin een restyling afgebroken — syntaxfout, build faalde).
- Projectenoverzicht (`/projecten`), projectdetail (`/projecten/:id`), weekplanning (`/planning`) volledig bruikbaar.
- Dashboard uitgebreid naar 6 project-gebaseerde KPI's.
- Kleine visuele polish (lege-staat, hover-transities) — zie hoofdstuk 7 voor waarom dit **niet** de volledige visuele redesign is die de eigenaar voor ogen had.

**Volledig werkend (echte Supabase-koppeling, productie-klaar):**
- Auth (login/registreer/sessieherstel/logout/rolgebaseerde redirect).
- RLS: rolscheiding beheerder/medewerker, `get_mijn_rol()` SECURITY DEFINER-patroon.
- Werkbonnen: aanmaken (`WerkbonNieuw.tsx`), overzicht, detail, taken afvinken, foto-upload — allemaal echte `supabase.from(...)`-calls.

**Draait op mock data (géén echte backend-koppeling):**
- `useDashboard.ts` — dashboard-cijfers, meldingen, activiteit.
- `useProjecten.ts` — projecten, planning, medewerkerskoppeling (`koppelMedewerkers` is deze sessie toegevoegd, maar puur in-memory).
- `useWerkdag.ts` — start/stop werkdag, sessionStorage, wacht op een `werkdag_logs`-tabel.
- Alle bovenstaande mock-hooks bevatten expliciete code-comments met de bedoelde Supabase-query voor later.

**Nog te ontwikkelen:**
- Echte `projecten`-databasetabel + migratie + RLS-policies (Project heeft velden — `opdrachtgever`, `startdatum`, `einddatum`, `opmerkingen` — die niet op `werkbonnen` bestaan; dit is bewust nog niet gebouwd, zie hoofdstuk 7 en 10).
- **De volledige premium UI-redesign** (dark-mode-primair, enterprise-uitstraling) — zie hoofdstuk 6/7/11, dit is nu de belangrijkste openstaande prioriteit.
- Ontbrekende UI-primitives: `Select`, generieke `Table`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`.
- PDF-export van rapporten, geautomatiseerde tests, signed URLs voor foto-opslag.

---

# 4. Git status

```
Branch:              main
Remote:              origin → https://github.com/jeroenmarcvriesema-nmz/NMZ-GO.git
Status t.o.v. remote: up to date with 'origin/main'
Commits (git log):   977effd  Sprint 2.1 werkende versie   ← enige commit in de historie
Staged wijzigingen:  GEEN
```

**Unstaged (modified, nog niet gestaged):**
```
CHANGELOG.md
src/App.tsx
src/components/layout/MobileNav.tsx
src/components/layout/PageWrapper.tsx
src/components/layout/Sidebar.tsx
src/components/layout/Topbar.tsx
src/index.css
src/pages/beheerder/Dashboard.tsx
src/types/index.ts
tailwind.config.ts
```

**Untracked (nieuwe bestanden):**
```
.ai/                                  ← volledige projectdocumentatie (zie hoofdstuk 5)
CLAUDE.md                             ← root-pointer naar .ai/CLAUDE.md
src/hooks/useProjecten.ts
src/pages/beheerder/Planning.tsx
src/pages/beheerder/ProjectDetail.tsx
src/pages/beheerder/Projecten.tsx
src/vite-env.d.ts
```

**Diff-omvang (unstaged, `git diff --stat`):** 10 bestanden, +226/−144 regels.

**Belangrijk:** er is op dit moment **geen enkele wijziging van Sprint 3 gecommit**. Alles staat in de werkmap. `npm run build` slaagt (laatste keer geverifieerd: schone build, 6283 modules, geen fouten). Commit is bewust uitgesteld tot na expliciete goedkeuring van de eigenaar op het resultaat — die goedkeuring is er tot nu toe nog niet geweest.

---

# 5. AI-documentatie

Alles staat in `.ai/` (verborgen map in de projectroot). Het root-`CLAUDE.md` verwijst uitsluitend naar `.ai/CLAUDE.md` zodat Claude Code/Desktop dit automatisch als projectcontext oppikt.

| Bestand | Waarvoor |
|---|---|
| `.ai/CLAUDE.md` | **Startpunt/AI-grondwet.** Projectvisie, verplichte AI-werkwijze, verboden acties, Definition of Done, index naar alle overige documenten. |
| `.ai/PROJECT.md` | Doel van NMZ GO, doelgroep, rollen, kernproces, scope. |
| `.ai/PRODUCT_VISION.md` | **De merk-/designvisie van de eigenaar** — premium enterprise-gevoel, dark-mode-strategie, kleurgebruik. Zie hoofdstuk 6/7 hieronder — dit is de sleuteldocument voor de volgende stap. |
| `.ai/ARCHITECTURE.md` | Lagen, auth-flow, technologie-stack, mappenstructuur, database, Supabase- en securityregels. |
| `.ai/DESIGN_SYSTEM.md` | **Huidige, daadwerkelijk geïmplementeerde** UI/UX-staat (tokens, componentregels, responsive) — bewust apart van de toekomstvisie in `PRODUCT_VISION.md`. |
| `.ai/UI_GUIDELINES.md` | Concrete patronen: spacing, typography, cards, forms, tables, modals, animaties, loading/empty/error states. |
| `.ai/COMPONENT_LIBRARY.md` | Elk bestaand component gedocumenteerd (doel/gebruik/varianten/regels) + wat nog ontbreekt. |
| `.ai/CODING_STANDARDS.md` | Coding standards, TypeScript, React, performance, naamgeving, refactor-/featureregels. |
| `.ai/GIT_WORKFLOW.md` | Branch-/commitconventies, build- en testprocedure. |
| `.ai/DEPLOYMENT.md` | Git-workflowoverzicht, build, productie (Netlify/Supabase), rollback. |
| `.ai/TESTING.md` | Handmatige testprocedure, build procedure, Definition of Done, release checklist. |
| `.ai/ROADMAP.md` | Wat bewust nog niet gebouwd is, bekende aandachtspunten. |
| `.ai/FEATURE_BACKLOG.md` | Sprint 3–6 en verdere toekomstige features, met prioriteit (zie hoofdstuk 10 voor de bijgewerkte volgorde). |
| `.ai/SPRINTS.md` | Sprintwerkwijze en sprintlog — inclusief het net afgeronde Sprint 3-verslag. |
| `.ai/HANDOVER.md` | **Dit document.** |

---

# 6. Visie van de eigenaar

De eigenaar (Jeroen) heeft expliciet vastgelegd — dit is geen interpretatie, dit staat letterlijk zo in `.ai/PRODUCT_VISION.md` — dat NMZ GO moet **aanvoelen als een premium bedrijfsplatform**, ook al gebruiken maar ~30 mensen het.

**Inspiratiebronnen (expliciet genoemd door de eigenaar):**
- **Apple** — rust, precisie, terughoudendheid.
- **Linear** — snelheid als gevoel, subtiele micro-animaties, donker canvas.
- **Notion** — veel witruimte, duidelijke hiërarchie.
- **Stripe Dashboard** — data serieus en helder presenteren.
- **Raycast** — (door de eigenaar genoemd bij deze overdracht-opdracht, nog niet in `PRODUCT_VISION.md` opgenomen tot deze sessie — inmiddels toegevoegd) keyboard-first snelheid, minimale chrome, strakke command-palette-achtige efficiëntie.

**Esthetische eigenschappen (niet onderhandelbaar):**
- Strak, minimalistisch, professioneel, rustig.
- Veel witruimte — content ademt, wordt niet platgedrukt.
- Grote, duidelijke typografie voor nadruk (KPI's, koppen).
- Mooie, functionele animaties — nooit puur decoratief, nooit vertragend.
- Moderne kaarten: heldere randen, diepte via subtiele schaduw, geen zware borders.
- Consistente, afgeronde hoeken via de radius-schaal.
- **Snelheid boven overbodige effecten** — een animatie die geen betekenis toevoegt (bevestiging/richting/hiërarchie) hoort er niet te zijn.
- Geen drukke interface — rustige UX, geen concurrerende accenten.

**Thema:** **dark mode is de primaire, standaard ervaring.** Light mode wordt **volledig** ondersteund (niet als bijzaak) — relevant omdat medewerkers vaak in fel buitenlicht werken. Gebruiker kan wisselen; voorkeur wordt opgeslagen.

**Kleurgebruik:** NMZ Geel = primaire accentkleur (acties, actieve navigatie, voortgang). NMZ Rood = uitsluitend waarschuwingen/kritieke acties. **Geen overmatig kleurgebruik** — kleur is altijd functioneel, nooit decoratief. De basis van elk scherm is neutraal.

**Wat dit niet betekent (ook expliciet vastgelegd):** premium/minimalistisch mag nooit ten koste gaan van bruikbaarheid in het veld (contrast, leesbaarheid, grote touch targets voor monteurs), Nederlandse mensentaal, en "één duidelijke actie per scherm."

---

# 7. Wat is er misgegaan tijdens Sprint 3

**Eerlijke reconstructie van deze sessie:**

1. Een eerdere, afgebroken sessie had `Sidebar.tsx`/`MobileNav.tsx` middenin een restyling laten staan — de build was **kapot** (TypeScript-syntaxfouten). Dit is deze sessie ontdekt en gerepareerd.
2. Bij het plannen van Sprint 3 is de eigenaar expliciet een keuze voorgelegd: *volledige Supabase-backend nu bouwen* vs. *alleen de UI afmaken op de bestaande mock data*. De eigenaar koos bewust voor de kleinere, mock-data-only scope.
3. Vervolgens is gevraagd om Dashboard/Projecten/Planning **visueel te toetsen** aan `PRODUCT_VISION.md`/`UI_GUIDELINES.md` en te verbeteren "binnen de bestaande mock-data scope" — met de expliciete restrictie "geen dark-mode-implementatie".
4. Dit is uitgevoerd als een **compliance-audit + lichte polish**: één echte overtreding gevonden en gefixt (een emoji in een lege-staat, in strijd met de iconregel), plus kleine hover-transitie-verbeteringen. Dashboard bleek al grotendeels in lijn met de richtlijnen.
5. **Resultaat:** build succesvol, code stabiel, Projecten/Planning/ProjectDetail functioneel compleet op mock data — maar **visueel is de app nog steeds het bestaande lichte thema met kleine incrementele verbeteringen**, niet de premium, dark-mode-primaire, Apple/Linear/Notion/Stripe/Raycast-achtige transformatie die in hoofdstuk 6 staat beschreven.

**Waarom dit waarschijnlijk is gebeurd:**
`PRODUCT_VISION.md` zelf (geschreven eerder in dezelfde sessie) framet de dark-mode/premium-visuele overgang expliciet als een **bewust aparte, latere migratietaak** — juist om te voorkomen dat er ongepland een grote, risicovolle herstyling van de hele app plaatsvindt binnen een kleinere sprint. Toen tijdens Sprint 3 werd gevraagd om "binnen de bestaande mock-data scope te verbeteren" én "geen dark-mode" werd herbevestigd, is dit correct geïnterpreteerd als: een gerichte, kleine compliance-pas — **niet** als een opdracht tot de volledige visuele redesign. Met andere woorden: de gedocumenteerde scope-afbakening (bedoeld om risico te beperken) en de daadwerkelijke verwachting van de eigenaar (die intussen groter was gegroeid, richting "dit moet er nu al premium uitzien") zijn uit elkaar gaan lopen. Dit is geen technisch falen — build en code zijn stabiel — maar een **scope-/verwachtingsmismatch** die niet expliciet genoeg is uitgevraagd voordat er werd geïmplementeerd.

---

# 8. Belangrijkste lessen

1. **Eerst analyseren, dan pas plannen.** De kapotte build was alleen te vinden door de daadwerkelijke bestanden te lezen en `npm run build` te draaien vóór het schrijven van een plan — niet door op de eerdere sprintlog te vertrouwen.
2. **Scope-forks expliciet voorleggen, niet zelf beslissen.** De keuze "volledige backend nu vs. mock-data-only" is terecht aan de eigenaar voorgelegd — dat werkte goed.
3. **"Verbeter volgens de richtlijnen" is dubbelzinnig tussen "kleine compliance-fix" en "volledige redesign".** Dit onderscheid is deze sessie **niet** expliciet uitgevraagd, met een verwachtingsmismatch als gevolg (zie hoofdstuk 7). Volgende keer: bij een vage "verbeter dit visueel"-opdracht expliciet laten kiezen tussen polish-niveau en redesign-niveau, zeker wanneer er een groot visie-document (`PRODUCT_VISION.md`) met een expliciet nog-niet-geïmplementeerde stijl in de buurt is.
4. **Build draaien na élke stap, niet pas aan het einde.** Dit voorkomt dat kleine fouten zich opstapelen.
5. **Fouten zelf oplossen binnen scope**, niet rapporteren-en-stoppen.
6. **Pas committen na expliciete goedkeuring van het resultaat.** Dit is deze sessie strikt aangehouden — er is bewust niets gecommit zonder akkoord, wat nu betekent dat Sprint 3 klaarstaat maar wacht op een go/no-go (zie hoofdstuk 4).
7. **Transparant zijn over verificatiegrenzen.** Er waren geen Supabase-testcredentials en geen browser-automatiseringstool beschikbaar in de terminalomgeving — dit is expliciet benoemd in plaats van een ongeteste browserflow als "geverifieerd" te presenteren.

---

# 9. Nieuwe ontwikkelstrategie

Vanaf nu geldt voor **elke** taak aan NMZ GO, groot of klein, deze volgorde — geen stap overslaan:

1. **Lees eerst alle relevante documentatie** in `.ai/` (minimaal `.ai/CLAUDE.md`, plus de specifieke documenten die de taak raakt — bij visuele taken altijd `PRODUCT_VISION.md` én `UI_GUIDELINES.md` én `DESIGN_SYSTEM.md` samen, niet één ervan).
2. **Analyseer de volledige, actuele codebase** — lees de daadwerkelijke bestanden, vertrouw niet op eerdere sprintlogs of aannames. Draai `npm run build`/`git status` vroeg in het proces om de echte staat te kennen.
3. **Maak een concreet implementatieplan** — welke bestanden, welke componenten (nieuw/hergebruikt), welke risico's, welke volgorde. Bij een vage of dubbelzinnige opdracht (met name "verbeter dit visueel"): expliciet navragen of het een kleine polish-pas of een volledige redesign betreft, vóórdat het plan wordt geschreven.
4. **Wacht op expliciete goedkeuring** van dat plan voordat er ook maar één regel code wordt geschreven.
5. **Implementeer** volgens het goedgekeurde plan.
6. **Draai `npm run build` na elke betekenisvolle stap** en los fouten zelfstandig op — ga niet door met een rode build.
7. **Geef een volledig overzicht** van gewijzigde bestanden, uitgevoerde wijzigingen, buildresultaat en resterende TODO's.
8. **Commit pas na expliciete goedkeuring** van de eigenaar op het resultaat.

---

# 10. Openstaande werkzaamheden (bijgewerkte backlog)

> Deze volgorde vervangt/verfijnt de eerdere volgorde in `.ai/FEATURE_BACKLOG.md` — de premium redesign is naar voren gehaald naar Sprint 3.1 omdat dit nu de duidelijkste, expliciet uitgesproken prioriteit van de eigenaar is.

**Sprint 3.1 — Premium UI Redesign (eerstvolgende prioriteit):**
- Volledige visuele redesign van Dashboard, Projecten, ProjectDetail, Planning (en waar nodig gedeelde componenten/layout) conform `PRODUCT_VISION.md` en `UI_GUIDELINES.md`: dark-mode-primair met volledig ondersteund light mode, theme-toggle + opgeslagen voorkeur.
- Ontbrekende UI-primitives bouwen waar de redesign ze nodig heeft: `Select`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`, generieke `Table`.
- Eerst het huidige Sprint 3-werk (zie hoofdstuk 4) laten beoordelen/committen door de eigenaar, of expliciet meenemen in dezelfde redesign-slag — dit is een keuze voor de eigenaar, geen aanname.

**Sprint 4 — Echte backend voor Projecten & Planning:**
- Nieuwe `projecten`-tabel + migratie (incl. `project_id`-FK op `werkbonnen`), RLS-policies, `useProjecten.ts` volledig herschrijven naar echte Supabase-queries.

**Sprint 5 — Rapportages & inzicht:**
- PDF-export van rapporten, dashboard analytics-uitbreiding (trends over tijd), verkennend: AI-rapportages.

**Sprint 6 — Veldgebruik verbeteren:**
- Foto-annotaties, GPS/locatiecontrole (privacy eerst bespreken), offline modus (basis), push notificaties.

**Toekomst (nog niet gepland):**
- Planning-optimalisatie (automatische suggesties), signed URLs voor foto-opslag, geautomatiseerde tests, medewerkersstatistieken, multi-vestiging/multi-team-ondersteuning (alleen bij concrete aanleiding).

---

# 11. Aanbevolen volgende stap

**NIET direct programmeren.** De eerste actie van Claude Desktop na het lezen van dit document is:

1. Lees de volledige `.ai/`-documentatie (in elk geval `CLAUDE.md`, `PRODUCT_VISION.md`, `UI_GUIDELINES.md`, `DESIGN_SYSTEM.md`, `COMPONENT_LIBRARY.md`).
2. Analyseer de volledige, actuele codebase (niet vertrouwen op dit document als vervanging daarvan — dit document is context, geen bron van waarheid over de code zelf).
3. Beoordeel de huidige UI daadwerkelijk (lees de gerenderde structuur van Dashboard/Projecten/ProjectDetail/Planning en de gedeelde componenten).
4. Vergelijk die huidige UI expliciet met `PRODUCT_VISION.md` en `UI_GUIDELINES.md` — benoem concreet elk verschil (kleuren, thema, typografie, spacing, componentgebruik).
5. Bevestig bij de eigenaar wat er met het huidige, niet-gecommitte Sprint 3-werk moet gebeuren (committen, meenemen in de redesign, of iets anders).
6. Maak pas dán een implementatieplan voor de **volledige Premium UI Redesign** (Sprint 3.1) en leg dat ter goedkeuring voor.

---

# 12. Definitieve instructie aan Claude Desktop

Vanaf dit moment draagt **Claude Desktop de volledige verantwoordelijkheid** voor de verdere ontwikkeling van NMZ GO.

**De belangrijkste regel, zonder uitzondering:**

**Schrijf NOOIT direct code zonder eerst:**
1. De documentatie te lezen.
2. De codebase te analyseren.
3. Een plan te maken.
4. Goedkeuring te vragen aan de eigenaar.

**Pas daarna implementeren** — en ook dan: build draaien, fouten zelfstandig oplossen, een volledig overzicht geven, en pas na expliciete goedkeuring committen (zie hoofdstuk 9).

Dit document bevat zoveel mogelijk concrete, geverifieerde details uit de terminalsessie zodat er geen context verloren gaat bij de overstap. Waar iets een aanname of interpretatie is in plaats van een hard feit (zoals de reconstructie in hoofdstuk 7), is dat expliciet benoemd.

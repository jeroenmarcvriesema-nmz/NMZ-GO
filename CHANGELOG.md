# NMZ GO — Changelog

## Sprint 3.1b — Premium Redesign v2 (light-primair, meer merkkleur, groter, meer animatie)

### Nieuw
- **[FEATURE]** Thema-default omgedraaid: **light is nu het primaire thema** (geen `prefers-color-scheme`-fallback meer zonder opgeslagen voorkeur) — dark blijft volledig gelijkwaardig beschikbaar.
- **[FEATURE]** `SectionHeading`-component toegevoegd (`components/ui/SectionHeading.tsx`) — vervangt alle losse `<h2>`-sectiekoppen door een consistente kop met gele merk-kicker, over ~12 pagina's.
- **[FEATURE]** Nieuwe animatie-tokens: `ease-brand` (premium ease-out-curve voor hover/press) en `animate-page-in` (subtiele fade/slide-in bij het laden van een pagina).

### Verbeteringen
- **[UI]** `Sidebar`/`MobileNav`/`Topbar`/`MobileTopbar` zijn niet langer permanent donker — ze zijn nu theme-reactief, consistent met de rest van het scherm. Desktop `Topbar` en `MobileTopbar` hebben een vaste gele bovenrand als merkaccent.
- **[UI]** Merkkleur (geel/rood) prominenter aanwezig: kicker-balken bij sectiekoppen, sterker verzadigde badge-/KPI-achtergronden, een vleugje merkkleur op neutrale iconvlakken.
- **[UI]** Kaarten, containers en KPI-typografie een stap groter (`p-5`→`p-6`, KPI-waarden `text-3xl`→`text-4xl`, paginatitels `text-2xl`→`text-3xl`).
- **[UI]** Statische lijstrijen (Medewerkers, Rapporten) hebben nu een subtiele hover-state; kaarten behouden hun bestaande lift+schaduw-hover.
- **[DOCS]** `PRODUCT_VISION.md`/`DESIGN_SYSTEM.md`/`UI_GUIDELINES.md` bijgewerkt naar de nieuwe richting (light-primair, merkkleur, typografie-schaal, animatie-tokens).

## Sprint 3.1 — Premium UI Redesign (dark mode)

### Nieuw
- **[FEATURE]** Volledig dark-mode-systeem toegevoegd: Tailwind class-based dark mode, nieuwe `surface-dark`-tokenschaal (`tailwind.config.ts`), een `themeStore.ts` (Zustand + `persist`) die de voorkeur opslaat in `localStorage`, en een inline FOUC-preventiescript in `index.html` dat vóór React-mount de juiste class zet (respecteert `prefers-color-scheme` zonder opgeslagen voorkeur).
- **[FEATURE]** Thema-toggle (zon/maan-icoon) toegevoegd aan `Sidebar` (desktop) en `MobileTopbar` (mobiel).
- **[FEATURE]** Vaste, kleine uitlog-knop linksonder toegevoegd aan `PageWrapper` (zichtbaar op mobiel, vult het gat dat `MobileNav` geen uitlog-actie had) en aan `MijnWerkbonnen.tsx` (die geen `PageWrapper` gebruikt).

### Verbeteringen
- **[UI]** `dark:`-variants consistent toegepast over alle `components/ui/`, `components/dashboard/`, `components/werkbon/`, `components/taak/`-bestanden en alle 14 pagina's, volgens een vaste kleurmapping (zie `.ai/DESIGN_SYSTEM.md`).
- **[UI]** Hardcoded inline `style={{backgroundColor:...}}`-achtergronden (`PageWrapper`, `MijnWerkbonnen`, `PageLoader`, `AuthGuard`-foutscherm) vervangen door Tailwind-classes met een dark-pendant.
- **[CLEANUP]** Losse hardcoded hex-kleuren voor voortgangspercentages (`MijnWerkbonnen.tsx`, `WerkbonUitvoeren.tsx`) vervangen door theme-aware Tailwind-classes.

### Bekende beperkingen (bewust uitgesteld)
- Nieuwe UI-primitives (`Select`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`, generieke `Table`) en skeleton loaders blijven een aparte, latere taak (zie `.ai/FEATURE_BACKLOG.md`).
- Ingelogde schermen zijn gecontroleerd via code-review en build-verificatie; een volledige interactieve doorloop met een echt account is nog niet uitgevoerd.

## Sprint 3 — Projecten & Planning (mock-data)

### Kritieke fix
- **[CRITICAL FIX]** `Sidebar.tsx` en `MobileNav.tsx` hersteld — een eerdere, afgebroken restyling liet beide bestanden middenin een statement eindigen, waardoor `npm run build` faalde. Afgemaakt met het nieuwe donkere navthema (`NAV_BG`/`NAV_BORDER`) consistent met `Topbar`/`MobileTopbar`.

### Nieuw
- **[FEATURE]** Projecten-overzicht (`/projecten`), projectdetail (`/projecten/:id`) en weekplanning (`/planning`) toegevoegd voor de beheerdersrol, inclusief navigatie in sidebar en mobiele tab-bar. Draait op mock data (`useProjecten.ts`) — dezelfde aanpak als het bestaande dashboard, met TODO's voor de latere Supabase-koppeling.
- **[FEATURE]** Dashboard uitgebreid naar 6 KPI's gebaseerd op projectstatus (lopend, vandaag actief, niet gestart, op schema, vertraging, opleveringen).
- **[FEATURE]** Projectdetail → tab "Planning" toont nu de echte (mock) ingeplande dagen voor dat project, i.p.v. een herhaling van start-/einddatum.
- **[FEATURE]** Projectdetail → "Medewerkers koppelen"-modal werkt nu functioneel (in-memory) in plaats van een no-op.

### Verbeteringen
- **[UI]** Lege-staat op `/projecten` vervangen door een Tabler-icoon + uitleg + "filters wissen"-actie (was een kale emoji, in strijd met de iconregels).
- **[UI]** Consistente hover-transities toegevoegd aan de planningsitems op `/planning`.
- **[CLEANUP]** Ongebruikte imports (`IconX`, `berekenVoortgang`) verwijderd uit `ProjectDetail.tsx`.

### Bekende beperkingen (bewust uitgesteld)
- Projecten/Planning/medewerkerskoppeling zijn volledig mock-data — niets wordt persistent opgeslagen in Supabase. Een echte `projecten`-tabel, migratie en RLS-policies zijn een aparte, volgende sprint.
- Dark mode blijft niet uitgerold — deze sprint blijft binnen het bestaande lichte thema.

## v1.0.0 — MVP Release

### Auth fixes
- **[CRITICAL FIX]** `AuthInitializer` component toegevoegd in `App.tsx` root die auth eenmalig initialiseert. Voorheen riep elke Guard component `useAuth()` aan met eigen `onAuthStateChange` listener → race condition → infinite loading state.
- **[FIX]** `useAuth` hook vereenvoudigd naar pure store-reader zonder eigen `useEffect`. Voorkomt meervoudige listeners.
- **[FIX]** Login navigeert naar `/` (RootRedirect) in plaats van direct naar `/dashboard`. RootRedirect stuurt op basis van rol door na het laden van het profiel.
- **[FIX]** Automatisch profiel aanmaken bij `PGRST116` fout (profiel bestaat niet in database maar gebruiker wel in auth).
- **[FIX]** Foutscherm toegevoegd als profiel laden mislukt — geen oneindige loading state meer.

### Database / RLS fixes
- **[CRITICAL FIX]** `42P17 infinite recursion` opgelost. Oude policies deden `EXISTS (SELECT 1 FROM profiles ...)` binnen een policy op `profiles` → zelfreferentie → recursie.
- **[FIX]** `SECURITY DEFINER` functie `get_mijn_rol()` geïntroduceerd. Draait als postgres-eigenaar buiten RLS-context. Alle policies gebruiken deze functie voor rolcheck.
- **[FIX]** `FOR ALL` policy op `werkbon_medewerkers` opgesplitst in aparte `INSERT`/`DELETE` policies met correcte `WITH CHECK`.
- **[FIX]** `uitnodigingen_update` had `or true` (iedereen kon updaten) → beperkt tot beheerder of ingelogde gebruiker.
- **[FIX]** Indexen toegevoegd op veelgebruikte kolommen (status, datum, werkbon_id, medewerker_id).
- **[FIX]** Alle bestaande (recursieve) policies worden verwijderd voor opnieuw aanmaken.
- **[FIX]** Idempotente migratie — veilig meerdere keren uitvoerbaar.

### Code kwaliteit
- **[CLEANUP]** Alle tijdelijke debug `console.log` statements verwijderd uit productie build (51 statements in App.tsx, authStore.ts, Login.tsx).
- **[CLEANUP]** `RouteLogger` debug component verwijderd.
- **[CLEANUP]** Debug UI banner verwijderd van loginpagina.
- **[CLEANUP]** `useLocation` import verwijderd (was alleen voor debug).
- **[CLEANUP]** `versie debug-2` commentaar verwijderd.

### Bevestigd werkend
- ✅ Login met Supabase Auth
- ✅ Sessie herstel bij pagina refresh
- ✅ Logout
- ✅ Beheerder → dashboard
- ✅ Medewerker → mijn werkbonnen
- ✅ RLS: medewerker ziet alleen eigen werkbonnen
- ✅ RLS: beheerder ziet alles
- ✅ Geen infinite recursion
- ✅ Geen infinite loading state

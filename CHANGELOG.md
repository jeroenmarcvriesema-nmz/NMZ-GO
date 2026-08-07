# NMZ GO — Changelog

## Mock data eruit — dashboard en werkdag op echte data

### Database
- **[FEATURE]** Migratie 006: tabel `werkdag_logs` (één rij per monteur per werkbon per dag), met RLS, een unieke sleutel tegen dubbele starts, een check dat stoppen niet vóór starten kan, en een trigger die een monteur tot de kolom `stop_tijd` beperkt — dezelfde tweetrapsopzet als 003 en 005.

### Verbeteringen
- **[FEATURE]** `useWerkdag` draaide op `sessionStorage`: de werkdag verdween bij het sluiten van het tabblad en de beheerder zag er niets van. Nu echte rijen, met herstel bij het openen van het scherm — begint een monteur op zijn telefoon, dan ziet hij dat terug na een herstart. Start gebruikt een upsert, zodat twee keer tikken nooit een tweede rij of een nieuwe starttijd oplevert.
- **[FEATURE]** `useDashboard` draaide volledig op verzonnen cijfers. Nu berekend uit de werkbonnen van vandaag, hun taken en foto's, en de werkdag_logs. De drempels die bepalen wanneer het dashboard alarm slaat (verwachte starttijd, uren zonder foto, uren voor zichtbare voortgang) staan als benoemde constanten bij elkaar bovenin de hook.
- **[UI]** De KPI's op het dashboard kwamen uit de `projecten`-tabel. Die vult zich pas met de ClickUp-synchronisatie, dus tot die tijd toonde het dashboard zes nullen boven een tabel die wél werk liet zien. Ze komen nu uit de werkbonnen van vandaag; labels aangepast ("Lopend vandaag", "Gestart", "Achter op schema", "Gem. voortgang").
- **[UI]** Dashboard heeft nu een lege staat en een foutstaat in plaats van een lege tabel.
- **[UI]** De start- en stopknop van de werkdag blokkeren tijdens het opslaan. Bij een wisselende verbinding in het veld tikte een monteur anders twee keer.

### Geverifieerd
- ✅ Monteur kan eigen werkdag starten en stoppen
- ✅ Monteur kan zijn starttijd niet vervalsen (`42501`)
- ✅ Monteur kan geen werkdag op naam van een collega aanmaken
- ✅ Monteur kan zijn eigen log niet verwijderen (0 rijen — beheerderswerk)
- ✅ Beheerder ziet werkbon, taken, foto's, team én starttijd van de monteur in één keer
- ✅ Alle foreign-keynamen komen overeen met wat de queries aannemen
- ✅ `npm run build` groen

## Designfase afgerond — systeemstaten en meldingen

### Nieuw
- **[FEATURE]** `EmptyState` — één gedeelde vorm voor "er is hier nog niets", met verplicht Tabler-icoon en hoogstens één actie. Vervangt acht handgemaakte lege staten die elk net anders waren.
- **[FEATURE]** `ErrorState` — tegenhanger voor een mislukte load. Hiervóór was een mislukte load niet te onderscheiden van een lege lijst: je zag in beide gevallen niets.
- **[FEATURE]** `Toaster` + `toastStore` — niet-blokkerende actiefeedback. Een fout blijft 7 seconden staan, de rest 4.

### Verbeteringen
- **[UI]** Alle zes `alert()`-popups vervangen door toasts. Een blokkerende browserpopup past niet bij een app die premium moet aanvoelen, en is op een telefoon in het veld ronduit hinderlijk.
- **[UI]** Alle emoji-als-icoon verwijderd (🎉 ✅ ⚠️ 📋 📄 👥 🔒) en vervangen door Tabler-iconen, conform de iconregel in `UI_GUIDELINES.md`. Dit was dezelfde overtreding die in Sprint 3 al één keer is gecorrigeerd.
- **[UI]** `Modal` is theme-reactief geworden. De kop was nog permanent donker (`bg-gray-900`) en week daarmee af van de rest van de schil sinds 3.1b. Ook een echt sluit-icoon in plaats van het teken ✕, plus `role="dialog"` en `aria-modal`.
- **[UI]** Foutstaten aangesloten op `Werkbonnen` en `Projecten`: mislukt laden toont nu een melding met "Opnieuw proberen" in plaats van een lege lijst.
- **[FIX]** `WerkbonNieuw` controleerde de inserts van taken en monteurs niet. Bij een fout kreeg de monteur een lege werkbon zonder dat iemand het merkte; nu volgt er een melding.
- **[FIX]** Foutmelding bij het afronden van een werkbon benoemt nu de oorzaak — "je staat niet meer op deze werkbon" bij een geblokkeerde update, en een verbindingsmelding bij een technische fout.

### Bewust niet gedaan
- `Select`, generieke `Table` en `Dialog` zijn **niet** gebouwd. Geen enkel scherm heeft ze nodig: er staat nergens een `<select>`, de drie tabellen verschillen te veel voor een zinnige gemene deler, en er is geen destructieve actie in de UI. `Dialog` is wél gebouwd en weer verwijderd toen bleek dat hij geen afnemer had.
- Het thema is **niet** omgezet naar dark-primair. `PRODUCT_VISION.md` schrijft dat voor, maar in Sprint 3.1b is bewust voor light-primair gekozen — dat is de latere beslissing en die blijft staan.

## Migratie 005 — uitnodigingen, registratie en werkbonstatus

### Database / RLS fixes
- **[CRITICAL FIX]** Rol-escalatie bij registratie gedicht. `handle_new_user()` las de rol uit `raw_user_meta_data`, en die metadata komt rechtstreeks uit `supabase.auth.signUp({ options: { data } })`. Eén registratie met `{ rol: 'beheerder' }` volstond om beheerder te worden. De `with check` uit migratie 003 hielp niet: de trigger draait als `security definer` en gaat langs RLS heen. De rol staat nu vast op `'medewerker'`.
- **[CRITICAL FIX]** `uitnodigingen` stond open voor iedereen: `uitnodigingen_select` had als voorwaarde letterlijk `true`, waardoor een niet-ingelogde bezoeker alle tokens van alle tenants kon opvragen. Aangetoond met een testrij. De tabel is nu beperkt tot de beheerder van de eigen tenant; `uitnodigingen_update` idem, met `with check`.
- **[FEATURE]** `uitnodiging_controleren(token)` toegevoegd (`security definer`, uitvoerbaar door `anon`): geeft alleen `true`/`false` terug, zodat de registratiepagina een link kan controleren zonder dat de tabel open hoeft.
- **[FIX]** Een uitgenodigde belandde altijd in de oudste tenant. `handle_new_user()` haalt de tenant nu uit de uitnodiging en verzilvert die in dezelfde transactie — daarmee is een token ook niet meer twee keer bruikbaar.
- **[FIX]** Een toegewezen medewerker kan zijn eigen werkbon afronden. Nieuwe policy `werkbonnen_update_toegewezen` plus trigger `werkbonnen_guard_kolommen`, die zo iemand beperkt tot de kolom `status` en tot de waarden `bezig`/`voltooid`.

### Verbeteringen
- **[FIX]** `WerkbonUitvoeren.tsx` meldde "voltooid" terwijl de update door RLS werd geblokkeerd — een update die nul rijen raakt is voor PostgREST een geldige lege respons. Er wordt nu op `error` én op het aantal geraakte rijen gecontroleerd, met een zichtbare foutmelding. De `alert()` is vervangen door de reguliere foutstijl.
- **[FIX]** Foutafhandeling toegevoegd op `WerkbonDetail.tsx` (statuswissel) en `TaakItem.tsx` (afvinken en foto-upload) — die negeerden hun `error` stilzwijgend.

### Geverifieerd
- ✅ Medewerker kan eigen werkbon op `bezig`/`voltooid` zetten, niet terug op `open`
- ✅ Medewerker kan geen andere kolom van zijn werkbon wijzigen (`42501`)
- ✅ Medewerker kan de werkbon van een collega niet afronden (0 rijen)
- ✅ Niet-ingelogde bezoeker ziet geen enkel uitnodigingstoken meer
- ✅ `uitnodiging_controleren()` werkt wel voor `anon` — registratieflow blijft heel
- ✅ Beheerder ongewijzigd: status, adres, uitnodiging aanmaken; tenant-grens blijft dicht
- ✅ `npm run build` groen

## Migratie 003 — rol-escalatie op profiles

### Database / RLS fixes
- **[CRITICAL FIX]** Privilege escalation gedicht op `public.profiles`. `profiles_update_own` had een `using`- maar geen `with check`-clausule; Postgres valt dan terug op de `using`-expressie (`auth.uid() = id`), en `id` verandert niet bij een update. Elke medewerker kon daardoor met één PostgREST-call zijn eigen `rol` op `beheerder` zetten én zijn `tenant_id` naar een andere klant wijzigen — waarmee zowel de rolscheiding als de tenant-isolatie uit migratie 002 wegviel. Gevonden met de rollentest die `GIT_WORKFLOW.md` voorschrijft na elke RLS-wijziging.
- **[FIX]** Trigger `profiles_guard_rol_tenant` toegevoegd: houdt wijzigingen aan `rol` (tenzij beheerder) en aan `tenant_id` (altijd) tegen. Een trigger ziet `OLD`/`NEW` en kan daarom zien of een kolom verandert; een RLS-policy kan dat niet. Een tenant-verhuizing loopt vanaf nu bewust alleen nog via `service_role`.
- **[FIX]** `with check` toegevoegd op `profiles_update_own` en `profiles_update_beheerder` als tweede beveiligingslaag. De `using`-expressies zijn ongewijzigd, dus de rolscheiding blijft exact zoals in 002.
- **[FIX]** `profiles_insert_own` beperkt tot `rol = 'medewerker'` — hetzelfde gat bestond bij het aanmaken van een profiel, en de trigger dekt alleen updates af.
- **[FIX]** Vaste `search_path` op `update_updated_at()` (melding `function_search_path_mutable` van de Supabase-linter).

### Geverifieerd
- ✅ Verificatiequery na migratie 002: rollen, `SECURITY DEFINER`-functies en policies kloppen, geen `42P17` recursie
- ✅ Medewerker kan zichzelf niet promoveren (`42501`)
- ✅ Medewerker kan niet naar een andere tenant springen (`42501`)
- ✅ Medewerker kan geen profiel als beheerder aanmaken (`42501`)
- ✅ Medewerker kan nog wel eigen naam wijzigen en eigen taken afvinken
- ✅ Beheerder kan nog wel medewerkers promoveren/degraderen en werkbonnen aanmaken
- ✅ Beheerder kan een profiel niet naar een andere tenant verhuizen
- ✅ `npm run build` groen

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

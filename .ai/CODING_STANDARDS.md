# CODING_STANDARDS.md — Code-stijl, TypeScript, React, performance, naamgeving

## Algemene coding standards

- **Domeinnamen in het Nederlands**, consistent met de bestaande codebase (`werkbon`, `taak`, `voltooid`, `aangemaakt_door`, `opmerking`). Generieke/technische namen (props als `variant`, `size`, `loading`) in het Engels. Meng dit niet binnen één concept.
- **Stijl volgt het bestand dat je bewerkt**: geen puntkomma's aan het einde van statements, single quotes, 2 spaties indentatie. Dit is de bestaande stijl in de hele codebase — introduceer geen ander format.
- **Functiecomponenten only**, geen class components.
- **Named exports** voor components en hooks (`export function Foo`), geen default exports behalve waar het framework dit vereist (pagina-bestanden die als route-element worden geïmporteerd mogen `export default`, zoals nu al het patroon is in `pages/`).
- **`any` is een uitzondering**, nooit een gewoonte (zie TypeScript-regels hieronder).
- **Geen ongebruikte imports/variabelen**, ook al staat `noUnusedLocals`/`noUnusedParameters` uit in `tsconfig.json` — dat is een build-instelling, geen vrijbrief.
- **Kleine, pure helperfuncties** horen in `lib/utils.ts` (zie `formatDatum`, `berekenVoortgang`, `initialen`, `genereerBonnummer` als stijlvoorbeeld).
- **Consistentie boven persoonlijke voorkeur.** Als een patroon al meermaals in de codebase voorkomt, volg dat patroon — ook als een "betere" aanpak bekend is.

---

## TypeScript-regels

- **`strict: true` blijft aan.** Schrijf code die daarbinnen past — verzwak `tsconfig.json` nooit om een fout te omzeilen.
- **Gedeelde types in `src/types/index.ts`.** Nieuwe domeinentiteiten (zoals `Werkbon`, `Taak`, `Project`) horen daar, niet lokaal gedupliceerd in een component.
- **Union types voor status/rol-achtige velden** (`Rol`, `WerkbonStatus`, `ProjectStatus`) in plaats van losse strings — maakt een foutieve waarde een compile-time fout in plaats van een runtime-verrassing.
- **`any` uitsluitend bij het direct mappen van rauwe Supabase join-resultaten** (zoals in `useWerkbonnen`) — map dat resultaat meteen naar een getypeerd object, geef `any` nooit door aan de rest van de functie of aan props.
- **Optionele velden expliciet** (`taken?: Taak[]`) in plaats van losse `| undefined`-toevoegingen door de codebase heen.
- **`import type`** voor type-only imports.
- **Geen `@ts-ignore`/`@ts-expect-error`** zonder commentaar dat uitlegt waarom het niet anders kan.
- **`npm run build` (dus `tsc`) moet slagen zonder fouten** voordat een taak als afgerond geldt.

---

## React-regels

- **Functiecomponenten + hooks only.** Geen class components, geen legacy lifecycle-methods.
- **State lokaal houden** tenzij het écht gedeeld moet zijn tussen niet-verwante componenten. Globale state is voorbehouden aan `authStore` — introduceer geen tweede globale store zonder overleg.
- **Data-fetching via hooks**, nooit rechtstreeks in een pagina- of componentbody. Volg het patroon `{ data, loading, error, refetch }` zoals `useWerkbonnen`/`useWerkbon`.
- **`useEffect`-dependency-arrays kloppen altijd** — geen bewust weggelaten dependency zonder commentaar dat uitlegt waarom (zoals de eenmalige init in `AuthInitializer`).
- **Eén auth-listener voor de hele app**, in `AuthInitializer`. Nooit een tweede `onAuthStateChange`-listener toevoegen in een component (zie `CLAUDE.md` → Verboden acties).
- **Expliciete loading/error/empty states** in elke pagina die data toont.
- **Stabiele domein-ID's als keys** bij lijsten (`werkbon.id`, `taak.id`), nooit array-index bij dynamische lijsten.
- **`forwardRef`** voor herbruikbare UI-componenten die een DOM-element blootgeven.

---

## Performance-regels

- **Geen premature optimalisatie** voor een app op deze schaal (~30 gebruikers). Leesbaarheid en correctheid wegen zwaarder dan micro-optimalisatie.
- **Wel altijd vermijden:** onnodige re-fetches (gebruik `refetch` uit bestaande hooks in plaats van een hook opnieuw te mounten), en dubbele Supabase-subscriptions/listeners.
- **Query alleen wat nodig is.** Supabase `select`-statements vragen expliciet de benodigde relaties op (zoals `taken(*, fotos(*))`), geen brede `select('*')` gevolgd door client-side filteren van een grote dataset.
- **Foto-uploads houden rekening met mobiele verbindingen in het veld** — nooit een blokkerende UI tijdens uploads, gebruik bestaande loading-states.
- **Bundle-grootte bewust bewaken** — geen zware nieuwe dependency voor iets dat met de bestaande stack opgelost kan worden (zie `ARCHITECTURE.md` → Technologie-stack).
- **`useMemo`/`useCallback` pas toevoegen bij een aantoonbaar performanceprobleem**, niet standaard overal.
- **Geen inline object/array-literals als props** in hot paths (lijsten van werkbonnen/taken) waar dit onnodige re-renders veroorzaakt.

---

## Naamgevingsconventies

- **Componenten:** `PascalCase`, bestandsnaam gelijk aan het component (`WerkbonKaart.tsx` exporteert `WerkbonKaart`).
- **Hooks:** `camelCase`, altijd beginnend met `use` (`useWerkbonnen`, `useProjecten`), bestandsnaam gelijk aan de hook.
- **Pagina's:** `PascalCase`, genoemd naar het scherm in domeintaal (`Werkbonnen.tsx`, `WerkbonDetail.tsx`, `MijnWerkbonnen.tsx`).
- **Variabelen en functies:** `camelCase`, Nederlandse domeintermen voor domeinlogica (`berekenVoortgang`, `genereerBonnummer`), Engelse termen voor generieke technische concepten (`loading`, `error`, `handleSubmit`).
- **Types/interfaces:** `PascalCase`, enkelvoud voor entiteiten (`Werkbon`, `Taak`, `Foto`, `Project`), `PascalCase` union types voor status/rol (`Rol`, `WerkbonStatus`, `ProjectStatus`).
- **Databasetabellen en -kolommen:** `snake_case`, Nederlandse domeintaal, meervoud voor tabellen die een verzameling entiteiten representeren (`werkbonnen`, `taken`, `profiles`), enkelvoud/logisch voor koppeltabellen (`werkbon_medewerkers`).
- **Routes:** kleine letters, Nederlandse domeintaal, `-` als separator waar nodig (`/mijn-werkbonnen`, `/werkbonnen/nieuw`).
- **CSS-utilities buiten Tailwind** (in `index.css`): `kebab-case` (`.pb-safe`, `.nav-dark`).
- **Consistentie boven "correctheid":** als een bestaand, net-iets-anders genoemd patroon al in de codebase staat, sluit daarbij aan in plaats van de "juistere" naam door te voeren.

---

## Documentatieregels (in code)

- **`.ai/`-documentatie** (dit bestand en de andere in deze map) is de bron van waarheid voor werkwijze en regels — bijwerken zodra architectuur, stack of afspraken structureel wijzigen.
- **`CHANGELOG.md`** (projectroot) documenteert wat er functioneel is veranderd, in mensentaal — geen ruwe commit-lijst.
- **`README.md`** (projectroot) blijft de installatie- en opstartgids — houd dit synchroon met de werkelijke opstartstappen.
- **Code-commentaar is schaars en gericht.** Alleen schrijven wanneer de *waarom* niet uit de code zelf blijkt (een verborgen constraint, een workaround voor een specifieke bug, gedrag dat een lezer zou verrassen). Geen commentaar dat herhaalt wat de code al zegt.
- **Geen losse planningsdocumenten, decision-logs of analysebestanden** toevoegen aan de repository tenzij de gebruiker daar expliciet om vraagt.
- **SQL-migraties documenteren zichzelf** via duidelijke sectie-commentaren en, waar zinvol, verificatie-queries aan het einde (zoals in `001_initial.sql`).

---

## Regels voor refactoring

- **Refactoren is een expliciete taak, geen bijvangst.** Een bugfix of nieuwe feature neemt geen ongevraagde opruiming van omliggende code mee.
- **Gedrag blijft identiek**, tenzij de refactor-taak expliciet gedragsverandering vraagt.
- **Refactor in de kleinst mogelijke, zelfstandig te beoordelen stap.** Niet in één commit zowel structuur als gedrag wijzigen.
- **Voor het refactoren van gedeelde code** (hooks, `lib/utils.ts`, `authStore`, componenten in `components/ui/`): controleer eerst alle aanroepplekken, en test na de refactor elke geraakte aanroepplek.
- **Geen refactor die de mappenstructuur uit `ARCHITECTURE.md` verlaat** zonder overleg.
- **Na een refactor geldt dezelfde Definition of Done** (zie `CLAUDE.md`) als bij nieuwe functionaliteit.

---

## Regels voor nieuwe features

- **Toets elke nieuwe feature aan `PROJECT.md`**: helpt dit een beheerder of medewerker vandaag, binnen het bestaande kernproces? Zo niet, bevestig scope met de gebruiker voordat je bouwt.
- **Begin met het datamodel** (types + eventueel migratie) als de feature nieuwe of gewijzigde data nodig heeft, daarna pas de hook, dan de UI — niet andersom.
- **Hergebruik eerst, bouw pas nieuw als er echt niets passends bestaat** (zie `DESIGN_SYSTEM.md` → Componentregels).
- **Nieuwe pagina's volgen het bestaande layout- en guard-patroon** (`PageWrapper`, `Sidebar`/`MobileNav`, `BeheerderGuard`/`AuthGuard` in `App.tsx`).
- **RLS wordt gelijktijdig met de feature gebouwd**, niet erna toegevoegd.
- **Nieuwe features die de sprint-scope overstijgen** (zie `SPRINTS.md`), worden gesplitst in kleinere, zelfstandig afrondbare stukken.
- **Een feature is pas klaar volgens de Definition of Done in `CLAUDE.md`**, niet zodra de happy path in de browser werkt.

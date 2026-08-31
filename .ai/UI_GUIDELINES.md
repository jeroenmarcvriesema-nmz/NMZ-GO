# UI_GUIDELINES.md — Concrete UI-patronen

Dit document werkt de visie uit [`PRODUCT_VISION.md`](./PRODUCT_VISION.md) uit in concrete, bruikbare patronen: een modern enterprise design in de lijn van Linear/Stripe/Notion, gebouwd op de bestaande design tokens uit `tailwind.config.ts` (zie [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)). Voor de daadwerkelijke componenten die deze patronen implementeren, zie [`COMPONENT_LIBRARY.md`](./COMPONENT_LIBRARY.md).

---

## Spacing

Basis: Tailwind's standaard 4px-grid. Gebruik uitsluitend stappen uit deze schaal, geen losse arbitrary waarden.

| Token | Waarde | Gebruik |
|---|---|---|
| `1` / `1.5` | 4px / 6px | Micro-afstand: tussen icoon en label, tussen badge-tekst en rand |
| `2` / `3` | 8px / 12px | Afstand tussen gerelateerde elementen (knop-groepen, form-velden onderling) |
| `5` / `6` | 20px / 24px | Interne padding van kaarten en compacte containers (bestaand: `Card`/`KpiCard`/`StatCard` gebruiken `p-6`) |
| `6` / `10` | 24px / 40px | Padding van pagina-content en grotere containers (bestaand: `PageWrapper` gebruikt `p-6 md:p-10`) |
| `10`+ | 40px+ | Scheiding tussen grote pagina-secties (koppen/KPI-rijen gebruiken `mb-10`) |

**Regel:** witruimte is een ontwerpbeslissing, geen restruimte. Liever één extra stap in de spacing-schaal dan een dichtgepakt scherm.

---

## Typography

Lettertype: `Inter` (sans), `JetBrains Mono` voor monospace-behoefte (bonnummers, codes) — zie `DESIGN_SYSTEM.md`.

| Niveau | Klasse (richtlijn) | Gebruik |
|---|---|---|
| Paginatitel | `text-3xl font-extrabold tracking-tight` | H1 bovenaan een pagina (zie `Dashboard`, `ProjectDetail`) |
| Display / KPI-waarde | `text-4xl font-extrabold tracking-tight` | Grote cijfers (zie `KpiCard`, `StatCard`) |
| Sectiekop | via `SectionHeading` (`text-lg font-bold` + gele kicker-balk) | Elke sectiekop binnen een pagina/kaart — geen losse `<h2>` meer, zie `components/ui/SectionHeading.tsx` |
| Kaarttitel | `text-base font-bold tracking-tight` | Titel binnen een kaart (zie `WerkbonKaart`) |
| Body | `text-sm` | Standaardtekst, formulierlabels, kaartinhoud |
| Caption / meta | `text-xs text-tekst-gedempt dark:text-white/55` | Secundaire info: datums, aantallen, hints |
| Micro-label | `text-[10px] font-bold uppercase tracking-widest` | Sectielabels in navigatie (zie `Sidebar` → `NavSection`) |

**Regel — contrast gaat vóór terughoudendheid.** Gedempte tekst gebruikt `text-tekst-gedempt` (`#6B7280`, 4,83:1 op wit) met `dark:text-white/55`. Gebruik **nooit** `text-gray-400`/`text-gray-300` of een donkere variant onder `white/50` voor tekst: die zaten hiervoor op 191 plekken en halen met 2,54:1 (licht) en 3,79:1 (donker) de WCAG-norm van 4,5:1 niet. Dat botst rechtstreeks met de toetssteen uit `PROJECT.md` — een monteur die dit in fel zonlicht moet lezen. `text-tekst-fijn` (3,63:1) bestaat uitsluitend voor decoratie: chevrons, placeholders, een leeg fotovakje. Zet daar nooit een zin in.

**Regel:** maximaal twee gewichten per scherm naast elkaar (bv. `font-semibold` voor labels, `font-bold`/`font-extrabold` voor nadruk) — geen wildgroei aan font-weights.

---

## Grid & layout

- **Contentbreedte:** pagina-content leeft binnen `PageWrapper` (zie `COMPONENT_LIBRARY.md`), met responsive padding (`p-6` mobiel → `p-10` desktop) en een `animate-page-in`-transitie bij het laden.
- **Kaartgrids:** KPI's en stat-cards in een responsive grid (bv. 2 kolommen mobiel → 4 kolommen desktop), consistente `gap-4`/`gap-5` tussen kaarten.
- **Twee-kolomslayouts** (bv. detail + zijpaneel) alleen vanaf `lg:` — op kleinere schermen altijd één kolom, gestapeld in logische leesvolgorde.
- **Sidebar-breedte:** vast (huidige implementatie: `md:ml-60` content-offset) — content herschaalt, de sidebar zelf niet.

---

## Cards

- Basisvorm: witte (light) / `surface-dark-2` (dark) achtergrond, dunne rand, `rounded-lg`, `shadow-sm`.
- **Interactieve kaarten** (aanklikbaar, zoals `WerkbonKaart`) krijgen een hover-state: lichte lift (`hover:-translate-y-0.5`), iets diepere schaduw (`hover:shadow-md`), een accentrand in merkkleur bij hover, en de `ease-brand`-timing-functie i.p.v. default ease.
- **Statuskaarten** (`Card` met `accent`) gebruiken een linker accentrand (`border-l-4`) in plaats van een volledig gekleurde achtergrond — kleur blijft functioneel, niet alleen decoratief.
- Interne padding consistent: `p-6` voor standaardkaarten.

---

## Buttons

- Vijf varianten (bestaand, zie `COMPONENT_LIBRARY.md` → Button): `primary` (merkgeel, hoofdactie), `secondary` (neutraal, meest gebruikte actie), `danger`/`red` (destructief/kritiek), `ghost` (laagste nadruk, bv. annuleren).
- **Maximaal één `primary`-knop per scherm/sectie** — meerdere primaire knoppen naast elkaar breekt de "één duidelijke actie"-regel uit `PRODUCT_VISION.md`.
- Alle knoppen hebben een `loading`-state (spinner + disabled) voor elke actie die een netwerkcall triggert — nooit een knop die "hangt" zonder feedback.
- `active:scale-[0.98]` als tactiele feedback bij klikken (bestaand patroon) — dit soort micro-interactie blijft de norm voor alle klikbare elementen.
- **Een knop die er staat maar niets doet, bestaat niet.** `disabled` is
  alleen toegestaan zolang een handeling loopt (`loading`). Kan een actie nog
  niet omdat er eerst iets anders moet gebeuren, dan blijft de knop tikbaar
  en legt hij bij een tik uit wát er ontbreekt — met de handeling die het
  oplost ernaast. Redenen: een uitgeschakelde knop krijgt op een telefoon
  geen tik door (geen klik, geen reactie), en `title` is een
  muisaanwijzertekst die daar nooit verschijnt. Zo ontstond in augustus de
  melding *"ik kan niet afvinken"*.
- **Zet geen `aria-disabled` op zo'n knop.** Dat zegt tegen wie het scherm
  laat voorlezen dat er niets gebeurt, terwijl de knop juist uitleg geeft.
  Verwijs met `aria-describedby` naar die uitleg.
- **Dezelfde handeling twee keer in beeld krijgt niet twee keer hetzelfde
  gewicht.** Staat een actie al in een vaste balk, dan is dezelfde knop
  elders in de pagina omlijnd en niet gevuld — twee identieke gevulde pillen
  boven elkaar leest als een fout in het scherm.

---

## Forms

- Elk formulierveld heeft een zichtbaar `label`, nooit alleen een placeholder als label-vervanging.
- Foutstaat: rode rand + focus-ring in merkrood + duidelijke foutmelding onder het veld (bestaand patroon in `Input`/`Textarea`).
- Hint-tekst (grijs, klein) alleen tonen als er geen fout is — fout heeft altijd voorrang op hint.
- Focus-state: gele rand + subtiele ring (`focus:ring-2 focus:ring-brand-yellow/20`) — consistent op elk formulierelement, ook toekomstige `Select`/`Checkbox`/`Radio`.
- Formuliervalidatie geeft directe, per-veld feedback — geen alleen-bij-submit verzamelfoutmelding boven het formulier als losstaand patroon.

---

## Tables

*(Nog geen `Table`-component in de codebase — deze richtlijn geldt zodra deze gebouwd wordt, zie `FEATURE_BACKLOG.md`/`COMPONENT_LIBRARY.md`.)*

- Compacte rijen, dunne horizontale scheidingslijnen (geen zware celranden).
- Kolomkoppen: klein, `uppercase`, `tracking-wide`, gedempte kleur — consistent met de micro-label-stijl hierboven.
- Rij-hover: subtiele achtergrondverandering (`hover:bg-surface-2`), nooit een schaduw of lift-effect (dat is voorbehouden aan kaarten).
- Status altijd via `Badge`/`StatusBadge`, nooit via losse gekleurde tekst.
- Op mobiel: tabellen worden een gestapelde kaartenlijst (zoals `WerkbonKaart`) in plaats van horizontaal scrollen, tenzij de tabel inherent breed moet blijven (dan `overflow-x-auto` in een bewuste wrapper — zie `DESIGN_SYSTEM.md` → Responsive regels).

---

## Modals & dialogs

- **Modal** (bestaand, zie `COMPONENT_LIBRARY.md`): voor gestructureerde content/formulieren binnen een overlay. Donkere header-balk met titel + sluitknop, `Escape` en klik-buiten sluiten de modal.
- **Dialog** (nog te bouwen, zie `FEATURE_BACKLOG.md`): een lichtere, kleinere variant specifiek voor bevestigingsvragen ("Weet je zeker dat je deze werkbon wilt verwijderen?") — altijd met een duidelijke primaire en secundaire actie, destructieve acties in `danger`/`red`-variant.
- Nooit meer dan één modal/dialog tegelijk open.
- Overlay altijd `bg-black/50` (bestaand patroon) — consistent verduisteringsniveau door de hele app.

---

## Toasts

*(Nog geen `Toast`-component in de codebase — zie `FEATURE_BACKLOG.md`/`COMPONENT_LIBRARY.md`.)*

- Kort, non-blocking feedback voor acties die niet in beeld blijven (bv. "Werkbon opgeslagen", "Foto geüpload").
- Positie: rechtsonder op desktop, onderaan boven de mobiele navigatie op mobiel (respecteer `.pb-safe`).
- Auto-dismiss na enkele seconden, met een handmatige sluitoptie.
- Varianten: success (bevestiging), error (mislukte actie), nooit puur decoratief — elke toast communiceert een resultaat van een actie.

---

## Sidebars

- Sidebar (desktop, `≥ md`) is **theme-reactief**: wit/`surface-dark` achtergrond met een rand (`border-gray-100 dark:border-white/10`), vast, met secties gegroepeerd onder kleine uppercase-labels (bestaand patroon, zie `Sidebar.tsx`). Niet langer permanent donker — volgt light/dark net als de rest van het scherm.
- Actieve route: merkgeel accent op tekst/icoon (in beide thema's identiek, voor contrast), niet-actieve routes gedempt (`text-gray-500 dark:text-white/60`).
- Sidebar toont altijd de ingelogde gebruiker (`Avatar` + naam), de theme-toggle en een uitlog-actie onderaan.

## Topbars

- Desktop `Topbar`: theme-reactieve balk (wit/`surface-dark-2`), sticky, met een vaste 3px gele bovenrand als merkaccent, paginatitel links, acties (knoppen) rechts.
- Mobiele `MobileTopbar`: zelfde theme-reactieve stijl + gele bovenrand, compact, met het app-icoon + titel + theme-toggle.

## Mobile navigation

- `MobileNav`: onderaan het scherm, theme-reactief (wit/`surface-dark`), vaste iconen + labels voor de belangrijkste routes van de ingelogde rol.
- Actieve staat: merkgeel; inactief: gedempt (`text-gray-400 dark:text-white/40`) — consistent met de sidebar.
- Respecteert `pb-safe` voor apparaten met een home-indicator.

## Dashboard layout

- Bovenaan: KPI-rij (`KpiCard`s) voor de belangrijkste getallen in één oogopslag.
- Daaronder: een primaire content-sectie (bv. `ProjectTabel`) naast of onder een secundaire sectie (`ActivityFeed`/`MeldingItem`).
- Geen dashboard-widget zonder duidelijk doel — elk blok beantwoordt één vraag ("hoeveel werkbonnen staan open", "wat is er recent gebeurd").

---

## Icongebruik

- Uitsluitend `@tabler/icons-react` — geen tweede icon-set introduceren.
- Iconen ondersteunen tekst, vervangen die zelden volledig (uitzondering: compacte mobiele navigatie waar ruimte schaars is, altijd met een label eronder).
- Consistente afmetingen per context: klein (`w-3.5 h-3.5`/`w-4 h-4`) in inline meta-info, middel (`w-5 h-5`) in knoppen/kaarten, groter (`w-7 h-7`+) in nadrukkelijke iconvlakken (zie `PageLoader`).

---

## Animaties & transitions

- Standaardduur: 150–200ms voor micro-interacties (hover, focus, klik), tot 500ms voor grotere statusveranderingen (bv. `ProgressBar`-vulling).
- Easing: `ease-brand` (`cubic-bezier(0.16, 1, 0.3, 1)`, gedefinieerd in `tailwind.config.ts`) voor hover-/press-interacties op kaarten en knoppen — een subtiele, premium "ease-out"-curve. Nog steeds geen bounce/elastic-easing.
- Animatie bevestigt altijd een gebruikersactie of geeft richting (bv. kaart die optilt bij hover, knop die inklinkt bij klik) — nooit puur decoratieve animatie zonder functie.
- **Pagina-inhoud** krijgt een subtiele `animate-page-in` (fade + 4px omhoog, 250ms) bij het laden van een route — dit is de enige "paginaovergang"; geen zware route-transitie-animaties, en expliciet **geen scroll-triggered reveal-animaties** (elementen die pas verschijnen tijdens het scrollen) — dat past niet bij het rustige, snelle karakter van de app.

---

## Loading states

- Elke asynchrone actie heeft een zichtbare loading-state: knop-spinner (`loading`-prop op `Button`), volledige paginaspinner (`PageLoader`) alleen bij initiële paginalaad.
- Geen enkele actie mag een "stille" wachttijd hebben zonder enige visuele indicatie.

## Skeleton loaders

*(Geïmplementeerd in `components/ui/Skelet.tsx`: `Skelet`, `SkeletKaart`, `SkeletLijst`, `SkeletDashboard`. In gebruik op het dashboard en de werkbonnenlijst.)*

- Voor content die merkbare tijd nodig heeft om te laden (dashboardlijsten, tabellen): een skeleton-vorm die de uiteindelijke layout benadert, in plaats van een centrale spinner die de hele pagina blokkeert.
- Skeletons gebruiken een subtiele pulse-animatie, in neutrale surface-tinten — geen merkkleur in een skeleton.

## Empty states

*(Nog geen gedeelde `EmptyState`-component — zie `COMPONENT_LIBRARY.md`.)*

- Elke lijst/overzicht die leeg kán zijn (geen werkbonnen vandaag, geen taken, geen medewerkers) toont een geruststellende, informatieve empty state: korte uitleg + eventueel een primaire actie ("Nieuwe werkbon aanmaken").
- Nooit een kaal wit vlak of een technische "no data"-tekst.

## Error states

*(Nog geen gedeelde `ErrorState`-component — zie `COMPONENT_LIBRARY.md`.)*

- Bij een mislukte data-load: duidelijke, Nederlandstalige uitleg + een "opnieuw proberen"-actie (bestaand patroon in `App.tsx` → `AuthGuard`-foutscherm — dit wordt het uitgangspunt voor een generieke `ErrorState`-component).
- Nooit een rauwe technische foutmelding (stacktrace, Supabase-foutcode) rechtstreeks aan de gebruiker tonen — zie `CODING_STANDARDS.md`/`ARCHITECTURE.md` voor foutafhandelingsregels.

---

## Vergrendelde schermen

Een scherm dat leesbaar is maar niet bewerkbaar (`readOnly`) mag nooit
alleen zijn knoppen kwijtraken. Dat is niet te onderscheiden van een scherm
dat stuk is, en dat is precies hoe het in het veld wordt gemeld.

- Bovenaan het vergrendelde deel staat **wát** er op slot zit, **waarom**, en
  **de handeling die het opent**. Niet als grijze regel maar als blok.
- Bij elk afzonderlijk item staat één regel met een slotje en dezelfde reden
  in het kort. Een uitleg bovenaan is na twintig items scrollen uit beeld.
- De uitleg noemt de handeling, niet de toestand: *"Start je werkdag om dit
  punt af te vinken"*, niet *"vergrendeld"*.

---

## Hover-effecten

- Klikbare kaarten: lichte lift + schaduwtoename + accentrand (zie "Cards" hierboven).
- Klikbare rijen/lijst-items: achtergrondverandering, geen lift.
- Knoppen: achtergrond-verdieping per variant (bestaand patroon in `Button`) + `active:scale-[0.98]` bij klik.
- Navigatie-items: tekstkleur wordt voller/witter bij hover (mobiele nav/sidebar), geen achtergrondverandering nodig bovenop de kleurverandering.

---

## Responsive gedrag

- **Mobile-first** in elke nieuwe layout — zie `DESIGN_SYSTEM.md` → Responsive regels voor de volledige regels (touch targets, geen horizontale scroll, safe-areas).
- Breakpoint-gebruik consistent met bestaand patroon: `md:` als omslagpunt tussen mobiele en desktop-navigatie/layout (zie `PageWrapper`).
- Content-dichtheid neemt toe naarmate het scherm breder wordt (meer kolommen, meer info per rij), nooit andersom — mobiel toont nooit meer tegelijk dan desktop.

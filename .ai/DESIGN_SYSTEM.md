# DESIGN_SYSTEM.md — UI/UX, visuele taal en componentregels

## UI/UX-principes

1. **Eén duidelijke actie per scherm.** Geen schermen met meerdere concurrerende primaire acties.
2. **Directe feedback op elke actie.** Afvinken, uploaden, opslaan — de gebruiker ziet altijd meteen dat het gelukt is (of niet), nooit een stille state-verandering.
3. **Nederlands, doelgroep-taal.** Geen technisch jargon in de UI ("RLS-fout", "PGRST116") — foutmeldingen zijn mensentaal.
4. **Weinig taps/clicks tot het doel.** Een monteur die een taak wil afvinken en een foto wil uploaden, doet dat in zo min mogelijk stappen vanaf het inloggen.
5. **Status is altijd zichtbaar.** Werkbon-status (open/bezig/voltooid), taakvoortgang en projectstatus zijn overal waar relevant met kleur én tekst zichtbaar — kleur alleen is nooit voldoende (zie "Toegankelijkheid" hieronder).
6. **Vertrouwen door consistentie.** Dezelfde actie (bv. "opslaan", "afvinken") ziet er overal in de app hetzelfde uit en gedraagt zich overal hetzelfde.
7. **Leeg is geen fout.** Een lege lijst (geen werkbonnen vandaag) krijgt een geruststellende empty state, geen technisch aandoende lege pagina.

Toetssteen voor elke UI-beslissing: kan een monteur dit met één duim, in de zon, met een paar procent batterij, zonder uitleg gebruiken?

---

## Design tokens

Alle design tokens staan in `tailwind.config.ts` — dit is de **enige** bron voor kleuren, radius en shadows. Nieuwe UI gebruikt deze tokens, nooit hardcoded waarden.

**Kleuren:**
- Merk: `brand.yellow` (`#F0B420`) met `-dark` (`#C8930D`) en `-light` (`#FEF3CC`) — primaire acties, én een zichtbaar terugkerend merkelement (kicker-balk in `SectionHeading`, Topbar-accentlijn).
- Merk secundair: `brand.red` (`#BC2934`) met `-dark`/`-light` — waarschuwingen/kritieke acties.
- Ondergrond (light): `surface` (wit) / `surface-2` (`#ECEAE4`) / `surface-3` (`#E0DDD5`) — gelaagde achtergronden. App-achtergrond: `#F4F3EF` (`index.css` → `body`).
- Ondergrond (dark): `surface-dark` (`#0d1117`) / `surface-dark-2` (`#161b22`) / `surface-dark-3` (`#1c2129`).

**Typografie:** `Inter` als sans-serif (primair lettertype voor de hele app), `JetBrains Mono` voor eventuele monospace-behoefte (bv. bonnummers). Zie `UI_GUIDELINES.md` → Typography voor de schaal (paginatitels `text-3xl`, sectiekoppen via `SectionHeading` `text-lg`, KPI-waarden `text-4xl`).

**Radius-schaal:** `sm` (8px), `DEFAULT` (14px), `lg` (20px) — geen arbitrary radius-waarden tenzij er echt geen passende token is.

**Shadow-schaal:** `sm` / `DEFAULT` / `md` / `lg`, oplopend in diepte — gebruikt om hiërarchie tussen kaarten, modals en de pagina-achtergrond aan te geven.

**Animatie-tokens:** `ease-brand` (`transitionTimingFunction.brand`, `cubic-bezier(0.16, 1, 0.3, 1)`) voor hover-/press-interacties op kaarten en knoppen; `animate-page-in` (`fade-in-up`-keyframe, 250ms) voor het rustig laten verschijnen van pagina-inhoud bij het laden van een route. Geen bounce/elastic-easing, geen scroll-triggered reveal-animaties (zie `UI_GUIDELINES.md` → Animaties).

**Dark mode:** **light mode is de primaire, standaard ervaring** (zie `PRODUCT_VISION.md` → Thema-strategie); dark mode is volledig gelijkwaardig geïmplementeerd en met één klik bereikbaar. Tailwind class-based (`darkMode: 'class'`), aangestuurd door `src/store/themeStore.ts` (Zustand + `persist`, `localStorage`-key `nmzgo-theme`) en een inline FOUC-preventiescript in `index.html`. **Elk vlak is theme-reactief**, inclusief `Sidebar`/`MobileNav`/`Topbar` — die zijn niet meer permanent donker, maar volgen light/dark net als de rest van het scherm.

---

## Componentregels

- **`components/ui/` blijft domein-loos.** Deze componenten kennen geen `werkbon`, `taak` of rol — alleen generieke props (`variant`, `size`, `loading`, `fullWidth`, etc.), zie `Button.tsx` als referentie-implementatie.
- **Domeincomponenten** (`werkbon/`, `taak/`, `dashboard/`) mogen domeinkennis bevatten, maar blijven presentational: ze ontvangen data via props of roepen een hook aan die van buitenaf beschikbaar is — geen fetch-logica diep in een render-boom.
- **Bestaande component uitbreiden, niet dupliceren.** Nodig is een net-iets-andere knop, kaart of badge? Breid de bestaande component uit met een prop/variant, bouw geen tweede, bijna-identieke component.
- **Props expliciet typeren** via een `interface <Component>Props` in hetzelfde bestand, tenzij het type breder herbruikt wordt (dan naar `types/`).
- **`forwardRef`** voor herbruikbare UI-componenten die een DOM-element blootgeven.
- **Geen impliciete side effects** in presentational components: geen fetch, geen Supabase-call, geen navigatie vanuit `components/ui/` of `components/<domein>/`.
- **Composability boven een muur van boolean-props.** Liever children/slots dan tien losse flags die elk een ander uiterlijk aanzetten.

---

## Responsive regels

- **Mobile-first, altijd.** Ontwerp en implementeer eerst voor smalle schermen (telefoon van een monteur), breid daarna uit met Tailwind's `sm:`/`md:`/`lg:`.
- **Bestaand navigatiepatroon volgen:** `Sidebar` (desktop) + `MobileNav` (smal scherm) + `Topbar`/`PageWrapper` als gedeelde shell. Nieuwe pagina's hergebruiken deze layoutcomponenten, ze bouwen geen eigen layout. Sectiekoppen binnen een pagina gebruiken `SectionHeading` (`components/ui/SectionHeading.tsx`), geen losse `<h2>`-styling.
- **Touch targets ≥ ~44px hoogte** voor knoppen en afvink-acties — zie de bestaande `Button`-sizes als referentie.
- **Foto-upload en taak-afvink-flows altijd expliciet op mobiel testen** — dit is de belangrijkste flow voor de grootste gebruikersgroep (medewerkers).
- **Geen horizontale scroll** op mobiele breedtes, behalve bewust binnen een los element (bv. een brede tabel in een `overflow-x-auto`-wrapper).
- **Safe-area's respecteren** op mobiel (zie de bestaande `.pb-safe`-utility in `index.css`) voor elementen die tegen de onderkant van het scherm aanzitten.

## Toegankelijkheid

- **Kleur is nooit de enige status-indicator** — combineer status-kleur altijd met tekst/icoon, ook voor leesbaarheid in fel zonlicht op een telefoonscherm.
- Voldoende contrast tussen tekst en achtergrond, gecontroleerd in **zowel** het lichte als het donkere kleurenpalet.

---

## Tailwind-regels

- **Design tokens uit `tailwind.config.ts`** gebruiken, geen hardcoded hex-kleuren of losse pixelwaarden in componenten.
- **`cn()` uit `lib/utils.ts`** voor het combineren van classNames, geen handmatige string-concatenatie.
- **Variant/size opzoektabellen** voor component-styling (zoals in `Button`: een `base`-string plus objecten per variant/size), geen lange conditionele ternaries inline in JSX.
- **`className`-prop altijd overrideable** bij herbruikbare componenten: geef de meegegeven `className` als laatste argument aan `cn(...)` mee.
- **Geen losse `<style>`-blokken of CSS-modules** — alle styling via Tailwind-utilities; `index.css` is uitsluitend voor Tailwind-lagen en globale basisstijl.
- **Radius/shadow via de gedefinieerde schaal** (`rounded-sm`/`rounded`/`rounded-lg`, `shadow-sm`/`shadow`/`shadow-md`/`shadow-lg`), geen arbitrary values (`rounded-[13px]`) tenzij er echt geen passend token bestaat.
- **`dark:`-variants zijn standaard**, niet de uitzondering — elke nieuwe kleur-/achtergrond-/tekstclass krijgt een `dark:`-pendant volgens de mapping in `UI_GUIDELINES.md`, consistent met de bestaande componenten.

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
- Merk: `brand.yellow` (`#F0B420`) met `-dark` (`#C8930D`) en `-light` (`#FEF3CC`) — primaire acties.
- Merk secundair: `brand.red` (`#BC2934`) met `-dark`/`-light` — destructieve/waarschuwende acties.
- Ondergrond: `surface` (wit) / `surface-2` (`#ECEAE4`) / `surface-3` (`#E0DDD5`) — gelaagde achtergronden.
- App-achtergrond: `#F4F3EF` (gedefinieerd in `index.css` op `body`).

**Typografie:** `Inter` als sans-serif (primair lettertype voor de hele app), `JetBrains Mono` voor eventuele monospace-behoefte (bv. bonnummers).

**Radius-schaal:** `sm` (8px), `DEFAULT` (14px), `lg` (20px) — geen arbitrary radius-waarden tenzij er echt geen passende token is.

**Shadow-schaal:** `sm` / `DEFAULT` / `md` / `lg`, oplopend in diepte — gebruikt om hiërarchie tussen kaarten, modals en de pagina-achtergrond aan te geven.

**Dark mode:** de **agreed strategie** staat vastgelegd in [`PRODUCT_VISION.md`](./PRODUCT_VISION.md) — dark mode wordt de primaire ervaring, met light mode volledig ondersteund en een door de gebruiker opgeslagen voorkeur. De **huidige implementatie** is daar nog niet: er is nu geen systeemwide dark/light modus-toggle, alleen één losse utility (`.nav-dark` in `index.css`) voor de al donkere sidebar/mobiele navigatie. Bouw geen losse `dark:`-variants als terloopse bijvangst van een andere taak — de daadwerkelijke uitrol is een eigen, geplande taak (zie `FEATURE_BACKLOG.md` → Sprint 4). Tot die taak is uitgevoerd, is de content-UI **single-theme (licht)**.

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
- **Bestaand navigatiepatroon volgen:** `Sidebar` (desktop) + `MobileNav` (smal scherm) + `Topbar`/`PageWrapper` als gedeelde shell. Nieuwe pagina's hergebruiken deze layoutcomponenten, ze bouwen geen eigen layout.
- **Touch targets ≥ ~44px hoogte** voor knoppen en afvink-acties — zie de bestaande `Button`-sizes als referentie.
- **Foto-upload en taak-afvink-flows altijd expliciet op mobiel testen** — dit is de belangrijkste flow voor de grootste gebruikersgroep (medewerkers).
- **Geen horizontale scroll** op mobiele breedtes, behalve bewust binnen een los element (bv. een brede tabel in een `overflow-x-auto`-wrapper).
- **Safe-area's respecteren** op mobiel (zie de bestaande `.pb-safe`-utility in `index.css`) voor elementen die tegen de onderkant van het scherm aanzitten.

## Toegankelijkheid

- **Kleur is nooit de enige status-indicator** — combineer status-kleur altijd met tekst/icoon, ook voor leesbaarheid in fel zonlicht op een telefoonscherm.
- Voldoende contrast tussen tekst en achtergrond binnen het bestaande lichte kleurenpalet.

---

## Tailwind-regels

- **Design tokens uit `tailwind.config.ts`** gebruiken, geen hardcoded hex-kleuren of losse pixelwaarden in componenten.
- **`cn()` uit `lib/utils.ts`** voor het combineren van classNames, geen handmatige string-concatenatie.
- **Variant/size opzoektabellen** voor component-styling (zoals in `Button`: een `base`-string plus objecten per variant/size), geen lange conditionele ternaries inline in JSX.
- **`className`-prop altijd overrideable** bij herbruikbare componenten: geef de meegegeven `className` als laatste argument aan `cn(...)` mee.
- **Geen losse `<style>`-blokken of CSS-modules** — alle styling via Tailwind-utilities; `index.css` is uitsluitend voor Tailwind-lagen en globale basisstijl.
- **Radius/shadow via de gedefinieerde schaal** (`rounded-sm`/`rounded`/`rounded-lg`, `shadow-sm`/`shadow`/`shadow-md`/`shadow-lg`), geen arbitrary values (`rounded-[13px]`) tenzij er echt geen passend token bestaat.
- **Geen `dark:`-variants** zonder afgesproken dark-mode-strategie (zie "Design tokens" hierboven en `ROADMAP.md`).

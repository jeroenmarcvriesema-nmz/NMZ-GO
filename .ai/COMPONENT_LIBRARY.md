# COMPONENT_LIBRARY.md — Documentatie van standaardcomponenten

Dit document beschrijft elke bestaande component in `src/components/`, plus de componenten die volgens [`UI_GUIDELINES.md`](./UI_GUIDELINES.md) nog ontbreken. **Voor elke nieuwe UI-behoefte: controleer eerst dit document** voordat je een nieuwe component bouwt (zie `CLAUDE.md` → AI werkwijze en Verboden acties: geen duplicate componenten).

---

## `components/ui/` — generieke bouwstenen

### Button
**Bestand:** `src/components/ui/Button.tsx`
**Doel:** enige knop-implementatie in de app; alle klikbare acties gaan hierdoorheen.
**Gebruik:** `<Button variant="primary" size="md" loading={saving} onClick={...}>Opslaan</Button>`
**Styling:** `forwardRef`, basisstijl + variant-/size-opzoektabellen (zie `UI_GUIDELINES.md` → Buttons), `active:scale-[0.98]` als klikfeedback.
**Varianten:** `variant`: `primary` (merkgeel, hoofdactie) · `secondary` (neutraal, default) · `danger` (gedempt rood, waarschuwend) · `red` (vol rood, destructief) · `ghost` (laagste nadruk). `size`: `sm` · `md` · `lg`. Props: `loading`, `fullWidth`.
**Regels:** maximaal één `primary`-knop per scherm/sectie. Elke knop die een async actie triggert, gebruikt `loading`. Geen nieuwe knop-component bouwen voor een net-iets-andere stijl — uitbreiden via een nieuwe variant.

### Card
**Bestand:** `src/components/ui/Card.tsx`
**Doel:** generieke content-container met optionele klik-interactie en statusaccent.
**Gebruik:** `<Card accent="yellow" onClick={...}>...</Card>`
**Styling:** witte achtergrond, dunne rand, `rounded-lg`, `shadow-sm`, `p-5`. Bij `onClick`: hover-lift + schaduw + geel randaccent.
**Varianten:** `accent`: `yellow` · `red` · `green` (linker accentrand, `border-l-4`).
**Regels:** basis voor alle domeinkaarten (zie `WerkbonKaart`). Geen los kaart-element met eigen padding/radius/shadow bouwen — hergebruik `Card`.

### Badge / StatusBadge
**Bestand:** `src/components/ui/Badge.tsx`
**Doel:** korte statuslabel; `StatusBadge` is een domeinspecifieke wrapper voor `WerkbonStatus`.
**Gebruik:** `<Badge variant="green">Actief</Badge>` of `<StatusBadge status={werkbon.status} />`
**Styling:** `inline-flex`, `text-xs font-bold`, `rounded-md`, `px-2.5 py-1`.
**Varianten:** `yellow` · `red` · `green` · `gray` (default) · `blue` · `orange`.
**Regels:** status wordt **altijd** via `Badge`/`StatusBadge` getoond, nooit via losse gekleurde tekst. Nieuwe statustypes (bv. `ProjectStatus`) krijgen een eigen `<Type>Badge`-wrapper naar het patroon van `StatusBadge`, geen nieuwe losse badge-implementatie.

### Input / Textarea
**Bestand:** `src/components/ui/Input.tsx`
**Doel:** enige tekstinvoer-implementatie (single-line en multi-line).
**Gebruik:** `<Input label="Bonnummer" error={errors.bonnummer} {...register} />`
**Styling:** `forwardRef`, `rounded-sm`, gele focus-ring, rode rand/ring bij `error`.
**Varianten:** props `label`, `error`, `hint` (Input ook). Fout heeft altijd voorrang op hint.
**Regels:** elk veld heeft een zichtbaar `label`. Nieuwe invoervarianten (`Select`, `Checkbox`, `Radio`) volgen dezelfde visuele taal (rand, focus-ring, error-patroon) — zie "Nog te bouwen" hieronder.

### Modal
**Bestand:** `src/components/ui/Modal.tsx`
**Doel:** overlay-container voor gestructureerde content/formulieren.
**Gebruik:** `<Modal open={open} onClose={close} title="Nieuwe taak" size="md">...</Modal>`
**Styling:** `bg-black/50`-overlay, witte content met donkere titelbalk (`bg-gray-900`), sluit op `Escape` en klik-buiten.
**Varianten:** `size`: `sm` · `md` · `lg`.
**Regels:** nooit meer dan één modal tegelijk open. Voor eenvoudige bevestigingsvragen: zie `Dialog` onder "Nog te bouwen" — geen volledige `Modal` misbruiken voor een simpele ja/nee-vraag.

### Avatar
**Bestand:** `src/components/ui/Avatar.tsx`
**Doel:** gebruikersavatar op basis van initialen (geen profielfoto's in het datamodel).
**Gebruik:** `<Avatar naam={profile.naam} size="sm" />`
**Styling:** ronde vorm, merkgele achtergrond, initialen via `initialen()`-helper uit `lib/utils.ts`.
**Varianten:** `size`: `sm` · `md` · `lg`.
**Regels:** initialen-logica leeft in `lib/utils.ts`, niet dupliceren in de component.

### ProgressBar
**Bestand:** `src/components/ui/ProgressBar.tsx`
**Doel:** generieke voortgangsbalk (taken-voortgang, projectvoortgang).
**Gebruik:** `<ProgressBar value={voortgang} variant={voortgang === 100 ? 'green' : 'yellow'} />`
**Styling:** afgeronde balk, gradient-vulling, `transition-all duration-500`.
**Varianten:** `size`: `sm` · `md`. `variant`: `yellow` · `green` · `red` (schiet automatisch naar `green` bij 100%).
**Regels:** waarde wordt geklemd tussen 0–100 in de component zelf — aanroepers hoeven dit niet te doen.

### Spinner / PageLoader
**Bestand:** `src/components/ui/Spinner.tsx`
**Doel:** `Spinner` = inline laad-indicator (o.a. gebruikt in `Button`); `PageLoader` = volledige-paginaversie voor initiële laadmomenten (bv. tijdens auth-check).
**Gebruik:** `<PageLoader />` als route-level fallback; `<Spinner className="h-6 w-6" />` inline.
**Styling:** SVG-spinner in merkgeel; `PageLoader` toont daarbij het app-icoon in een geel vlak.
**Regels:** `PageLoader` alleen bij het laden van een hele pagina/route (zie `App.tsx` guards), niet binnen een kaart of lijst — daar hoort een lokale `Spinner` of straks een skeleton (zie "Nog te bouwen").

---

## `components/dashboard/` — dashboardspecifiek

### KpiCard
**Bestand:** `src/components/dashboard/KpiCard.tsx`
**Doel:** grote kerncijfers bovenaan het beheerdersdashboard.
**Gebruik:** `<KpiCard label="Open werkbonnen" value={12} icon={<IconClipboardList />} variant="yellow" />`
**Styling:** witte kaart, icoonvlak, groot cijfer (`text-3xl font-extrabold`), dunne kleurbalk onderaan.
**Varianten:** `variant`: `neutral` · `green` · `yellow` · `red` · `blue`. Optioneel `sub` voor een subtekst.
**Regels:** uitsluitend voor top-level KPI's op het dashboard, niet als generieke kaart elders gebruiken — daarvoor is `Card`/`StatCard`.

### StatCard
**Bestand:** `src/components/dashboard/StatCard.tsx`
**Doel:** compactere statistiekkaart (kleiner dan `KpiCard`, geen icoon), voor secundaire cijfers.
**Gebruik:** `<StatCard label="Deze week afgerond" value={8} variant="green" />`
**Styling:** witte kaart met dunne kleurbalk bovenaan (i.p.v. onderaan zoals `KpiCard`).
**Varianten:** `variant`: `default` · `yellow` · `red` · `green` · `blue`.
**Regels:** kies `StatCard` boven `KpiCard` wanneer een icoon niet nodig/beschikbaar is; introduceer geen derde, vergelijkbare kaartvariant.

### ActivityFeed
**Bestand:** `src/components/dashboard/ActivityFeed.tsx`
**Doel:** verticale tijdlijn van recente activiteit (start, foto's, afgerond, info) op het dashboard.
**Gebruik:** `<ActivityFeed activiteit={activiteitenLijst} />` (data komt uit `useDashboard`).
**Styling:** verbonden tijdlijn-stippen met een dunne verticale lijn, icoon per activiteitstype, tijdstip rechts in monospace.
**Varianten:** activiteitstype (`start` · `fotos` · `afgerond` · `info`) bepaalt icoon + kleur, geen losse `variant`-prop.
**Regels:** typen zijn vastgelegd in `Activiteit` (`useDashboard.ts`) — een nieuw activiteitstype vereist een uitbreiding van zowel het type als de `config`-map in deze component.

### MeldingItem
**Bestand:** `src/components/dashboard/MeldingItem.tsx`
**Doel:** actiegerichte melding op het dashboard (bv. "nog niet gestart", "geen foto's", "actie vereist").
**Gebruik:** `<MeldingItem melding={melding} />`
**Styling:** compacte kaart met gekleurde achtergrond/rand per meldingstype, icoon + projectnaam + toelichting + tijdstip.
**Varianten:** meldingstype (`niet_gestart` · `geen_fotos` · `controle` · `afgerond`) bepaalt kleur/icoon.
**Regels:** onderscheid met `ActivityFeed`: `MeldingItem` is actiegericht/attentie-vragend (mogelijk iets mis), `ActivityFeed` is neutraal-informatief (wat is er gebeurd).

### ProjectTabel
**Bestand:** `src/components/dashboard/ProjectTabel.tsx`
**Doel:** projectoverzicht in tabelvorm op het dashboard, met responsief kolomgedrag.
**Gebruik:** `<ProjectTabel projecten={projectRegels} />`
**Styling:** rauwe `<table>`-implementatie (geen aparte `Table`-component, zie "Nog te bouwen"), met kolommen die progressief verbergen op kleinere schermen (`hidden md:table-cell`, `hidden lg:table-cell`) en samengevatte info op mobiel binnen de projectcel.
**Varianten:** interne `StatusPil` (project-statuslabel) en `VoortgangBalk` (mini-voortgangsbalk) zijn lokaal aan dit bestand, geen gedeelde componenten.
**Regels:** dit is het huidige referentiepatroon voor "tabel die op mobiel degradeert naar compacte info" — bij het bouwen van een generieke `Table`-component (zie `FEATURE_BACKLOG.md`), dit patroon als uitgangspunt nemen in plaats van opnieuw te bedenken.

---

## `components/layout/` — paginaschil

### PageWrapper
**Bestand:** `src/components/layout/PageWrapper.tsx`
**Doel:** de enige laag die sidebar/topbar/mobiele navigatie samenvoegt tot een paginaschil.
**Gebruik:** elke pagina in `pages/` rendert zijn content binnen `<PageWrapper title="..." actions={...}>...</PageWrapper>`.
**Styling:** desktop: `Sidebar` + `Topbar` + content; mobiel: `MobileTopbar` + content + `MobileNav`.
**Regels:** **elke pagina gebruikt `PageWrapper`** — geen pagina bouwt zijn eigen layout-shell. Nieuwe layout-elementen (bv. een breadcrumb) worden aan `PageWrapper` toegevoegd, niet per pagina losjes herhaald.

### Sidebar
**Bestand:** `src/components/layout/Sidebar.tsx`
**Doel:** primaire navigatie op desktop (`≥ md`).
**Styling:** donker (`#0d1117`), gegroepeerd onder kleine uppercase sectielabels, actieve route in merkgeel.
**Regels:** navigatie-items zijn rolafhankelijk (via `useAuth`) — een nieuwe route wordt hier expliciet toegevoegd, niet automatisch afgeleid uit `App.tsx`.

### Topbar / MobileTopbar
**Bestand:** `src/components/layout/Topbar.tsx`
**Doel:** `Topbar` = desktop paginaheader (titel + acties); `MobileTopbar` = compacte donkere mobiele header.
**Regels:** `actions` op `Topbar` is de enige plek voor pagina-brede acties (bv. "Nieuwe werkbon") — geen losse actieknoppen los in de pagina-content boven de content zelf.

### MobileNav
**Bestand:** `src/components/layout/MobileNav.tsx`
**Doel:** onderste tab-navigatie op mobiel.
**Styling:** donker, iconen + labels, actieve staat in merkgeel, respecteert `pb-safe`.
**Regels:** rolafhankelijke items, consistent met `Sidebar`'s routelijst voor dezelfde rol.

---

## `components/werkbon/` en `components/taak/` — domeincomponenten

### WerkbonKaart
**Bestand:** `src/components/werkbon/WerkbonKaart.tsx`
**Doel:** samenvattingskaart van één werkbon (adres, project, status, voortgang) in overzichtslijsten.
**Gebruik:** `<WerkbonKaart werkbon={w} linkPrefix="/werkbonnen" />`
**Styling:** bouwt op `Card` (accent geel) + `StatusBadge` + `ProgressBar`.
**Regels:** enige plek waar taken-voortgang wordt berekend via `berekenVoortgang()` voor kaartweergave — niet opnieuw herimplementeren in een andere lijstweergave.

### TaakItem
**Bestand:** `src/components/taak/TaakItem.tsx`
**Doel:** één taakregel binnen een werkbon: tonen, foto-upload, afvinken.
**Gebruik:** `<TaakItem taak={t} werkbonId={id} readOnly={!magBewerken} onRefresh={refetch} />`
**Styling:** kaart met status-afhankelijke kleur (groen bij voltooid), foto-thumbnails, camera-uploadveld, `Button` voor afvinken.
**Regels:** een taak kan **niet** afgevinkt worden zonder minstens één foto (`heeftFoto`-check) — dit is een productregel, geen losse UI-beperking; bij wijzigingen aan deze flow eerst controleren of dit nog steeds de gewenste productregel is (zie `PROJECT.md`).

---

## Nog te bouwen (volgens `UI_GUIDELINES.md` / `FEATURE_BACKLOG.md`)

Deze componenten ontbreken nog als gedeelde, herbruikbare bouwsteen. Bij de eerste keer dat een scherm dit nodig heeft: bouw de gedeelde component in `components/ui/`, gebruik hem niet ad-hoc lokaal in een pagina.

| Component | Doel | Richtlijn |
|---|---|---|
| `Select` | Dropdown-selectie, zelfde visuele taal als `Input` | Zie `UI_GUIDELINES.md` → Forms |
| `Table` (generiek) | Herbruikbare tabel-primitive | `ProjectTabel` als referentiepatroon (zie hierboven) |
| `Dialog` | Lichte bevestigingsvraag (ja/nee), geen volledige `Modal` | Zie `UI_GUIDELINES.md` → Modals & dialogs |
| `Toast` | Non-blocking actiefeedback | Zie `UI_GUIDELINES.md` → Toasts |
| `EmptyState` | Gedeelde lege-staat-weergave voor lijsten/overzichten | Zie `UI_GUIDELINES.md` → Empty states |
| `ErrorState` | Gedeelde foutweergave bij mislukte data-load | Bouwt voort op het bestaande foutscherm in `App.tsx` → `AuthGuard` |

Het bouwen van deze componenten is een eigen, geplande taak (zie `FEATURE_BACKLOG.md`) — niet iets dat terloops als bijproduct van een feature-taak wordt geïntroduceerd.

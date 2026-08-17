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

### Badge
**Bestand:** `src/components/ui/Badge.tsx`
**Doel:** kort statuslabel.
**Gebruik:** `<Badge variant="green">Afgerond</Badge>`
**Styling:** `inline-flex`, `text-xs font-bold`, `rounded-md`, `px-2.5 py-1`.
**Varianten:** `yellow` · `red` · `green` · `gray` (default) · `blue` · `orange`.
**Regels:** status wordt **altijd** via `Badge` getoond, nooit via losse gekleurde tekst. De kleur komt niet uit de aanroeper maar uit `STANDEN` in `src/lib/klusstand.ts` — dat is de enige woordenlijst voor klusstanden. Verzin geen eigen toewijzing van stand naar kleur.

> **`StatusBadge` bestaat niet meer.** Die was een wrapper om de kolom `werkbonnen.status`, en die kolom wordt door de app nergens meer geschreven. De stand wordt sindsdien **afgeleid** met `klusstand()` uit de feiten (stilgelegd → opgeleverd → voltooid → een afgevinkt punt → anders niet gestart). Bouw hem niet terug.

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

### SectionHeading
**Bestand:** `src/components/ui/SectionHeading.tsx`
**Doel:** enige sectiekop-implementatie binnen een pagina/kaart — vervangt losse `<h2 className="text-sm/text-base font-bold">`-patronen.
**Gebruik:** `<SectionHeading title="Taken" actions={<Button size="sm">...</Button>} />`
**Styling:** kleine gele "kicker"-balk vóór de titel (`w-1 h-4 bg-brand-yellow`), titel `text-lg font-bold`, optionele `actions` rechts uitgelijnd.
**Regels:** gebruik dit voor elke sectiekop, ook als er geen `actions` nodig zijn — geen nieuwe losse `<h2>`-styling per pagina.

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

### DocumentKiezer
**Bestand:** `src/components/werkbon/DocumentKiezer.tsx`
**Doel:** één PDF kiezen (werkopdracht of werktekening): tonen wat er ligt, vervangen, weghalen.
**Gebruik:** `<DocumentKiezer label="Werkopdracht (PDF)" waarde={naam} bezig={bezig} onKies={fn} onWis={fn} />`
**Styling:** één regel van minstens 56 px, gestippelde rand zolang er niets ligt, `IconFileTypePdf` in merkrood zodra er wel iets ligt.
**Regels:** uploadt zelf niets en kent de werkbon niet — hij geeft alleen het gekozen bestand door. Dat is nodig omdat het bestand bij een nieuwe bon pas ná het opslaan de opslag in kan (het pad begint met het werkbon-id) en op een bestaande bon meteen. Valideren doet `controleerDocument()` in `lib/opdracht.ts`.

### Werkdocumenten
**Bestand:** `src/components/werkbon/Werkdocumenten.tsx`
**Doel:** de werkopdracht en de werktekening beheren op een bestaande bon (kantoor).
**Gebruik:** `<Werkdocumenten werkbon={werkbon} onKlaar={refetch} />`
**Regels:** alleen op kantoorschermen. De ploeg ziet dezelfde documenten via `Klusinfo` — daar als knop om te openen, hier om te vervangen. Schrijven mag alleen wie werk mag beheren; dat wordt door de policies uit migratie 012 afgedwongen, niet door dit component.

---

## De rest van `components/ui/`

### Select
**Bestand:** `src/components/ui/Select.tsx`
**Doel:** keuze uit een vaste lijst, in dezelfde visuele taal als `Input`.
**Props:** `label?`, `error?`, `opties` (`{ waarde, label }[]`), plus alles wat een `<select>` accepteert.
**Regels:** bewust een echte `<select>` en geen nagebouwde lijst. Op een telefoon krijgt de gebruiker dan het vertrouwde keuzewiel van het toestel, en toetsenbordbediening werkt zonder dat wij iets hoeven te doen. De eigen pijl vervangt die van de browser, die per besturingssysteem anders oogt.

### Dropdown
**Bestand:** `src/components/ui/Dropdown.tsx`
**Doel:** menu met acties achter één knop — voor handelingen, niet voor het kiezen van een waarde.
**Regels:** verwar dit niet met `Select`. Een keuze die iets *opslaat* is een `Select`; een lijstje *acties* is een `Dropdown`. Zit er een onomkeerbare actie in, markeer die dan visueel apart.

### Voortgangsring
**Bestand:** `src/components/ui/Voortgangsring.tsx`
**Doel:** voortgang als ring, waar `ProgressBar` te breed of te zwaar is (dagkaart, compacte kop).
**Regels:** de kleur komt **van buiten**, als tekstklasse uit `STANDEN` — de component kiest zelf nooit een kleur. Zo blijft er één kleurtaal.

### EmptyState
**Bestand:** `src/components/ui/EmptyState.tsx`
**Doel:** één vorm voor "er is hier nog niets", op elk overzicht.
**Props:** `icon` (verplicht, Tabler-icoon — **nooit** een emoji), `titel`, `uitleg?`, `actie?`, `className?`.
**Regels:** neutraal vlak, geen rood en geen uitroepteken — een lege lijst is geen fout. Hoogstens één actie, en alleen als die actie de leegte ook echt oplost ("Nieuwe werkbon" wél, "Filters wissen" alleen wanneer er filters actief zijn).

### ErrorState
**Bestand:** `src/components/ui/ErrorState.tsx`
**Doel:** tegenhanger van `EmptyState` voor wanneer het laden mislukt. Zonder dit component is een mislukte load niet te onderscheiden van een lege lijst.
**Props:** `titel?` (standaard "Er ging iets mis"), `melding`, `onOpnieuw?`, `className?`.
**Regels:** `melding` is mensentaal, nooit een ruwe servermelding — die hoort in de console, niet op het scherm van een monteur. Toon `onOpnieuw` alleen als opnieuw proberen ook echt kan helpen.

### Toaster + toastStore
**Bestand:** `src/components/ui/Toaster.tsx`, `src/store/toastStore.ts`
**Doel:** actiefeedback die het scherm niet blokkeert. Vervangt alle `alert()`-aanroepen.
**Gebruik:** importeer `toast` uit `@/store/toastStore` en roep `toast.goed(...)`, `toast.fout(...)` of `toast.info(...)` aan. De `Toaster` zelf staat één keer in `App.tsx` en hoort nergens anders gerenderd te worden.
**Regels:** een fout blijft 7 seconden staan, de rest 4 — een monteur haalt zijn telefoon soms net uit zijn zak. Kleur zit alleen in het icoon en de rand; het vlak blijft neutraal zodat een melding niet met de merkkleur concurreert. Op mobiel staat de toast bóven de tabbalk, binnen duimbereik.

---

## De rest van `components/layout/`

### Weekkiezer / Weekkop
**Bestanden:** `src/components/layout/Weekkiezer.tsx`, `Weekkop.tsx`
**Doel:** één manier om een week te kiezen en te tonen, met weeknummer. Gebruikt op planning, werkbonnen en "mijn week".
**Regels:** `maandagVanWerkweek()` (in `lib/planning.ts`) rolt op zondag door naar de komende maandag — zonder dat opende de planning in het weekend op de week die net voorbij was. Reken die datum nergens anders opnieuw uit.

### Meldingen
**Bestand:** `src/components/layout/Meldingen.tsx`
**Doel:** de meldingenlijst in de schil, los van `MeldingItem` (dat één regel tekent).

### Foutvanger
**Bestand:** `src/components/layout/Foutvanger.tsx`
**Doel:** error boundary rond de app die crashes wegschrijft naar de tabel `fouten`.
**Regels:** wat hier binnenkomt gaat eerst door `lib/foutfilter.ts`, dat rommel van browserextensies buiten de storingenlijst houdt. Een crash die de gebruiker niet raakt, hoort niet op het scherm van de eigenaar.

---

## De rest van `components/dashboard/`

### Standbalk
**Bestand:** `src/components/dashboard/Standbalk.tsx`
**Doel:** de werkvoorraad als gestapelde balk, met of zonder legenda, plus een `rijen`-variant voor kaarten met meer ruimte.
**Regels:** gebruikt uitsluitend bestaande standkleuren uit `STANDEN`.

### Weekdoorkijk
**Bestand:** `src/components/dashboard/Weekdoorkijk.tsx`
**Doel:** vooruitblik op de week op het dashboard.
**Regels:** leest `DashboardData.doorkijk`, dat in `useDashboard` uit dezelfde smalle voorraadquery komt — géén extra ronde naar de server. Houd dat zo.

### Voorzieningentegels
**Bestand:** `src/components/dashboard/Voorzieningentegels.tsx`
**Doel:** containers en dixi's in tegelvorm op het dashboard; het volledige overzicht staat op `/voorzieningen`.
**Regels:** de bestelstand wordt afgeleid in `lib/bestelstand.ts`, niet in de component.

---

## De rest van `components/werkbon/` en `components/taak/`

De werkbon is opgeknipt in blokken die zowel op het kantoorscherm (`/werkbonnen/:id`) als op het monteursscherm gebruikt worden. Dat is bewust: er was eerder één werkbon met twee verschillende schermen eromheen, en die liepen uit de pas.

| Component | Doel |
|---|---|
| `Klusinfo` | Adres, opdrachtgever, kluiscode, documenten om te openen |
| `Klusploeg` | Wie er op de klus staat; wijzigen schrijft direct terug naar ClickUp |
| `Klusplanning` | Wanneer de klus loopt; wijzigen schrijft direct terug naar ClickUp |
| `Klusuitvoering` | De punten met hun foto's — het blok dat Vandaag én `/werkbon/:id` tekenen |
| `Klusacties` | Afronden, heropenen, stilleggen, opleveren |
| `Klusactiviteit` | Wat er met deze klus is gebeurd, uit `werkbon_gebeurtenissen` |
| `PlanningKaart` | De klus zoals hij in het weekoverzicht staat |
| `Werktijden` | Start- en eindtijd van de werkdag |
| `PuntToevoegen` | Een punt met de hand toevoegen aan een bon |
| `Opleverrapport` | De drie vrije tekstvelden en de aanvraagknop |
| `Synchronisatie` | De ClickUp-koppeling van deze bon: wat is er gelezen, wat is overgeslagen |
| `Fotoviewer` (in `taak/`) | Een foto groot bekijken, inclusief de uitleg bij een opgeruimde foto |

**Twee regels die over dit hele blok gaan:**

1. **Ploeg die vanuit NMZ GO wordt gezet, krijgt `handmatig = true`.** Dat moet: `zetPloeg` in de synchronisatieronde wist elke ronde iedereen die dat niet is. Zet je het op `false`, dan is de keuze binnen vijf minuten weg.
2. **Een opgeruimde foto is geen gebroken plaatje.** `Foto.opgeruimd_op` gevuld betekent: rij bestaat, bestand weg. `TaakItem` en het archief laten die paden buiten de ondertekening en tonen een vakje "bij ClickUp".

---

## Nog te bouwen

| Component | Doel | Richtlijn |
|---|---|---|
| `Table` (generiek) | Herbruikbare tabel-primitive | `ProjectTabel` als referentiepatroon (zie hierboven) |
| `Dialog` | Lichte bevestigingsvraag (ja/nee), geen volledige `Modal` | Zie `UI_GUIDELINES.md` → Modals & dialogs |

**Waarom deze twee nog wachten.** De bestaande tabellen verschillen te veel om nu al een gemene deler uit te destilleren. Een `Dialog` is ooit gebouwd en weer verwijderd toen bleek dat hij geen afnemer had — bouw hem op het moment dat de eerste echt onomkeerbare actie landt, niet eerder. Inmiddels zijn er wél verwijderacties (een punt weghalen); als daar een bevestiging bij hoort, is dat het moment.

Bouw ze in `components/ui/`, niet ad-hoc lokaal in een pagina.

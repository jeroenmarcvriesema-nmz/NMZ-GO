# PRODUCT_VISION.md — De visie achter NMZ GO

Dit document beschrijft hoe NMZ GO moet **aanvoelen**. Waar [`PROJECT.md`](./PROJECT.md) beschrijft *wat* NMZ GO doet en voor wie, beschrijft dit document *hoe het moet ogen en aanvoelen* terwijl het dat doet. Dit is de esthetische en merkstrategie waar [`UI_GUIDELINES.md`](./UI_GUIDELINES.md) en [`COMPONENT_LIBRARY.md`](./COMPONENT_LIBRARY.md) de concrete uitwerking van zijn.

> **Status:** dit is de **richting** voor de visuele ontwikkeling van NMZ GO, niet (nog) volledig de huidige implementatie. Zie [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) voor wat er op dit moment daadwerkelijk gebouwd is (een licht, single-theme kleurenpalet met een donkere sidebar/mobiele navigatie). Dit document is het kompas voor nieuwe schermen en voor een toekomstige, bewuste migratie naar het volledige dark-mode-systeem — niet een vrijbrief om in één taak de hele app te herstijlen. Iedere visuele wijziging blijft onderworpen aan de regels in `CLAUDE.md` (scope, implementatieplan bij grote wijzigingen, geen ongevraagde herstructurering).

---

## De kernvisie

NMZ GO is intern gereedschap, maar moet **niet aanvoelen als intern gereedschap**. Een monteur of beheerder die dagelijks inlogt, verdient een interface die net zo doordacht is als de apps van de grote consumer- en SaaS-merken — ook al gebruiken maar 30 mensen het.

**NMZ GO moet aanvoelen als een premium bedrijfsplatform.**

Inspiratiebronnen, elk om een specifieke reden:

| Bron | Wat we ervan overnemen |
|---|---|
| **Apple** | Rust, precisie, terughoudendheid — nooit meer visueel geweld dan nodig |
| **Linear** | Snelheid als gevoel: directe feedback, subtiele micro-animaties, een donker canvas dat focus geeft |
| **Notion** | Veel witruimte, duidelijke hiërarchie, content die ademt in plaats van wordt platgedrukt door UI-chrome |
| **Stripe Dashboard** | Data serieus en helder presenteren — cijfers, statussen en tabellen die vertrouwen wekken |
| **Raycast** | Keyboard-first snelheid, minimale chrome, strakke command-palette-achtige efficiëntie |

Dit is **geen** opdracht om NMZ GO te laten lijken op deze producten. Het is een kwaliteitsnorm: elk scherm wordt getoetst aan "zou dit passen naast deze producten, of voelt het als een los bij elkaar geklikt formulier?"

---

## Esthetische eigenschappen

Elk nieuw scherm en elke nieuwe component wordt getoetst aan deze eigenschappen:

- **Strak** — geen overbodige randjes, lijntjes of decoratie. Elk visueel element heeft een functie.
- **Minimalistisch** — als iets weggelaten kan worden zonder functie te verliezen, wordt het weggelaten.
- **Professioneel** — dit is bedrijfssoftware voor volwassen gebruikers, geen consumer-app met speelse elementen.
- **Rustig** — geen visuele ruis, geen concurrerende accenten, geen schreeuwerige kleuren (zie "Kleurgebruik" hieronder).
- **Veel witruimte** — content krijgt ruimte om te ademen; dichtgepakte schermen zijn een designfout, geen efficiëntiewinst.
- **Mooie animaties** — subtiel, functioneel, nooit vertragend. Animatie bevestigt een actie of geeft richting, het is geen decoratie op zich (zie `UI_GUIDELINES.md` → Animaties en transitions).
- **Moderne kaarten** — content in de UI leeft in kaarten met heldere randen en diepte via schaduw, niet via zware borders.
- **Afgeronde hoeken** — consistent via de bestaande radius-schaal (zie `DESIGN_SYSTEM.md`/`UI_GUIDELINES.md`), nooit willekeurige waarden per component.
- **Subtiele schaduwen** — schaduw geeft hiërarchie (wat ligt boven wat), nooit een zwaar drop-shadow-effect.
- **Snelle interface** — percepties van snelheid zijn net zo belangrijk als daadwerkelijke performance: directe visuele feedback, skeleton loaders in plaats van kale spinners, geen onnodige vertraging in transities (zie `UI_GUIDELINES.md`).

---

## Thema-strategie: dark mode als primaire ervaring

- **Dark mode is de primaire, standaard ervaring** van NMZ GO. Dit is de modus waarin het merk zich het beste manifesteert: rustig, focus-gevend, premium — consistent met de reeds bestaande donkere sidebar/mobiele navigatie (`#0d1117`) die nu al in de app zit.
- **Light mode wordt volledig ondersteund**, niet als bijzaak maar als gelijkwaardig, compleet uitgewerkt tweede thema — nodig voor gebruikers die in fel buitenlicht werken (relevant voor medewerkers op locatie, zie `PROJECT.md` → Doelgroep) of simpelweg een voorkeur hebben.
- **De gebruiker kan wisselen** tussen dark en light mode via een expliciete, altijd vindbare instelling.
- **De themakeuze wordt opgeslagen** per gebruiker/device, zodat de voorkeur niet bij elke sessie opnieuw ingesteld hoeft te worden.
- **Implementatie-aanpak (richtinggevend, niet bindend voor een specifieke taak):** Tailwind's `dark:`-variant-systeem met een expliciete theme-toggle, opgeslagen voorkeur (bv. `localStorage`) en een startwaarde die eventueel de systeemvoorkeur (`prefers-color-scheme`) respecteert. De daadwerkelijke implementatie is een eigen, bewust geplande taak — zie `FEATURE_BACKLOG.md`. Tot die taak is uitgevoerd, geldt de huidige single-theme (licht, met donkere navigatie) implementatie zoals beschreven in `DESIGN_SYSTEM.md`.

---

## Kleurgebruik

- **NMZ Geel** (`brand.yellow`) is de primaire accentkleur — voor primaire acties, actieve navigatiestatus, voortgang en merkidentiteit.
- **NMZ Rood** (`brand.red`) is uitsluitend voor waarschuwingen en kritieke/destructieve acties (verwijderen, fouten, kritieke status).
- **Geen overmatig kleurgebruik.** De basis van elk scherm is neutraal (surface-tinten in light mode, donkere neutrale tinten in dark mode). Kleur is een uitzondering die aandacht trekt, niet de standaardtoestand van een scherm.
- **Kleur is uitsluitend functioneel** — kleur communiceert altijd iets (status, actie, waarschuwing), nooit puur decoratief. Als een kleur weggehaald kan worden zonder dat betekenis verloren gaat, hoort die kleur er niet te staan.
- Secundaire statuskleuren (groen voor "voltooid", blauw/oranje voor tussenliggende statussen — zoals al gebruikt in `Badge`/`KpiCard`) blijven toegestaan zolang ze functioneel zijn (status-communicatie), maar worden nooit de dominante kleur van een scherm.

---

## Wat dit niet betekent

Premium en minimalistisch design mag nooit ten koste gaan van de kernprincipes uit `PROJECT.md` en `DESIGN_SYSTEM.md`:

- **Bruikbaarheid in het veld blijft leidend.** Een monteur met een vieze duim en fel zonlicht op zijn scherm gaat altijd voor esthetiek. Contrast, leesbaarheid en grote touch targets zijn niet onderhandelbaar (zie `UI_GUIDELINES.md`/`DESIGN_SYSTEM.md`).
- **Nederlands, mensentaal, één duidelijke actie per scherm** blijven staan — "premium" betekent niet "abstract" of "cryptisch".
- **Geen visuele vernieuwing zonder functie.** Een animatie, kaart-hover-effect of overgang die geen betekenis toevoegt (bevestiging, richting, hiërarchie) hoort er niet te zijn — zie het "snelle interface"-principe hierboven.
- **Kleine, beheerste stappen.** De weg naar dit visuele niveau loopt via afzonderlijke, geteste taken (zie `SPRINTS.md`, `FEATURE_BACKLOG.md`), niet via een big-bang herstyling van de hele app in één keer.

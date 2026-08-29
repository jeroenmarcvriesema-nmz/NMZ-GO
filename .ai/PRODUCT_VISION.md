# PRODUCT_VISION.md — De visie achter NMZ GO

Dit document beschrijft hoe NMZ GO moet **aanvoelen**. Waar [`PROJECT.md`](./PROJECT.md) beschrijft *wat* NMZ GO doet en voor wie, beschrijft dit document *hoe het moet ogen en aanvoelen* terwijl het dat doet. Dit is de esthetische en merkstrategie waar [`UI_GUIDELINES.md`](./UI_GUIDELINES.md) en [`COMPONENT_LIBRARY.md`](./COMPONENT_LIBRARY.md) de concrete uitwerking van zijn.

> **Status:** dit document beschrijft de daadwerkelijk uitgerolde richting (Sprint 3.1/3.1b). Zie [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) voor de concrete, huidige implementatiedetails (tokens, componentregels). Iedere volgende visuele wijziging blijft onderworpen aan de regels in `CLAUDE.md` (scope, implementatieplan bij grote wijzigingen, geen ongevraagde herstructurering).

---

## De kernvisie

NMZ GO is intern gereedschap, maar moet **niet aanvoelen als intern gereedschap**. Een monteur of beheerder die dagelijks inlogt, verdient een interface die net zo doordacht is als de apps van de grote consumer- en SaaS-merken — ook al gebruiken maar 30 mensen het.

**NMZ GO moet aanvoelen als een premium bedrijfsplatform.**

Inspiratiebronnen, elk om een specifieke reden:

| Bron | Wat we ervan overnemen |
|---|---|
| **Apple** | Rust, precisie, terughoudendheid — nooit meer visueel geweld dan nodig |
| **Linear** | Snelheid als gevoel: directe feedback, subtiele micro-animaties, een rustig canvas dat focus geeft |
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

## Thema-strategie: light mode als primaire ervaring

- **Light mode is de primaire, standaard ervaring** van NMZ GO — dit is wat een nieuwe gebruiker zonder opgeslagen voorkeur te zien krijgt. Helder, functioneel in fel buitenlicht (relevant voor medewerkers op locatie, zie `PROJECT.md` → Doelgroep), en het startpunt voor de premium uitstraling.
- **Dark mode wordt volledig ondersteund**, niet als bijzaak maar als gelijkwaardig, compleet uitgewerkt tweede thema — met één klik bereikbaar via de theme-toggle.
- **De gebruiker kan wisselen** tussen light en dark mode via een expliciete, altijd vindbare instelling (Sidebar op desktop, Topbar op mobiel).
- **De themakeuze wordt opgeslagen** per gebruiker/device (`localStorage`, via `themeStore.ts`), zodat de voorkeur niet bij elke sessie opnieuw ingesteld hoeft te worden.
- **Elk vlak volgt het gekozen thema, inclusief de chrome.** De sidebar/mobiele navigatie is niet langer permanent donker — die volgt nu ook light/dark, consistent met de rest van het scherm. Dit is coherenter voor een licht-primaire, Apple-achtige interface dan een vaste donkere balk naast een verder licht scherm.
- **Implementatie:** Tailwind's `dark:`-variant-systeem (`darkMode: 'class'`), een Zustand-store met `persist`-middleware (`themeStore.ts`), en een inline script in `index.html` dat vóór React-mount de juiste class zet om een flits van het verkeerde thema te voorkomen. Zonder opgeslagen voorkeur is de standaard altijd **light** (geen `prefers-color-scheme`-fallback naar dark).

---

## Kleurgebruik

- **NMZ Geel** (`brand.yellow`) is de primaire accentkleur — voor primaire acties, actieve navigatiestatus, voortgang, én als een zichtbaar, herkenbaar merkelement dat op elk scherm terugkomt (bv. de kicker-balk vóór sectiekoppen, een accentlijn op de Topbar).
- **NMZ Rood** (`brand.red`) blijft voor waarschuwingen en kritieke/destructieve acties, maar mag daarbinnen ook duidelijker/prominenter zichtbaar zijn dan voorheen (bv. sterker verzadigde achtergronden bij kritieke meldingen) — rood communiceert nog steeds uitsluitend urgentie, nooit puur decoratief.
- **Geel en rood zijn een herkenbaar, terugkerend merkelement**, niet langer uitsluitend spaarzaam-functioneel. De basis van elk scherm blijft neutraal (surface-tinten), maar merkkleur mag vaker en zichtbaarder terugkomen dan in de eerste, zeer terughoudende versie van dit document.
- **Kleur blijft betekenisvol** — ook als merkkleur nu vaker zichtbaar is, communiceert elke toepassing nog iets (merk/identiteit, actie, status, waarschuwing). Het verschil met de vorige versie van deze richtlijn: merkidentiteit (geel als "dit is NMZ GO") is nu zelf een geldige reden, niet alleen status/actie.
- **Merkgeel is een vlakkleur, geen tekstkleur.** `brand-yellow` op een witte balk is 1,87:1 en in fel zonlicht onleesbaar — precies de situatie waarin deze app gebruikt wordt. Vlakken en iconen mogen vol merkgeel zijn; een wóórd in merkgeel gebruikt `brand-yellow-tekst` (`#8F6706`, 5,11:1). Dit is geen smaakkwestie maar een leesbaarheidsgrens.
- **Waar merkgeel als volvlak staat, is dat de primaire actie.** Het actieve menu-item en de dagkolom van vandaag dragen een zachte gele tint met een gele accentrand in plaats van hetzelfde volvlak — anders betekent één kleurvlak zowel "hier druk je op" als "je bent hier". De rolbadge is om dezelfde reden neutraal: die las als een knop, naast een statusbadge die er wél uitzag als een badge.
- Secundaire statuskleuren (groen voor "voltooid", blauw/oranje voor tussenliggende statussen) blijven functioneel en worden nooit de dominante kleur van een scherm — de basis blijft neutraal, geel/rood zijn de herkenbare accenten daarbovenop.

---

## Wat dit niet betekent

Premium en minimalistisch design mag nooit ten koste gaan van de kernprincipes uit `PROJECT.md` en `DESIGN_SYSTEM.md`:

- **Bruikbaarheid in het veld blijft leidend.** Een monteur met een vieze duim en fel zonlicht op zijn scherm gaat altijd voor esthetiek. Contrast, leesbaarheid en grote touch targets zijn niet onderhandelbaar (zie `UI_GUIDELINES.md`/`DESIGN_SYSTEM.md`).
- **Nederlands, mensentaal, één duidelijke actie per scherm** blijven staan — "premium" betekent niet "abstract" of "cryptisch".
- **Geen visuele vernieuwing zonder functie.** Een animatie, kaart-hover-effect of overgang die geen betekenis toevoegt (bevestiging, richting, hiërarchie) hoort er niet te zijn — zie het "snelle interface"-principe hierboven.
- **Kleine, beheerste stappen.** De weg naar dit visuele niveau loopt via afzonderlijke, geteste taken (zie `SPRINTS.md`, `FEATURE_BACKLOG.md`), niet via een big-bang herstyling van de hele app in één keer.

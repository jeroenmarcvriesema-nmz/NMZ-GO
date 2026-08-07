# CLAUDE.md — AI-grondwet van NMZ GO

Dit document is de permanente, leidende context voor elke sessie — mens of AI — die aan NMZ GO werkt. Het is de bron van waarheid voor *hoe* dit project gebouwd wordt. Bij twijfel over aanpak, stijl of beslissing wint dit document van aannames, van gewoontes uit andere projecten, en van generieke "best practices".

Dit bestand is het **startpunt**. De rest van de documentatie staat in dezelfde map (`.ai/`):

| Bestand | Inhoud |
|---|---|
| [PROJECT.md](./PROJECT.md) | Doel, doelgroep, kernproces, scope |
| [PRODUCT_VISION.md](./PRODUCT_VISION.md) | Merk- en designvisie: premium enterprise-gevoel, dark-mode-strategie, kleurgebruik |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Lagen, auth-flow, technologie-stack, mappenstructuur, database, Supabase, security |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Huidige (geïmplementeerde) UI/UX-principes, kleuren/typografie, componentregels, responsive, Tailwind |
| [UI_GUIDELINES.md](./UI_GUIDELINES.md) | Concrete patronen: spacing, typography, cards, forms, tables, modals, animaties, loading/empty/error states |
| [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) | Alle bestaande componenten (doel/gebruik/varianten/regels) + wat nog ontbreekt |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Coding standards, TypeScript, React, performance, naamgeving, refactoring |
| [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) | Branch-/commitconventies, build- en testprocedure |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Git-workflowoverzicht, build, productie (Netlify/Supabase), rollback |
| [TESTING.md](./TESTING.md) | Handmatige testprocedure, build procedure, Definition of Done, release checklist |
| [ROADMAP.md](./ROADMAP.md) | Wat bewust nog niet gebouwd is, bekende aandachtspunten |
| [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) | Sprint 3–6 en verdere toekomstige features, met prioriteit |
| [SPRINTS.md](./SPRINTS.md) | Sprintwerkwijze en sprintlog |
| [HANDOVER.md](./HANDOVER.md) | Overdrachtsdocument tussen sessies/tools — lees dit als je een eerdere sessie voortzet |

Elke sessie leest minimaal dit bestand. Ga naar het specifieke document zodra een taak dat domein raakt (bv. een RLS-wijziging → eerst `ARCHITECTURE.md` en `GIT_WORKFLOW.md` lezen).

---

## 1. Projectvisie

NMZ GO bestaat om het papieren/ad-hoc werkbonnenproces bij NMZ te vervangen door één digitale, betrouwbare bron van waarheid. Het uitgangspunt is niet "zoveel mogelijk functionaliteit", maar **een klein aantal flows die altijd werken**, voor een gebruikersgroep die geen tijd of geduld heeft voor een haperende app terwijl ze op een dak of in een schakelkast staan.

Drie leidende principes:

1. **Betrouwbaarheid boven features.** Dit is intern gereedschap dat dagelijks draait door ~30 medewerkers. Een crash, een oneindige laadstatus of een verkeerd getoonde werkbon kost direct tijd. Nieuwe functionaliteit is nooit belangrijker dan het niet-breken van wat al werkt.
2. **Klein en overzichtelijk blijven.** De stack, de mappenstructuur en het datamodel zijn bewust minimaal (zie `ARCHITECTURE.md`). Groei gebeurt door bestaande patronen te herhalen, niet door nieuwe abstracties, state-managers of dependencies.
3. **Voorspelbaarheid voor de volgende sessie.** Iedere developer of AI-sessie die hierna instapt, moet binnen enkele minuten begrijpen hoe iets werkt door het patroon te herkennen dat al eerder is gebruikt. Consistentie weegt zwaarder dan een "betere" oplossing die net iets anders is dan de rest.

Volledige projectdoelstelling en doelgroep: zie [PROJECT.md](./PROJECT.md).

---

## 2. AI werkwijze

Verplichte werkwijze voor elke AI-sessie (zoals Claude Code) op dit project:

1. **Begrijp eerst de bestaande codebase, dan pas wijzigen.** Lees de relevante bestanden, hooks, types en routes voordat je code schrijft. Raad niet naar structuur — verifieer die.
2. **Werk altijd binnen de bestaande architectuur** (`ARCHITECTURE.md`): pagina's → hooks → `lib/supabase`. Geen nieuwe laag, geen nieuwe globale store, geen nieuw datatoegangspatroon zonder overleg.
3. **Introduceer geen duplicate componenten.** Zoek eerst of een vergelijkbare component al bestaat in `components/ui/` of de relevante domeinmap.
4. **Gebruik bestaande componenten en hooks waar mogelijk**, ook als een net-iets-andere variant sneller vanaf nul te bouwen zou zijn.
5. **Maak eerst een kort implementatieplan** voordat je een wijziging doorvoert die veel bestanden raakt, of die gedeelde architectuur raakt (auth, routing, RLS). Pas nooit in één keer tientallen of honderden bestanden aan zonder dat plan eerst te delen.
6. **Controleer `npm run build` voordat je een taak als afgerond beschouwt.** Niet optioneel — zie `GIT_WORKFLOW.md` voor de volledige build-/testprocedure.
7. **Los build-fouten zelf op** binnen de scope van de taak, tenzij de fout op een dieperliggend probleem buiten scope wijst — dan expliciet melden.
8. **Controleer routing** na elke wijziging aan pagina's, routes of guards: klopt `App.tsx`, juiste guard-type, geen dode/dubbele route.
9. **Controleer imports**: geen ongebruikte imports, geen gebroken `@/`-paden.
10. **Controleer responsiveness** van elk gewijzigd scherm, op mobiele én desktop-breedte (`DESIGN_SYSTEM.md`).
11. **Controleer dark en light mode**: beide thema's zijn uitgerold en gelijkwaardig (`themeStore` + `class`-strategie, voorkeur opgeslagen, no-flash-script in `index.html`). Light is het standaardthema. Concreet betekent dit: elke nieuwe kleur krijgt óók een `dark:`-variant, en je controleert een gewijzigd scherm in beide thema's — niet alleen in het thema dat je toevallig aan had staan.
12. **Controleer TypeScript**: geen nieuwe `any`-lekken, `strict`-modus blijft groen, gedeelde types blijven in `types/index.ts`.
13. **Controleer de volledige gebruikersflow**, niet alleen het gewijzigde component — loop het scenario end-to-end door zoals een echte gebruiker (zie testprocedure in `GIT_WORKFLOW.md`).
14. **Wees expliciet over wat een wijziging niet doet**, als dat relevant is (bv. "PDF-export blijft buiten scope").
15. **Vraag bij twijfel, beslis niet stilzwijgend** — vooral bij architecturale keuzes, nieuwe dependencies, of iets dat een regel in dit document lijkt tegen te spreken.

---

## 3. Verboden acties

Nooit toegestaan zonder expliciete, voorafgaande bevestiging van de gebruiker:

- Een tweede `onAuthStateChange`-listener toevoegen buiten `AuthInitializer` — een al opgeloste race condition die niet mag terugkeren.
- Een RLS-policy die zichzelf-referentieert via een `EXISTS`-subquery op dezelfde tabel — veroorzaakte eerder `42P17 infinite recursion`.
- Een policy met `or true` of andere overbroad-condities, ook niet "tijdelijk om te debuggen".
- Een bestaande, al uitgevoerde migratie wijzigen — altijd een nieuwe migratie toevoegen.
- De `service_role`-key gebruiken of blootstellen in client-code.
- Nieuwe dependencies toevoegen aan `package.json` zonder expliciete goedkeuring.
- `git push --force` naar `main`, `git reset --hard`, `git clean -f`, branches verwijderen zonder expliciete bevestiging.
- Destructieve SQL uitvoeren tegen een gedeelde/productie Supabase-omgeving zonder expliciete bevestiging.
- `console.log`-statements achterlaten in gecommitte code.
- Een taak als "klaar" markeren zonder dat `npm run build` is gecontroleerd.
- Tientallen/honderden bestanden tegelijk aanpassen zonder eerst een implementatieplan te delen.
- `--no-verify` of andere git-hooks overslaan.
- Een nieuw globaal state-managementsysteem naast Zustand introduceren.
- De tsconfig verzwakken (bv. `strict` uitzetten) om een typefout te omzeilen.
- Geheimen (env-waarden, keys) hardcoden in code of committen in een bestand.

---

## 4. Definition of Done

Een wijziging is pas "klaar" als:

1. `npm run build` slaagt zonder TypeScript- of build-fouten.
2. De betrokken flow is handmatig getest (happy path + minstens één randgeval) — zie testprocedure in `GIT_WORKFLOW.md`.
3. Beide rollen zijn gecheckt waar relevant (beheerder + medewerker).
4. Mobiel én desktop zijn gecontroleerd op responsiveness.
5. Geen console errors/warnings die aan de wijziging zelf te wijten zijn.
6. RLS-policies kloppen als de database is aangeraakt: geen recursieve policies, geen overbroad-condities, idempotente migratie.
7. Elke nieuwe Supabase-call heeft foutafhandeling — geen onbehandelde promise, geen oneindige loading state.
8. Routing en imports zijn gecontroleerd: geen dode routes, geen ongebruikte/gebroken imports.
9. `CHANGELOG.md` is bijgewerkt bij een zichtbare of functionele wijziging.
10. Geen losse debug-code: geen `console.log`, geen tijdelijke debug-UI, geen achtergebleven "TODO test dit".
11. Geen duplicate componenten geïntroduceerd waar een bestaande component uitgebreid had kunnen worden.
12. Bij een wijziging over meerdere bestanden: er was eerst een kort implementatieplan.

---

*Dit document wordt bijgewerkt zodra architectuur, stack of afspraken structureel wijzigen. Behandel het nooit als vrijblijvende documentatie.*

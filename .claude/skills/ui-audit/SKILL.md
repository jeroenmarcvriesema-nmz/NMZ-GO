---
name: ui-audit
description: Voer een volledige UI-, kleur-, mobiel- en toegankelijkheidsaudit uit op NMZ GO door de app écht te draaien tegen een neppe Supabase-laag, elk scherm op te nemen in beide thema's en beide rollen, en te meten in plaats van te schatten. Gebruik dit wanneer er gevraagd wordt om de app te beoordelen, na te kijken op ontwerp/kleur/leesbaarheid/responsiveness, of om voor-en-na bewijs te leveren van doorgevoerde UI-wijzigingen.
---

# Een UI-audit die klopt

De reden dat dit werkt is niet de checklist maar het draaien. Een audit
op basis van alleen code lezen levert plausibele opmerkingen op; een
audit waarin je de app opent, opmeet en fotografeert levert bevindingen
op waar niemand omheen kan.

## 1. Zet de app aan zonder inloggegevens

Dit is de sleutel en de enige stap die echt werk is. `lib/supabase.ts`
gooit bij het opstarten als de env-variabelen ontbreken, en zonder
sessie kom je niet voorbij de inlogpagina. Los dat op met een neppe
client achter een Vite-alias — **niets in de repo**, alles in je eigen
werkmap.

Kopieer `scripts/nep-backend.ts` naar je scratchpad en vul de fixtures.
Het patroon dat alles mogelijk maakt is de chainable `Proxy`: elke
methode (`.select()`, `.eq()`, `.order()`, …) geeft zichzelf terug, en
`then` lost op naar `{ data, error }`. Daarmee werkt élke query in de
codebase zonder dat je er één hoeft na te lopen.

Zet daarnaast een tijdelijke Vite-config in de projectroot (Vite kan
zijn eigen config niet buiten het project resolven):

```ts
resolve: { alias: [
  { find: /^@\/lib\/supabase$/, replacement: '<pad>/nep-backend.ts' },
  { find: '@', replacement: path.resolve(__dirname, './src') },
]}
```

**Ruim die config op voordat je commit.** Controleer met `git status`.

## 2. Neem alles op, in elke combinatie

Draai `scripts/opnames.mjs`. De matrix die ertoe doet:

| As | Waarden | Waarom |
|---|---|---|
| Breedte | 390 · 820 · 1440 | telefoon, tablet staand (`PROJECT.md` eist dit), laptop |
| Thema | licht · donker | allebei gelijkwaardig volgens `PRODUCT_VISION.md` |
| Rol | beheerder · medewerker | totaal andere schermen én andere navigatie |

Let op: een rolvergrendelde route stuurt door. Sta de mock op
`medewerker`, dan levert `/planning` het scherm Vandaag op en denk je
dat je de planning bekijkt. Zet de rol expliciet per opnameronde.

## 3. Meet, schat niet

Dit is waar de audit zijn gezag vandaan haalt. Alles hieronder staat in
`scripts/meten.mjs`.

- **Contrast** — reken de verhouding uit de échte hexwaarden in
  `tailwind.config.ts` en `index.css`. Norm: 4,5:1 voor tekst, 3:1 voor
  betekenisdragende niet-tekst. Reken halftransparante donkere kleuren
  (`white/40`) eerst over de ondergrond heen.
- **Aanraakvlakken** — `getBoundingClientRect()` over elke
  `button, a, label, input, select`. `DESIGN_SYSTEM.md` vraagt ~44 px.
- **Horizontale overloop** — `scrollWidth > clientWidth` op elke route
  bij 390 px.
- **Paginahoogte** — `document.body.scrollHeight`, met een realistische
  fixture. Een bon van zes punten zegt niets; werkopdrachten hebben er
  twintig tot dertig.
- **Voorkomens tellen** — `grep -rc` geeft een bevinding gewicht. "op
  191 plekken" is een ander gesprek dan "op sommige plekken".

## 3b. Voer de handeling uit, fotografeer hem niet

Dit is de duurste les uit de eerste ronde en de reden dat deze paragraaf
bestaat. Twee wijzigingen zijn na oplevering teruggedraaid, allebei om
dezelfde oorzaak: ik had het scherm gelezen en opgenomen, maar de
handeling nooit gedaan.

- **Afgevinkte punten samenvouwen** was gemeten 52% winst in lengte. In
  gebruik klapte een punt onder je handen dicht *en* schoof het naar
  onderen op het moment dat je het afvinkte — je raakt midden in het
  werk je plek kwijt.
- **Een grijze uitgeschakelde afvinkknop** las prima op een screenshot.
  In gebruik sprong hij bij het uploaden van een foto van grijs naar vol
  geel, en dat leest als "hij heeft het afgevinkt" terwijl er niets werd
  afgevinkt.

Geen van beide is zichtbaar op een schermafdruk. Ze ontstaan pas in de
overgang, en die zie je alleen door hem te maken.

**Doe dit dus voor elke flow die iets wegschrijft:** een punt afvinken,
een foto uploaden, een werkdag starten en stoppen, een bon opleveren.
Laat de nep-backend die handeling écht landen — een `insert` die de
fixture bijwerkt, en `resultaatVoor` die verse objecten teruggeeft
(`JSON.parse(JSON.stringify(...))`), anders ziet React geen verandering
en lijkt een geslaagde actie mislukt. Meet daarna de toestand vóór en ná
in dezelfde test:

```js
const inputs = await p.$$('input[type=file]')
await inputs[i].setInputFiles('/tmp/proef.jpg')
await p.waitForTimeout(2500)
// en dan: is er iets veranderd dat níét had mogen veranderen?
```

Let bij zo'n vergelijking niet alleen op de gegevens maar ook op de
**vorm**: verandert een knop van kleur, verspringt een element, verdwijnt
er iets uit beeld? Een wijziging die de gebruiker niet heeft gevraagd is
een bug, ook als de database klopt.

**Weigert Playwright te klikken?** Dan is dat een bevinding en geen
hindernis. `element is not enabled` bij een `aria-disabled`-knop betekent
dat de knop volgens de toegankelijkheidsafspraak niets doet. Klopt dat
niet met wat hij daadwerkelijk doet, dan liegt het attribuut en moet het
weg — niet de test.

## 3c. Kijk in de tabellen `fouten` en de gebruikersgegevens

Een audit die alleen naar het scherm kijkt vindt wat lelijk is. Wat er
*misgaat* staat in de database, en met de Supabase-tools is dat één
query.

- `select boodschap, pad, count(*) from fouten where created_at > now() -
  interval '14 days' group by 1,2 order by 3 desc` — dit leverde dertig
  vastgelopen schermen op die nergens anders zichtbaar waren, waarvan
  veertien op het Vandaag-scherm van de ploeg.
- Bij een melding over één persoon: zoek zijn profiel, zijn koppeling in
  `personen`, zijn toewijzingen, en vooral **wat hij nog nooit heeft
  gedaan**. Raphael had nul rijen in `werkdag_logs` en nul foto's terwijl
  hij op zeven bonnen stond; dáár zat het antwoord, niet in de code.
- Kijk ook naar het tegenovergestelde: *werkt het bij anderen wél?* 144
  van de 1047 punten stonden afgevinkt, dus het afvinken zelf was niet
  stuk. Dat sluit een hele klasse oorzaken in één query uit.

**Een melding uit het veld is een symptoom, geen diagnose.** "Ik kan niet
afvinken" bleek: de knop was er niet, omdat de werkdag niet liep, en dat
stond nergens. Vraag bij elke melding wat de gebruiker zág, niet wat hij
dénkt dat er kapot is.

## 4. Toets aan de eigen normen van het project

De sterkste bevindingen zijn niet "dit kan mooier" maar "dit overtreedt
een regel die jullie zelf hebben opgeschreven". Lees vooraf `.ai/`:
`PRODUCT_VISION.md` (kleur, thema), `DESIGN_SYSTEM.md` (tokens, radius,
44 px, geen jargon in de UI), `UI_GUIDELINES.md` (typografie, states),
`PROJECT.md` (de toetssteen: één duim, in de zon, paar procent batterij).

Komt de norm zélf niet uit? Werk de norm bij in dezelfde ronde. Anders
komt de fout terug — dat is precies wat er met de bijschriftkleur
gebeurde: die stond in `UI_GUIDELINES.md` voorgeschreven.

## 5. Bewijs de winst met twee versies naast elkaar

Voor een voor-en-na verslag: draai de oude versie erbij in een worktree
op een andere poort en meet allebei met hetzelfde script.

```bash
git worktree add /tmp/voor <commit-voor-de-wijziging>
ln -s $PWD/node_modules /tmp/voor/node_modules
# tijdelijke vite-config in /tmp/voor, dan:
npx vite --config vite.review.config.ts --port 5198 --strictPort
```

`--strictPort` is niet optioneel: zonder die vlag pakt Vite stilletjes
de volgende vrije poort, en dan fotografeer je een oude server die nog
draait. Dat is één keer gebeurd en leverde lege pagina's op.

## 6. Valkuilen die me daadwerkelijk zijn overkomen

- **Beeldpixels ≠ CSS-pixels.** Een opname met `deviceScaleFactor: 2` is
  twee keer zo groot als de pagina. Ik heb "6.896 → 2.987" gemeld terwijl
  het 3.448 → 2.987 was. Meet hoogtes altijd in de pagina zelf met
  `scrollHeight`, nooit uit een bestandsafmeting.
- **Percentages hangen aan de fixture.** Dezelfde wijziging leverde 15%
  op bij zes punten en 55% bij vierentwintig. Noem altijd de conditie
  erbij.
- **JSX-commentaar** kan niet als los kind in `{voorwaarde && (...)}` of
  tussen attributen. Zet het boven de uitdrukking.
- **`hyphens: auto` doet niets** zonder afbreekwoordenboek in de browser.
  Los smalle kolommen op met breedte, niet met afbreken.
- **Externe afbeeldingen in de mock** worden geblokkeerd door de proxy.
  Consolefouten over `ERR_CONNECTION_RESET` zijn dan ruis — filter ze
  eruit voordat je "fouten gevonden" meldt.
- **Een verbetering die de gebruiker niet vroeg is verdacht.** Twee van
  de bevindingen uit de eerste ronde zijn teruggedraaid, en allebei
  waren het mijn eigen toevoegingen bovenop wat er gevraagd was. Bestaand
  gedrag dat vreemd oogt heeft vaak een reden die in het commentaar
  staat; lees dat eerst. In dit project stond de reden er letterlijk bij.

## 7. Lever het op

- Bevindingen krijgen een **code per domein** (`LEES-01`, `KLR-02`,
  `VELD-03`), een **ernst**, het **gemeten bewijs**, en een **concrete
  patch**. Geen bevinding zonder fix.
- Sorteer de aanbevelingen op opbrengst gedeeld door kosten, niet op
  ernst.
- Zeg erbij wat je **niet** hebt kunnen beoordelen: echte data, snelheid
  op een echt toestel, flows die iets wegschrijven.
- Publiceer als artifact met de beeldparen erin; een verslag zonder
  beeld overtuigt niemand die het scherm zelf niet openzet.

## 8. Voordat je klaar bent

`npm run build` én `npm run controle` groen, `git status` schoon (geen
`vite.review.config.ts`), `CHANGELOG.md` bijgewerkt, en de `.ai/`-docs
bijgewerkt waar een norm is veranderd. Zie de Definition of Done in
`.ai/CLAUDE.md`.

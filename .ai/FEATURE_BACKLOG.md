# FEATURE_BACKLOG.md — Toekomstige ontwikkeling

Deze backlog is richtinggevend, geen vaste planning. Volgorde en inhoud van een sprint worden pas definitief bevestigd bij de start van die sprint (zie [`SPRINTS.md`](./SPRINTS.md)). Prioriteit: **Hoog** (eerstvolgende, concrete waarde) · **Middel** (waardevol, geen blokkerende afhankelijkheid) · **Laag** (nice-to-have, verkennen voordat gebouwd wordt).

Elk item wordt vóór opname in een sprint getoetst aan `PROJECT.md` (helpt dit kantoor of een monteur vandaag) en aan de scope-regels in `CLAUDE.md`.

*Bijgewerkt 14 augustus 2026.*

---

## De opleverketen — de enige echte prioriteit

Alles vóór de opleverknop is in het veld bewezen: 67 foto's, vier monteurs, echte klussen. Alles eráchter is nog nooit één keer gelopen — 0 van de 46 werkbonnen is opgeleverd. Dat is de bottleneck, en deze vier stappen horen in deze volgorde:

| # | Item | Prioriteit | Toelichting |
|---|---|---|---|
| 1 | `clickup.fotos_uploaden` | Hoog | Foto's uit de bucket als attachment op de ClickUp-taak (`POST /task/{id}/attachment`, multipart). Per foto een stempel wegschrijven zodat een tweede ronde niets dubbel doet — dezelfde aanpak als `rapportages.clickup_geupload_op`. De kolommen staan er al. |
| 2 | Koppelen aan opleveren | Hoog | `werkbon_opleveren()` zet nu al een `clickup.status_bijwerken`-taak klaar. De foto-upload moet dáárvóór, zodat de bijlagen er staan op het moment dat de status springt. |
| 3 | Pas daarna opruimen | Hoog | Alleen wissen als het uploadstempel gevuld is, met een wachttijd van een week of twee. Zonder dat stempel gooi je bewijs weg dat nergens anders staat. |
| 4 | PDF-generatie opleverrapport | Hoog | Leest dezelfde foto's, dus komt ná stap 1. De aanvraagknop staat live en maakt al een rij plus een wachtrijtaak `rapportage.genereren`; die taaksoort heeft alleen nog geen handler. Zodra die er is: blijven liggen aanvragen opnieuw aanbieden met `taak_opnieuw()`. |

**Waarschuwing uit ervaring:** de edge function `verwerker` moet in zijn geheel opnieuw worden uitgerold — álle bestanden in één `deploy_edge_function`-aanroep. Eén keer half uitrollen heeft de verwerker plat gelegd.

### Structuur van het opleverrapport

Uitgelezen uit het echte document (`Opleverrapport Scheibeekstraat 9 te Assendelft`, 5 pagina's):

1. **Titelblad** — "OPLEVERRAPPORT ALGEMEEN", adres, datum, opgemaakt door
2. **Projectgegevens** — opdrachtgever, vaste juridische alinea, projectnummer, werkadres met postcode, opleverdatum, opmerkingen bewoners, vaste alinea over uitgevoerde werkzaamheden, extra werkzaamheden, opmerkingen/bijzonderheden
3. **"Fotorapportage"** als sectiekop, daarna de foto's

Beslissingen van de eigenaar: de kwaliteitschecklist (zes vaste punten) hoeft níét; drie tekstvelden volstaan (opmerkingen, bijzonderheden, extra uitgevoerde werkzaamheden); het projectnummer is een handmatig veld voor grote projecten en blijft bij losse klussen leeg; rapport maken is voor uitvoerder of hoger — een zwamsaneerder niet, want een rapport wordt pas opgemaakt als kantoor heeft vastgesteld dat het goed is.

---

## Brongegevens op orde

| Item | Prioriteit | Toelichting |
|---|---|---|
| `opdrachtnummer`, `postcode` en `plaats` vullen uit ClickUp | Hoog | Alle drie zijn leeg in 46 van de 46 bonnen. Het opdrachtnummer is de enige sleutel die een klus in NMZ GO aan dezelfde klus in ClickUp én in Gripp kan knopen; zonder die sleutel is uitvoering nooit aan omzet te koppelen. Het is bovendien wat een grote klus tot een project maakt op de projectenpagina — zolang het leeg is, is elke klus daar een losse kaart. |
| Werktekening ook buiten het tekeningveld vinden | Hoog | Komt nu mee bij 2 van de 44 bonnen. Hij wordt alleen gezocht in velden waarvan de náám "tekening" bevat; hangt hij in het werkopdrachtveld of los aan de taak, dan blijft hij liggen. `TEKENING_BESTAND` staat klaar in `clickup.ts`; er ontbreekt een fallback zoals `opdrachtUitBijlagen` die voor de opdracht doet. Voor de man in de kruipruimte is dit een echt gemis — de opdracht verwijst ernaar ("groen = bovenaf, beige = onderaf"). |
| De zes klussen die niet binnenkomen | Middel | Vier opdrachten wijken af van het sjabloon (Geusevesperstraat 36, 1925 Bloem Fonteinstraat 8, Klaas Katerstraat, C2313 Claushof), één PDF is stuk (Dahliastraat 5) en Project Utrecht heeft geen bijlage. Ze staan met reden in `overgeslagen`. Gebruik `clickup.tekstproef` om te zien wat de parser er precies uit leest — daar is die taaksoort voor. |

---

## Rapportages & inzicht

| Item | Prioriteit | Toelichting |
|---|---|---|
| Dashboard analytics-uitbreiding | Middel | Trends over tijd (bv. voortgang per week), niet alleen actuele snapshot-KPI's |
| AI-rapportages | Laag | Automatisch gegenereerde samenvatting van een werkbon/project op basis van punten, opmerkingen en foto's — verkennend; vereist een expliciete beslissing over welke AI-dienst en welke kosten daarbij horen voordat dit gebouwd wordt |

---

## Veldgebruik verbeteren

*Gericht op de medewerker-rol, de grootste en meest mobiele gebruikersgroep (zie `PROJECT.md` → Doelgroep).*

| Item | Prioriteit | Toelichting |
|---|---|---|
| Opgeruimde foto's netjes tonen | Middel | Zodra de opruiming loopt blijft de rij in `fotos` staan maar is het bestand weg. Dit is al opgevangen — `TaakItem` en het archief tonen "bij ClickUp" — maar controleer het zodra er echt opgeruimd wordt, want tot nu toe is dat nul keer gebeurd. |
| Foto-annotaties | Middel | Eenvoudige markeringen/pijlen op een geüploade foto, om een probleem aan te wijzen |
| GPS / locatiecontrole | Laag | Locatie vastleggen bij het starten van een werkbon, ter verificatie — privacy-implicaties eerst bespreken (zie `ARCHITECTURE.md` → Security) |
| Offline modus (basis) | Laag | Punten afvinken en foto's queuen zonder verbinding, synchroniseren zodra er weer verbinding is — grote architecturale impact, apart te plannen los van een reguliere sprint |
| Push notificaties | Laag | Bv. melding bij nieuwe werkbon-toewijzing — vereist een notificatiedienst/service worker, apart te evalueren |

---

## Toekomst (nog niet gepland)

Ideeën die het waard zijn om te bewaren, maar nog niet aan een sprint zijn toegewezen — zie ook [`ROADMAP.md`](./ROADMAP.md) voor de architecturale/technische tegenhangers hiervan.

### Inspecties in NMZ GO

Besproken in de brainstormsessie van 14 augustus 2026. Op dit moment leggen inspecteurs hun bevindingen vast in ClickUp. Een inspectie is echter **werk in het veld**: iemand gaat naar een adres, maakt foto's, legt bevindingen vast — precies hetzelfde patroon als de monteur, op dezelfde telefoon, in dezelfde kruipruimte. De inspecteur heeft daarmee exact het UX-probleem dat voor de monteur al is opgelost.

Bovendien horen de voor-foto's uit die inspectie in het opleverrapport dat NMZ GO straks maakt — de architectuur gaat daar al van uit ("voor" komt van de inspecteur, "na" van de monteur, `fotos.fase`). Die gegevens komen dus sowieso deze kant op.

Dit is daarmee de meest natuurlijke uitbreiding van de app. Nog geen prioriteit, wel expliciet bewaard.

### Wat níét naar NMZ GO hoort

Uit dezelfde sessie, als tegenhanger — de werkverdeling tussen de drie systemen:

| Systeem | Is de baas over |
|---|---|
| **Gripp** | Geld: offertes, facturen, uren naar de loonadministratie, klantrelatie. Nooit nabouwen. |
| **ClickUp** | Voorbereiding: inspectie-uitkomst, planning, statusbeheer, documenten. Werkvoorbereiders wonen daar. |
| **NMZ GO** | Uitvoering: wat er op het adres gebeurt, door wie, met welk bewijs. |

Omzet per klus hoort dus niet in NMZ GO thuis als eigen gegeven — hooguit als leesveld getoond, niet bezeten.

### White label / SaaS

Ook 14 augustus 2026 besproken, zonder besluit. De afweging in het kort:

- Een generieke werkbonnen-app heeft geen markt meer — dat is een volle categorie.
- Waar wél iets zit: de domeinkennis die in NMZ GO gebakken zit (sjabloon van de werkopdracht, voor/na-foto's in één dossier, het opleverrapport zoals corporaties het verwachten). Doelgroep zou zijn: zwamsaneerders, bodemisolatie, vocht- en houtaantastingsbedrijven. Klein maar echt.
- De ClickUp-afhankelijkheid is **niet** het grootste bezwaar: die koppeling zit al achter de wachtrij met taaksoorten, dus een tweede bron is een set handlers en geen herbouw.
- Het echte bezwaar is dat wat de app goed maakt, is dat het exact het NMZ-proces is. Bij klant twee wordt elke "zo doen wij het" een instelling, en configureerbaarheid is de directe tegenpool van principe 2 in `CLAUDE.md`.

**Afgesproken houding:** nu niet beslissen. De trigger is het moment dat een ander bedrijf (geen eigen vestiging) uit zichzelf vraagt of het de app ook kan krijgen. Tot die tijd is de verzekering architectonisch en niet commercieel: tenant-isolatie staat er al, de ClickUp-koppeling zit al achter een grens, en de enige regel die erbij hoort is **geen NMZ-specifieke bedrijfsregels hardcoderen in schermen**.

### Overig

- **Planning-optimalisatie** — automatische suggesties voor het inplannen van medewerkers op basis van beschikbaarheid/locatie.
- **Signed URLs voor foto-opslag** — vervanging van de huidige public bucket (zie `ARCHITECTURE.md`/`ROADMAP.md`).
- **Medewerkersstatistieken** — individuele prestatie-/workload-overzichten voor kantoor, met aandacht voor hoe dit gepresenteerd wordt (dit blijft interne kwaliteitscontrole, geen surveillance-achtige weergave).
- **Multi-vestiging/multi-team-ondersteuning** — Diemen en Leek draaien al samen in één tenant. Verder opsplitsen alleen als NMZ zelf structureel groeit; niet vooruit bouwen zonder concrete aanleiding.
- **Kennisbank, calculatie, workflowmotor, AI-assistent** — de latere fasen uit het Epic 4-architectuurdocument. Geen datum.
- **Uitgesteld op verzoek van de eigenaar:** de materiaalberekening (later, en dan gericht op het aantal vloerplaten — vuistregel ±1,5 m² per Top Floor plaat) en het uitlezen van maatvoering uit tekeningen.

Nieuwe ideeën worden hier toegevoegd zodra ze genoemd worden, ook als ze nog niet geprioriteerd zijn — deze lijst is de plek om ze niet kwijt te raken.

---

## Afgerond — stond hier eerder als plan

Deze sprints staan in `SPRINTS.md` uitgeschreven en zijn hier weggehaald zodat ze niet nog eens als openstaand gelezen worden: Sprint 3 (Projecten & Planning), Sprint 3.1 (premium redesign + dark mode, inclusief `Select`, `Toaster`, `EmptyState`, `ErrorState`), Sprint 4 / Epic 4 fase 0 (projecten-tabel en tenant-isolatie), en Epic 4 fase 1 t/m 5 (serverlaag, ClickUp lezen én terugschrijven, documenten, parser).

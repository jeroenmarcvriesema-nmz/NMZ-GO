# NMZ GO — Changelog

## Zoeken, projecten, het opleverrapport en filters op de planning

### Zoeken vond de helft niet
- **[FIX]** Het zoekveld op Werkbonnen keek naar adres, projectnaam en medewerker. Twee daarvan zijn in de praktijk leeg — sinds de ClickUp-koppeling heeft geen enkele bon een projectnaam — dus er bleef er één over. Zoeken op "Assendelft" gaf nul resultaten terwijl daar klussen staan: de plaats zit in een eigen kolom.
- **[FEATURE]** `src/lib/zoeken.ts` kijkt in adres, plaats, postcode, projectnaam, opdrachtnummer, bonnummer, opdrachtgever, kluiscode, inspecteur en de namen van de ploeg. Meerdere woorden betekent dat ze allemaal moeten voorkomen, niet per se in hetzelfde veld: "assendelft mario" brengt een lijst terug tot één regel. Spaties tellen niet mee, zodat "1566ab" de postcode "1566 AB" vindt.
- Dezelfde functie draait nu op Werkbonnen, Projecten, Planning en Mijn bonnen. Welk scherm je toevallig openhad maakt niet meer uit.

### De projectenpagina was structureel leeg
- **[FIX]** De pagina las de tabel `projecten`. Die heeft nul rijen en krijgt er nooit een bij: uit ClickUp komt één taak als één werkbon, nooit als project. Het scherm toonde dus altijd de lege staat — en dát was de reden dat zoeken "niet werkte", niet het zoekveld.
- **[FEATURE]** De lijst komt nu uit de werkbonnen zelf. Bonnen met hetzelfde opdrachtnummer — het nummer dat kantoor met de hand invult bij een groot project, bijvoorbeeld C515 — staan onder één kaart die openklapt. Al het andere is een losse klus die bij aantikken naar de werkbon gaat. Eén bon met een nummer blijft een klus: openklappen voor één adres is een klik zonder opbrengst.
- De statusfilters "op schema" en "vertraging" zijn eruit. Niets zette ze ooit, en een filter dat altijd nul oplevert leer je overslaan.

### Opleverrapport — de knop en de tekst
- **[FEATURE]** `rapportage_aanvragen()` bestond sinds migratie 025 maar was alleen bereikbaar met SQL-toegang. Er staat nu een kaart op de werkbon.
- **[FEATURE]** De drie tekstvelden van het rapport — opmerkingen bewoners, extra uitgevoerde werkzaamheden, bijzonderheden — hebben voor het eerst een invoerveld. De kolommen bestaan sinds migratie 002; niemand kon ze vullen.
- De aanvraagknop weigert vooraf wat de database achteraf ook weigert: geen foto, geen rapport. Dat vervangt de regel niet — wie het scherm omzeilt loopt alsnog tegen `42501` of `23514` aan — het zegt het alleen eerder. Beide codes worden vertaald naar gewone taal.
- De kaart belooft niets wat er niet is: de rapportgenerator bestaat nog niet, dus een aanvraag blijft in de wachtrij staan en dat staat er ook zo.

### Planning
- **[FEATURE]** Filter op ploeg en een zoekveld. Bladeren was het enige wat kon; "waar staat Mario deze week" en "zit dat adres er al ergens in" waren niet te beantwoorden zonder zes kolommen af te lezen.
- **[FIX]** Met een filter aan staat er niet langer "Vrij" onder een dag waar wel degelijk werk staat, alleen niet van deze man.

### Tests
- 24 tests erbij (`zoeken`, `klusgroepen`), **117 in totaal**.

---

## Auditronde: alles opgelost, plus wat de audit zelf had gemist

### Beveiliging
- **[FIX]** Migratie 020: het RPC-oppervlak van dertien functies die `anon` kon aanroepen terug naar drie. Die drie blijven met reden: `get_mijn_rol()` en `get_mijn_tenant()` worden vanuit RLS-policies aangeroepen, `uitnodiging_controleren()` is het uitnodigingsscherm dat per definitie uitgelogd bezocht wordt.
- **[FIX]** `taak_opnieuw()` toetste nog op de rolnáám `beheerder` — dezelfde fout die eerder in `mag_bij_werkbon()` zat. De eigenaar stond buiten de deur. Toetst nu op bevoegdheid.
- **[FIX]** `clickup_hartslag()` stond open voor élke ingelogde gebruiker zonder enige toets. Nu dezelfde poortwachter als `taak_aanmaken`: geen `auth.uid()` is achtergrondwerk en mag door, een ingelogde gebruiker moet bevoegd zijn.
- **[FIX]** `public.tenants` had RLS aan zonder policy. Werkte, maar op een impliciete aanname. Nu een expliciete leesregel.

### De sync haalde twee klussen structureel niet binnen
- **[FIX]** Migratie 022: `werkbonnen_bonnummer_key` liet Bentinckstraat 63 en Rembrandstraat 79 t/m 129 élke ronde afvallen. Het bonnummer komt uit het opdrachtnummer en dat hoort bij de ópdracht, niet bij de klus — één opdracht kan twee klussen opleveren. Uniciteit zit al waar hij hoort: `(tenant_id, clickup_taak_id)`.
- **Resultaat:** 28 → **30 werkbonnen**, 378 → **405 afvinkpunten**, overgeslagen taken van 7 naar 5. Die vijf zijn echte gaten in de brongegevens.

### Tests, voor het eerst
- **[FEATURE]** Vitest met **73 tests**, `npm test`. Parser, planningsrekenwerk, statusregels, ClickUp-link uitlezen, CSV-export, en de rollen. Elke test hoort bij een fout die daadwerkelijk is voorgekomen.
- **[FEATURE]** `.github/workflows/controle.yml` draait typecheck, tests en build bij elke push. Geen sleutels in de workflow.
- **[FIX]** `isoDatum()` vervangt `toISOString()` in de schermen: die gaf tussen middernacht en 02:00 Nederlandse tijd de dag ervóór terug.
- Om dit mogelijk te maken zijn de pure delen losgetrokken: `ontleden.ts` en `statusregels.ts` zonder Deno-afhankelijkheden, en `src/lib/planning.ts` uit de schermen.

### Foutmonitoring
- **[FEATURE]** Migratie 021 plus een `Foutvanger` rond de app en een luisteraar op losse scriptfouten. Een crash op een werktelefoon bereikte tot nu toe niemand: wit scherm, telefoontje, niets om op terug te kijken. Kantoor ziet ze op het dashboard, maar alleen als er iets is — een kaart die altijd nul meldt wordt niet gelezen.

### Wat ontbrak, gebouwd
- **[FEATURE]** `/archief`: terugzoeken op adres, met de foto's en afgevinkte punten erbij. Zoekt aan de databasekant, want over twee jaar zijn het duizenden bonnen.
- **[FEATURE]** `/uitloop`: wat staat over de planning heen, wat ligt stil, en waaróm er is stilgelegd.
- **[FEATURE]** Knop "Nu synchroniseren" en het ophalen van één ClickUp-taak ongeacht status. Dat laatste liep tot nu toe alleen via het verzetten van de status in ClickUp, wat het planbord voor iedereen verandert. Beide langs precies dezelfde weg als de automatische ronde: `verwerkTaak()` is losgetrokken uit `synchroniseer()`.
- **[FIX]** De exportknop bij Rapporten toonde "volgt in een volgende versie". Doet nu CSV naar Excel met periodefilter. Opgeleverde bonnen tellen nu ook mee — die vielen erbuiten omdat alleen op `status = 'voltooid'` werd gefilterd.

### Weekbeeld
- **[FEATURE]** Eén `Weekkiezer` op planning, werkbonnen en mijn week. Weeknummer vooraan — daar wordt in gepland en dat staat ook in ClickUp — met "Deze week" / "Volgende week" ernaast en een telling die over de getóónde week gaat. Op de planning stond die telling op het totaal over alle weken en veranderde dus niet als je bladerde.
- **[FEATURE]** Werkbonnen had helemaal geen weekbeeld. Twee standen nu: per week om te plannen, "alles" om te zoeken. Zodra je zoekt kijkt hij door alle weken heen, anders mis je een klus omdat hij toevallig vorige maand stond.
- Het weekfilter kijkt naar overlap en niet naar de startdatum: een klus van drie weken hoort in alle drie die weken te staan.

### Menu en routes liepen uit de pas
- **[FIX]** Werkbonnen stond niet in de mobiele balk. Kantoor kon op een telefoon dus niet bij de weekkiezer, de syncknop en het importeren van een losse taak. Op de laptop stond hij wél in de zijbalk, dus het viel niet op.
- **[FIX]** "Team" werd getoond aan uitvoerders en werkvoorbereiders, terwijl `/medewerkers` alleen voor eigenaar en beheerder openstaat. Erop tikken gooide je terug naar het dashboard.
- **[FIX]** Projecten nam een plek in de mobiele balk terwijl die pagina leeg is. Die plek is nu voor uitloop.
- Oorzaak weggenomen: de rollijsten stonden in `App.tsx` én in `useAuth.ts`. Nu één bron in `lib/rollen.ts`, met een test die `Sidebar.tsx`, `MobileNav.tsx` en `App.tsx` uitleest en elk menupad tegen de guard van die route houdt.

### Snelheid
- **[FEATURE]** Code-splitting: elk scherm apart, bibliotheken in eigen brokken. Van één bestand van 531 kB naar een startpakket van ±134 kB gzip plus het scherm dat je opent. Een zwamsaneerder haalt het dashboard, de planning en het medewerkersbeheer niet meer op.

### Onderhoud
- **[FIX]** De productiebuild typecheckte ook de tests en zou zijn omgevallen op de nieuwe rollentest. Configuraties uit elkaar getrokken: de uitrol checkt de app, `npm run controle` en de CI checken app plus tests.
- **[FIX]** Migraties 016 en 019 draaiden wel op de database maar hadden geen bestand in de repo. Alsnog vastgelegd.

### Nog open
- Lekwachtwoord-controle staat uit — dat is een schakelaar in het Supabase-dashboard waar geen API voor beschikbaar is.
- Eigen SMTP vraagt om inloggegevens van een mailprovider.
- De twee P0's uit de audit zijn geen codeproblemen maar handelingen: de terugkoppeling naar ClickUp is nooit live uitgevoerd, en er heeft nog geen zwamsaneerder ingelogd.


## Synchronisatie staat aan — eerste echte ronde

- **[FEATURE]** `clickup_instellingen.actief` op `true`. De droogloop is voorbij: NMZ GO haalt de planning nu echt op.
- **Eerste ronde:** 25 taken gezien, **22 werkbonnen aangemaakt** met 322 afvinkpunten, 41 toewijzingen en 23 documenten in besloten opslag.
- **Tweede ronde:** 0 nieuw, 22 bijgewerkt, alle aantallen ongewijzigd. Idempotentie bewezen op echte data — geen dubbele bonnen, geen dubbele punten, geen weggegooid afvinkwerk.
- De 41 toewijzingen hangen aan personen zonder account. Precies waar het personenregister voor was: de planning klopt al vóórdat er iemand is uitgenodigd.

### Wat er niet in kwam
- 3 van de 25 taken, alle drie gaten in ClickUp en geen parserfouten: één beschadigde PDF (Dahliastraat 5), één taak zonder werkopdracht (Dahliastraat 6), één opdracht met "Zie bijlage" in plaats van punten (Klaas Katerstraat).
- Slechts 1 van de 22 bonnen heeft een tekening. Dat is echte data, geen storing — vaak zit de tekening in dezelfde PDF of is er geen.


## Stilleggen, opleveren en terugkoppeling naar ClickUp

### Database
- **[FEATURE]** Migratie 015: `werkbon_stilleggen()`, `werkbon_hervatten()` en `werkbon_opleveren()`. Alleen een uitvoerder of hoger; een zwamsaneerder komt er niet bij.
- **[FEATURE]** De reden bij stilleggen is vrije tekst en verplicht — afgedwongen in de database, niet in het scherm, zodat het ook geldt voor een aanroep die het scherm overslaat. Géén keuzelijst: wie een klus stillegt heeft haast en moet kunnen opschrijven wat er is.
- **[FEATURE]** De ClickUp-status volgt uit de tekst. Staat er "asbest" in, dan gaat de taak naar de asbeststatus; "opnieuw inplannen" naar die status; verder is het gewoon "on hold". De statusnamen staan in de instellingen en niet in de code.
- **[FEATURE]** Stilleggen schuift de opleverdatum één dag op — de regel is dat ze de volgende dag terugkomen om op te leveren. **Alleen de bon die je stillegt.** De klus erna schuift niet automatisch mee; die overlap wordt gedetecteerd en gemeld, zodat een mens beslist.
- **[FEATURE]** Hervatten draait de datum bewust **niet** terug. Die dag is echt kwijt — dat was de reden om stil te leggen. Terugdraaien zou de planning laten liegen over wat er gebeurd is.
- **[FEATURE]** `meldingen`: overlapmeldingen voor de eigenaar en voor wie `planningsmeldingen` aanstaat. Je ziet alleen je eigen meldingen.
- **[FEATURE]** `werkbon_gebeurtenissen`: de volledige geschiedenis. Een bon die drie keer stillag vertelt iets anders dan een bon die één keer stillag, en dat verschil is precies wat je wilt zien bij uitloop.
- **[FEATURE]** Opleveren kan pas als de bon op `voltooid` staat. De zwamsaneerder rondt af (kan alleen met foto's, migratie 011), kantoor bevestigt, en pas dán gaat ClickUp op `opgeleverd`.

### Edge Function
- **[FEATURE]** Handler `clickup.status_bijwerken`: zet de status in ClickUp en plaatst een opmerking op de taak. Via de wachtrij en niet rechtstreeks vanuit de database — ligt ClickUp eruit, dan blijft de taak staan en volgt hij later. Een zwamsaneerder die een klus stillegt hoort daar nooit op te wachten.
- **[FEATURE]** Een werkbon zonder ClickUp-taak (handmatig aangemaakt) wordt overgeslagen met een melding, niet als fout behandeld.
- **[FIX]** Een mislukte opmerking maakt de statuswijziging niet ongedaan; de status is het belangrijke deel.

### Geverifieerd
- ✅ Medewerker kan niet stilleggen, niet opleveren, geen melding voor de eigenaar maken (`42501`)
- ✅ Stilleggen zonder reden wordt geweigerd (`23514`)
- ✅ Opleveren van een bon die nog niet voltooid is wordt geweigerd (`23514`)
- ✅ Stilleggen mét reden werkt; reden en nieuwe einddatum staan vast
- ✅ Hervatten werkt


## Personenregister — namen zonder account

### Database
- **[FEATURE]** Migratie 014: tabel `personen`. Een naam kan bestaan vóórdat er een account bij hoort. De 32 namen uit ClickUp staan nu klaar; koppelen aan een account kan later, per persoon.
- **[FEATURE]** Toewijzing loopt van `werkbon_medewerkers.medewerker_id` (een profiel, dus een account) naar `persoon_id`. Daarmee kan de synchronisatie een klus toewijzen aan iemand die nog nooit heeft ingelogd — precies wat een pilot met vier man nodig heeft.
- **[FEATURE]** Wie later een account krijgt, ziet meteen zijn hele geschiedenis. Er valt niets bij te werken, want de werkbonnen wezen al naar hem.
- **[FEATURE]** `ben_ik_toegewezen()` als enige plek die de vraag "sta ik op deze bon" beantwoordt. Vijf policies stelden die vraag ieder afzonderlijk; nu is een volgende wijziging één functie in plaats van vijf policies.
- **[FEATURE]** Uitnodigingen dragen een persoon én een rol. Zonder dat moet iemand ná het aanmaken van zijn account alsnog handmatig gekoppeld worden. De rol komt uit de uitnodiging, nooit uit de metadata van de aanmelding — die is door de aanmelder zelf te kiezen.
- **[SECURITY]** `eigenaar` is niet uit te delen via een uitnodiging.
- **[SECURITY]** Alleen een beheerder kan een persoon aan een account koppelen. Een uitvoerder mag de ploeg beheren, maar niet bepalen wie welk account is.
- **[FIX]** `mag_bij_werkbon()` toetste nog op de rolnaam `'beheerder'` — blijven staan bij migratie 008, toen alle policies naar bevoegdheden gingen. Gevolg: een eigenaar, uitvoerder of werkvoorbereider kwam niet bij de foto's en documenten van een bon waar hij zelf niet op stond.
- **[FIX]** `planning_overzicht()` toont ook collega's zonder account. Bij een pilot is dat de helft van de ploeg, en "wie werkt waar vandaag" zonder die namen is nutteloos.

### Synchronisatie
- **[FEATURE]** Koppelt op `personen.clickup_label` in plaats van op een profiel. Een persoon zonder account is normaal en geen bevinding meer; een naam die hélemaal niet in het register staat is dat wel. Die twee stonden eerst op één hoop.

### Geverifieerd
- ✅ Medewerker ziet zijn eigen bon en alleen die
- ✅ Medewerker ziet de ploeg (33 namen) — nodig voor "wie werkt waar vandaag"
- ✅ Medewerker kan zichzelf niet aan een andere persoon koppelen (0 rijen)
- ✅ Medewerker kan geen persoon toevoegen, zichzelf niet promoveren, niemand toewijzen (`42501`)
- ✅ Eigenaar staat niet op de bon en kan tóch bij de documenten — de reparatie werkt
- ✅ 32 namen uit ClickUp klaargezet, nul ten onrechte gekoppeld


## ClickUp-synchronisatie draait droog

### Edge Function
- **[FEATURE]** Handler `clickup.synchroniseren`: haalt de taken met status `volgende week` op, leest de werkopdracht-PDF, en maakt daar werkbonnen met afvinkpunten van. Idempotent via een unieke sleutel op (tenant, ClickUp-taak) — een tweede ronde werkt bij in plaats van te verdubbelen.
- **[FEATURE]** Punten worden alleen aangemaakt bij een nieuwe bon. Bij een bestaande zou opnieuw invoegen het afvinkwerk van een zwamsaneerder wissen.
- **[FEATURE]** Droogloop zolang `clickup_instellingen.actief` op `false` staat: hij rapporteert per opdracht wat er zóu ontstaan (aantal punten, medewerkers, data, kluiscode, tekening ja/nee) en schrijft niets weg. Dat is geen testgemak maar de afspraak dat er niets naar productie gaat voordat de terugkoppeling naar ClickUp werkt.
- **[FEATURE]** Handler `clickup.tekstproef`: diagnose van één opdracht — de tekstlaag zoals de parser hem ziet, plus wat eruit komt. Zonder deze ingang is een overgeslagen opdracht niet na te lopen, want de bijlage-URL's van ClickUp zijn kortlevend en alleen de Edge Function komt erbij.
- **[FEATURE]** Beide PDF's worden gekopieerd naar besloten opslag. De bijlage-URL's van ClickUp verlopen; een zwamsaneerder die om half acht op een dak zijn tekening opent moet hem hebben.

### Parser
- **[FIX]** `extractText()` levert het hele document als één regel op. Daarmee verdwijnt het verschil tussen "nieuw punt" en "vervolg van de vorige zin" — precies het verschil waar deze parser op draait. De tekstlaag wordt nu zelf uitgelezen en op y-positie gegroepeerd, zodat het document terugkomt zoals de inspecteur het opschreef. Dit was de reden dat de eerste droogloop 25 taken zag en 0 punten vond.
- **[FIX]** Het opsommingsteken is `o ` mét spatie, niet `o` direct tegen een hoofdletter aan.
- **[FIX]** De kop `Uit te voeren werkzaamheden … :` wordt op de laatste treffer genomen. Bovenaan de opdracht staat "…foto's maken van alle uit te voeren werkzaamheden", en die zin trok het anker eerst naar voren.
- **[FIX]** Een leeg kopveld schoof het kopje eronder mee naar binnen: twee bonnen kregen `Werkvoorbereiding:` als kluiscode.
- **[FEATURE]** De tekening wordt in élk bijlageveld gezocht waarvan de naam past, niet alleen het ingestelde. ClickUp heeft er twee (`Werktekening` en `Werktekening (PDF)`); welke de werkvoorbereider gebruikt wisselt, en dat hoort geen reden te zijn dat een zwamsaneerder zijn tekening mist.

### Database
- **[FEATURE]** Migratie 012: herkomst- en planningsvelden op de werkbon (`clickup_taak_id`, `geplande_start`, `geplande_eind`, `uitloopdatum`, `kluiscode`, `inspecteur`, `werkvoorbereiding`, `opdracht_pad`, `tekening_pad`) plus de besloten bucket `werkbon-documenten` met dezelfde regel als de foto's: wie bij de werkbon mag, mag bij de documenten.
- **[FEATURE]** Migratie 013: `geef_clickup_token()` haalt het ClickUp-token uit Vault. Alleen voor `service_role` — `vault.decrypted_secrets` geeft toegang tot élk geheim, inclusief de service-role-sleutel, dus die view gaat niet open.

### Geverifieerd
- ✅ Parser tegen twee echte opdrachten: 17 en 22 punten, afgebroken zinnen samengevoegd, kopvelden en kluiscode correct
- ✅ Droogloop tegen de echte lijst Diemen: 25 taken gezien, 21 opdrachten volledig gelezen
- ✅ De 4 overgeslagen opdrachten komen mét reden en adres terug, niet stil
- ✅ Labels uit ClickUp worden gelezen; 22 namen zonder account komen als bevinding terug
- ✅ Er is nog niets weggeschreven — `actief` staat op `false`
- ✅ `npm run build` groen


## Fotoplicht per punt + werkopdracht-parser beproefd

### Database
- **[FEATURE]** Migratie 011: `foto_vereist` per punt, standaard aan. De afrondcontrole telt alleen punten mét fotoplicht — een punt zonder fotoplicht moet nog steeds afgevinkt worden, maar blokkeert het afronden niet.
- **[FEATURE]** Alleen een uitvoerder of hoger kan de fotoplicht omzetten. Zonder die grens kon een zwamsaneerder de fotoplicht van zijn eigen punten uitzetten en daarmee het hele bewijs omzeilen.
- **[FEATURE]** De tekst van een punt ligt vast: die komt uit de offerte. Afvinken en een opmerking achterlaten mag, herschrijven niet.
- **[FEATURE]** `uitgesloten_punten` als instelling — parkeerkosten, brandstoftoeslag en klein materiaal komen nooit op een werkbon.

### Verkenning ClickUp
- De werkopdracht blijkt níet in de ClickUp-beschrijving te staan (dat is een samenvatting) maar in de bijgevoegde PDF. De parser is daarop gebouwd en beproefd tegen twee echte opdrachten: 17 en 22 punten, afgebroken zinnen correct samengevoegd over paginagrenzen heen, kop- en inspecteursgegevens eruit.
- De ankers `Uit te voeren werkzaamheden … :` en `Datum oplevering:` liggen vast in het sjabloon. De kopjes daarboven (Compartiment, Rechterkant, Linkerkant) verschillen per inspecteur en worden daarom als één blok naslagtekst bewaard in plaats van ontleed.
- Geen taalmodel in de parser: puur ankers en opsommingstekens, zodat er niets verzonnen kan worden.

### Geverifieerd
- ✅ Punt zonder fotoplicht blokkeert het afronden niet
- ✅ Punt mét fotoplicht zonder foto blokkeert het afronden wél
- ✅ Zwamsaneerder kan de fotoplicht niet uitzetten (`42501`)
- ✅ Zwamsaneerder kan de tekst van een punt niet herschrijven (`42501`)
- ✅ Parser getest tegen twee echte werkopdrachten
- ✅ `npm run build` groen


## Zwamsaneerdersscherm — zelfde taal als kantoor

### Verbeteringen
- **[UI]** Het scherm van de zwamsaneerder gebruikt nu dezelfde bouwstenen als het kantoordashboard: `KpiCard` voor de cijfers, `SectionHeading` voor secties, dezelfde kaartvorm, radius en schaduw. Herkenbaar als dezelfde app, met de inhoud die bij zijn rol hoort.
- **[UI]** De kop was permanent donker (`bg-gray-900`) en de achtergrond een vaste hexcode. Beide zijn nu theme-reactief en op tokens, met dezelfde gele bovenrand als de `Topbar` bij kantoor.
- **[UI]** Uitloggen zat in een zwevende knop linksonder; die staat nu in de kop, naast de themawissel — zoals in de zijbalk bij kantoor.
- **[FEATURE]** "Wie werkt waar vandaag": een zwamsaneerder ziet adres en naam van zijn collega's, via `planning_overzicht()`. Die functie geeft niet meer terug dan datum, adres en naam, dus de werkbon van een collega blijft dicht.
- **[FIX]** `MOCK_PRESTATIES` was blijven staan toen de rest van de mock data eruit ging. "Mijn cijfers" telt nu echt: afgeronde werkbonnen, gewerkte dagen en gemaakte foto's.


## Rollen en bevoegdheden — vijf niveaus

### Database
- **[FEATURE]** Migratie 008: vijf rollen (`eigenaar`, `beheerder`, `uitvoerder`, `werkvoorbereider`, `medewerker`) in plaats van twee. De uitvoerende rol heet in de database bewust `medewerker` — generiek, zodat er later een ander vak bij kan; op het scherm staat "Zwamsaneerder".
- **[FEATURE]** Policies toetsen niet langer op een rolnaam maar op een **bevoegdheid**: `mag_gebruikers_beheren()` en `mag_werk_beheren()`. Alle 26 policies over 10 tabellen plus de opslag zijn herschreven. Een zesde rol is daarmee één functie aanpassen in plaats van dertig policies — dat was de hele reden om dit vóór de schermen te doen.
- **[FEATURE]** `functie` op het profiel: een functietitel los van het rechtenniveau ("Operationeel Manager" is een functie, geen bevoegdheid).
- **[CRITICAL FIX]** Afronden van een werkbon wordt nu in de database afgedwongen: élk punt afgevinkt én elk punt met fotobewijs. Dat stond alleen in de schermcode, dus wie de app omzeilde kon een bon zo op voltooid zetten. De foutmelding benoemt wat er nog mist ("Er is nog 1 punt zonder foto").
- **[FEATURE]** Een afgeronde werkbon gaat op slot voor de uitvoerende: niets meer wijzigen of afvinken. Foto's toevoegen mag wél — bewijs achteraf aanvullen is legitiem — verwijderen nooit.
- **[FEATURE]** Het eigenaarsaccount is beschermd. Alleen een eigenaar kan de rol eigenaar toekennen of afnemen, en de laatste eigenaar kan niet worden gedegradeerd of verwijderd — door niemand. Dat is precies de fout die dit systeem eerder heeft platgelegd.
- **[FEATURE]** `planning_overzicht()`: een zwamsaneerder kan zien wáár een collega werkt (datum, adres, naam) zonder diens werkbon te kunnen openen.
- **[FIX]** Migratie 009: `email` op het profiel. De knop "wachtwoord resetten" gaf het profiel-id door aan een functie die een e-mailadres verwacht — die kon dus nooit gewerkt hebben. `auth.users` is voor de app terecht niet leesbaar, dus er was geen manier om aan het adres te komen. Het adres staat nu op het profiel en blijft gelijk met Supabase.

### Verbeteringen
- **[FEATURE]** `Select` toegevoegd — de eerste component uit de "nog te bouwen"-lijst die daadwerkelijk nodig bleek, voor het toekennen van rollen.
- **[UI]** `BeheerderGuard` is gesplitst in `KantoorGuard` (werk) en `GebruikersbeheerGuard` (medewerkers, uitnodigingen, wachtwoorden). Navigatie toont per bevoegdheid wat mag.
- **[UI]** "Monteur" heet overal "Zwamsaneerder", ook in de codecommentaren.

### Geverifieerd — rechtenmatrix per rol
- ✅ Zwamsaneerder ziet alleen eigen werkbon, niet die van een collega
- ✅ Ziet geen projecten, uitnodigingen of andere profielen
- ✅ Kan wél zien wáár een collega werkt via `planning_overzicht()`
- ✅ Kan niet afronden met open punten, en niet zonder fotobewijs
- ✅ Kan geen werkbon aanmaken en zichzelf niet promoveren
- ✅ Uitvoerder en werkvoorbereider zien en wijzigen alle werkbonnen, maar geen uitnodigingen en geen rollen
- ✅ Beheerder maakt uitnodigingen en wijzigt rollen, maar kan niemand eigenaar maken
- ✅ De laatste eigenaar is niet te degraderen en niet te verwijderen
- ✅ Nul policies toetsen nog op een rolnaam; 31 op bevoegdheid
- ✅ `npm run build` groen

## Authentication recovery — de eerste echte ingebruikname

Bij het voor het eerst live zetten bleek de authenticatieketen op vijf plekken te breken. Losse oorzaken, maar ze verscholen zich achter elkaar: elke fix legde de volgende bloot.

### Database / RLS fixes
- **[CRITICAL FIX]** Er kon geen beheerder meer ontstaan. Migratie 005 zette de rol bij registratie terecht vast op `medewerker` — die kwam uit client-metadata en was dus te sturen — maar liet geen weg naar een eerste beheerder over. Toen alle accounts verwijderd werden zat het systeem op slot: rolwijziging mag alleen een beheerder doen, en die was er niet meer. Migratie 007 maakt de eerste gebruiker in een tenant zónder beheerder wél beheerder; daarna geldt 005 onverkort.
- **[CRITICAL FIX]** De opslagbucket `werkbon-fotos` bestond niet, terwijl de app er wel naartoe uploadt. Elke foto-upload zou mislukt zijn — en dat zou pas in het veld zijn ontdekt. Aangemaakt in migratie 007, bewust **besloten en niet publiek**: dit zijn foto's van de woningen van bewoners, en een publieke link blijft voor altijd voor iedereen werken. Rechten volgen dezelfde regel als de tabel `fotos`; verwijderen is beheerderswerk.

### Verbeteringen
- **[FEATURE]** Wachtwoord-resetflow toegevoegd — die bestond niet. Geen aanvraagpagina, geen link op het inlogscherm, en vooral geen scherm om een nieuw wachtwoord te zetten. De herstellink logde de gebruiker stilzwijgend in zonder ooit om een wachtwoord te vragen. Twee pagina's plus routes; `resetPasswordForEmail` geeft overal een `redirectTo` mee.
- **[FIX]** `AuthInitializer` vangt het `PASSWORD_RECOVERY`-event af, zodat ook een link zonder bestemming (uit het Supabase-dashboard) op het herstelscherm landt in plaats van op het dashboard.
- **[CRITICAL FIX]** Inloggen faalde met *"String contains non ISO-8859-1 code point"*. De anon-key gaat als HTTP-header mee, en headers accepteren alleen ASCII; bij het instellen in Netlify was een onzichtbaar teken meegekomen. De client schoont beide waarden nu op en waarschuwt in de console als er iets verwijderd moest worden.
- **[FIX]** De inlogpagina gaf op élke fout dezelfde tekst. Een onbevestigd e-mailadres zag er precies zo uit als een verkeerd wachtwoord, wat het opsporen van al het bovenstaande onnodig lang maakte. Zowel Login als de resetpagina benoemen nu de werkelijke oorzaak.
- **[FIX]** Uitnodigingstokens kwamen uit `Math.random()` terwijl zo'n token toegang tot de tenant geeft — nu `crypto.randomUUID`. Een mislukte uitnodiging leverde bovendien toch een link op.

### Geverifieerd
- ✅ Profiel volgt automatisch bij een nieuwe gebruiker uit het dashboard
- ✅ Rol uit metadata (`rol: beheerder`) wordt genegeerd
- ✅ Eerste gebruiker in een lege tenant wordt beheerder
- ✅ Tenant komt uit de uitnodiging; token is eenmalig bruikbaar
- ✅ Opslagrechten laten alleen de eigen werkbon door
- ✅ Inloggen, wachtwoord vergeten en herstellen: end-to-end getest in productie
- ✅ `npm run build` groen

### Les
Vijf storingen achter één symptoom, en de tijd ging vooral op aan het feit dat de foutmeldingen niets prijsgaven. Een generieke melding als "E-mail of wachtwoord onjuist" voelt netjes, maar kost uren zodra de oorzaak ergens anders ligt. Toon wat er werkelijk misgaat.

## Mock data eruit — dashboard en werkdag op echte data

### Database
- **[FEATURE]** Migratie 006: tabel `werkdag_logs` (één rij per monteur per werkbon per dag), met RLS, een unieke sleutel tegen dubbele starts, een check dat stoppen niet vóór starten kan, en een trigger die een monteur tot de kolom `stop_tijd` beperkt — dezelfde tweetrapsopzet als 003 en 005.

### Verbeteringen
- **[FEATURE]** `useWerkdag` draaide op `sessionStorage`: de werkdag verdween bij het sluiten van het tabblad en de beheerder zag er niets van. Nu echte rijen, met herstel bij het openen van het scherm — begint een monteur op zijn telefoon, dan ziet hij dat terug na een herstart. Start gebruikt een upsert, zodat twee keer tikken nooit een tweede rij of een nieuwe starttijd oplevert.
- **[FEATURE]** `useDashboard` draaide volledig op verzonnen cijfers. Nu berekend uit de werkbonnen van vandaag, hun taken en foto's, en de werkdag_logs. De drempels die bepalen wanneer het dashboard alarm slaat (verwachte starttijd, uren zonder foto, uren voor zichtbare voortgang) staan als benoemde constanten bij elkaar bovenin de hook.
- **[UI]** De KPI's op het dashboard kwamen uit de `projecten`-tabel. Die vult zich pas met de ClickUp-synchronisatie, dus tot die tijd toonde het dashboard zes nullen boven een tabel die wél werk liet zien. Ze komen nu uit de werkbonnen van vandaag; labels aangepast ("Lopend vandaag", "Gestart", "Achter op schema", "Gem. voortgang").
- **[UI]** Dashboard heeft nu een lege staat en een foutstaat in plaats van een lege tabel.
- **[UI]** De start- en stopknop van de werkdag blokkeren tijdens het opslaan. Bij een wisselende verbinding in het veld tikte een monteur anders twee keer.

### Geverifieerd
- ✅ Monteur kan eigen werkdag starten en stoppen
- ✅ Monteur kan zijn starttijd niet vervalsen (`42501`)
- ✅ Monteur kan geen werkdag op naam van een collega aanmaken
- ✅ Monteur kan zijn eigen log niet verwijderen (0 rijen — beheerderswerk)
- ✅ Beheerder ziet werkbon, taken, foto's, team én starttijd van de monteur in één keer
- ✅ Alle foreign-keynamen komen overeen met wat de queries aannemen
- ✅ `npm run build` groen

## Designfase afgerond — systeemstaten en meldingen

### Nieuw
- **[FEATURE]** `EmptyState` — één gedeelde vorm voor "er is hier nog niets", met verplicht Tabler-icoon en hoogstens één actie. Vervangt acht handgemaakte lege staten die elk net anders waren.
- **[FEATURE]** `ErrorState` — tegenhanger voor een mislukte load. Hiervóór was een mislukte load niet te onderscheiden van een lege lijst: je zag in beide gevallen niets.
- **[FEATURE]** `Toaster` + `toastStore` — niet-blokkerende actiefeedback. Een fout blijft 7 seconden staan, de rest 4.

### Verbeteringen
- **[UI]** Alle zes `alert()`-popups vervangen door toasts. Een blokkerende browserpopup past niet bij een app die premium moet aanvoelen, en is op een telefoon in het veld ronduit hinderlijk.
- **[UI]** Alle emoji-als-icoon verwijderd (🎉 ✅ ⚠️ 📋 📄 👥 🔒) en vervangen door Tabler-iconen, conform de iconregel in `UI_GUIDELINES.md`. Dit was dezelfde overtreding die in Sprint 3 al één keer is gecorrigeerd.
- **[UI]** `Modal` is theme-reactief geworden. De kop was nog permanent donker (`bg-gray-900`) en week daarmee af van de rest van de schil sinds 3.1b. Ook een echt sluit-icoon in plaats van het teken ✕, plus `role="dialog"` en `aria-modal`.
- **[UI]** Foutstaten aangesloten op `Werkbonnen` en `Projecten`: mislukt laden toont nu een melding met "Opnieuw proberen" in plaats van een lege lijst.
- **[FIX]** `WerkbonNieuw` controleerde de inserts van taken en monteurs niet. Bij een fout kreeg de monteur een lege werkbon zonder dat iemand het merkte; nu volgt er een melding.
- **[FIX]** Foutmelding bij het afronden van een werkbon benoemt nu de oorzaak — "je staat niet meer op deze werkbon" bij een geblokkeerde update, en een verbindingsmelding bij een technische fout.

### Bewust niet gedaan
- `Select`, generieke `Table` en `Dialog` zijn **niet** gebouwd. Geen enkel scherm heeft ze nodig: er staat nergens een `<select>`, de drie tabellen verschillen te veel voor een zinnige gemene deler, en er is geen destructieve actie in de UI. `Dialog` is wél gebouwd en weer verwijderd toen bleek dat hij geen afnemer had.
- Het thema is **niet** omgezet naar dark-primair. `PRODUCT_VISION.md` schrijft dat voor, maar in Sprint 3.1b is bewust voor light-primair gekozen — dat is de latere beslissing en die blijft staan.

## Migratie 005 — uitnodigingen, registratie en werkbonstatus

### Database / RLS fixes
- **[CRITICAL FIX]** Rol-escalatie bij registratie gedicht. `handle_new_user()` las de rol uit `raw_user_meta_data`, en die metadata komt rechtstreeks uit `supabase.auth.signUp({ options: { data } })`. Eén registratie met `{ rol: 'beheerder' }` volstond om beheerder te worden. De `with check` uit migratie 003 hielp niet: de trigger draait als `security definer` en gaat langs RLS heen. De rol staat nu vast op `'medewerker'`.
- **[CRITICAL FIX]** `uitnodigingen` stond open voor iedereen: `uitnodigingen_select` had als voorwaarde letterlijk `true`, waardoor een niet-ingelogde bezoeker alle tokens van alle tenants kon opvragen. Aangetoond met een testrij. De tabel is nu beperkt tot de beheerder van de eigen tenant; `uitnodigingen_update` idem, met `with check`.
- **[FEATURE]** `uitnodiging_controleren(token)` toegevoegd (`security definer`, uitvoerbaar door `anon`): geeft alleen `true`/`false` terug, zodat de registratiepagina een link kan controleren zonder dat de tabel open hoeft.
- **[FIX]** Een uitgenodigde belandde altijd in de oudste tenant. `handle_new_user()` haalt de tenant nu uit de uitnodiging en verzilvert die in dezelfde transactie — daarmee is een token ook niet meer twee keer bruikbaar.
- **[FIX]** Een toegewezen medewerker kan zijn eigen werkbon afronden. Nieuwe policy `werkbonnen_update_toegewezen` plus trigger `werkbonnen_guard_kolommen`, die zo iemand beperkt tot de kolom `status` en tot de waarden `bezig`/`voltooid`.

### Verbeteringen
- **[FIX]** `WerkbonUitvoeren.tsx` meldde "voltooid" terwijl de update door RLS werd geblokkeerd — een update die nul rijen raakt is voor PostgREST een geldige lege respons. Er wordt nu op `error` én op het aantal geraakte rijen gecontroleerd, met een zichtbare foutmelding. De `alert()` is vervangen door de reguliere foutstijl.
- **[FIX]** Foutafhandeling toegevoegd op `WerkbonDetail.tsx` (statuswissel) en `TaakItem.tsx` (afvinken en foto-upload) — die negeerden hun `error` stilzwijgend.

### Geverifieerd
- ✅ Medewerker kan eigen werkbon op `bezig`/`voltooid` zetten, niet terug op `open`
- ✅ Medewerker kan geen andere kolom van zijn werkbon wijzigen (`42501`)
- ✅ Medewerker kan de werkbon van een collega niet afronden (0 rijen)
- ✅ Niet-ingelogde bezoeker ziet geen enkel uitnodigingstoken meer
- ✅ `uitnodiging_controleren()` werkt wel voor `anon` — registratieflow blijft heel
- ✅ Beheerder ongewijzigd: status, adres, uitnodiging aanmaken; tenant-grens blijft dicht
- ✅ `npm run build` groen

## Migratie 003 — rol-escalatie op profiles

### Database / RLS fixes
- **[CRITICAL FIX]** Privilege escalation gedicht op `public.profiles`. `profiles_update_own` had een `using`- maar geen `with check`-clausule; Postgres valt dan terug op de `using`-expressie (`auth.uid() = id`), en `id` verandert niet bij een update. Elke medewerker kon daardoor met één PostgREST-call zijn eigen `rol` op `beheerder` zetten én zijn `tenant_id` naar een andere klant wijzigen — waarmee zowel de rolscheiding als de tenant-isolatie uit migratie 002 wegviel. Gevonden met de rollentest die `GIT_WORKFLOW.md` voorschrijft na elke RLS-wijziging.
- **[FIX]** Trigger `profiles_guard_rol_tenant` toegevoegd: houdt wijzigingen aan `rol` (tenzij beheerder) en aan `tenant_id` (altijd) tegen. Een trigger ziet `OLD`/`NEW` en kan daarom zien of een kolom verandert; een RLS-policy kan dat niet. Een tenant-verhuizing loopt vanaf nu bewust alleen nog via `service_role`.
- **[FIX]** `with check` toegevoegd op `profiles_update_own` en `profiles_update_beheerder` als tweede beveiligingslaag. De `using`-expressies zijn ongewijzigd, dus de rolscheiding blijft exact zoals in 002.
- **[FIX]** `profiles_insert_own` beperkt tot `rol = 'medewerker'` — hetzelfde gat bestond bij het aanmaken van een profiel, en de trigger dekt alleen updates af.
- **[FIX]** Vaste `search_path` op `update_updated_at()` (melding `function_search_path_mutable` van de Supabase-linter).

### Geverifieerd
- ✅ Verificatiequery na migratie 002: rollen, `SECURITY DEFINER`-functies en policies kloppen, geen `42P17` recursie
- ✅ Medewerker kan zichzelf niet promoveren (`42501`)
- ✅ Medewerker kan niet naar een andere tenant springen (`42501`)
- ✅ Medewerker kan geen profiel als beheerder aanmaken (`42501`)
- ✅ Medewerker kan nog wel eigen naam wijzigen en eigen taken afvinken
- ✅ Beheerder kan nog wel medewerkers promoveren/degraderen en werkbonnen aanmaken
- ✅ Beheerder kan een profiel niet naar een andere tenant verhuizen
- ✅ `npm run build` groen

## Sprint 3.1b — Premium Redesign v2 (light-primair, meer merkkleur, groter, meer animatie)

### Nieuw
- **[FEATURE]** Thema-default omgedraaid: **light is nu het primaire thema** (geen `prefers-color-scheme`-fallback meer zonder opgeslagen voorkeur) — dark blijft volledig gelijkwaardig beschikbaar.
- **[FEATURE]** `SectionHeading`-component toegevoegd (`components/ui/SectionHeading.tsx`) — vervangt alle losse `<h2>`-sectiekoppen door een consistente kop met gele merk-kicker, over ~12 pagina's.
- **[FEATURE]** Nieuwe animatie-tokens: `ease-brand` (premium ease-out-curve voor hover/press) en `animate-page-in` (subtiele fade/slide-in bij het laden van een pagina).

### Verbeteringen
- **[UI]** `Sidebar`/`MobileNav`/`Topbar`/`MobileTopbar` zijn niet langer permanent donker — ze zijn nu theme-reactief, consistent met de rest van het scherm. Desktop `Topbar` en `MobileTopbar` hebben een vaste gele bovenrand als merkaccent.
- **[UI]** Merkkleur (geel/rood) prominenter aanwezig: kicker-balken bij sectiekoppen, sterker verzadigde badge-/KPI-achtergronden, een vleugje merkkleur op neutrale iconvlakken.
- **[UI]** Kaarten, containers en KPI-typografie een stap groter (`p-5`→`p-6`, KPI-waarden `text-3xl`→`text-4xl`, paginatitels `text-2xl`→`text-3xl`).
- **[UI]** Statische lijstrijen (Medewerkers, Rapporten) hebben nu een subtiele hover-state; kaarten behouden hun bestaande lift+schaduw-hover.
- **[DOCS]** `PRODUCT_VISION.md`/`DESIGN_SYSTEM.md`/`UI_GUIDELINES.md` bijgewerkt naar de nieuwe richting (light-primair, merkkleur, typografie-schaal, animatie-tokens).

## Sprint 3.1 — Premium UI Redesign (dark mode)

### Nieuw
- **[FEATURE]** Volledig dark-mode-systeem toegevoegd: Tailwind class-based dark mode, nieuwe `surface-dark`-tokenschaal (`tailwind.config.ts`), een `themeStore.ts` (Zustand + `persist`) die de voorkeur opslaat in `localStorage`, en een inline FOUC-preventiescript in `index.html` dat vóór React-mount de juiste class zet (respecteert `prefers-color-scheme` zonder opgeslagen voorkeur).
- **[FEATURE]** Thema-toggle (zon/maan-icoon) toegevoegd aan `Sidebar` (desktop) en `MobileTopbar` (mobiel).
- **[FEATURE]** Vaste, kleine uitlog-knop linksonder toegevoegd aan `PageWrapper` (zichtbaar op mobiel, vult het gat dat `MobileNav` geen uitlog-actie had) en aan `MijnWerkbonnen.tsx` (die geen `PageWrapper` gebruikt).

### Verbeteringen
- **[UI]** `dark:`-variants consistent toegepast over alle `components/ui/`, `components/dashboard/`, `components/werkbon/`, `components/taak/`-bestanden en alle 14 pagina's, volgens een vaste kleurmapping (zie `.ai/DESIGN_SYSTEM.md`).
- **[UI]** Hardcoded inline `style={{backgroundColor:...}}`-achtergronden (`PageWrapper`, `MijnWerkbonnen`, `PageLoader`, `AuthGuard`-foutscherm) vervangen door Tailwind-classes met een dark-pendant.
- **[CLEANUP]** Losse hardcoded hex-kleuren voor voortgangspercentages (`MijnWerkbonnen.tsx`, `WerkbonUitvoeren.tsx`) vervangen door theme-aware Tailwind-classes.

### Bekende beperkingen (bewust uitgesteld)
- Nieuwe UI-primitives (`Select`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`, generieke `Table`) en skeleton loaders blijven een aparte, latere taak (zie `.ai/FEATURE_BACKLOG.md`).
- Ingelogde schermen zijn gecontroleerd via code-review en build-verificatie; een volledige interactieve doorloop met een echt account is nog niet uitgevoerd.

## Sprint 3 — Projecten & Planning (mock-data)

### Kritieke fix
- **[CRITICAL FIX]** `Sidebar.tsx` en `MobileNav.tsx` hersteld — een eerdere, afgebroken restyling liet beide bestanden middenin een statement eindigen, waardoor `npm run build` faalde. Afgemaakt met het nieuwe donkere navthema (`NAV_BG`/`NAV_BORDER`) consistent met `Topbar`/`MobileTopbar`.

### Nieuw
- **[FEATURE]** Projecten-overzicht (`/projecten`), projectdetail (`/projecten/:id`) en weekplanning (`/planning`) toegevoegd voor de beheerdersrol, inclusief navigatie in sidebar en mobiele tab-bar. Draait op mock data (`useProjecten.ts`) — dezelfde aanpak als het bestaande dashboard, met TODO's voor de latere Supabase-koppeling.
- **[FEATURE]** Dashboard uitgebreid naar 6 KPI's gebaseerd op projectstatus (lopend, vandaag actief, niet gestart, op schema, vertraging, opleveringen).
- **[FEATURE]** Projectdetail → tab "Planning" toont nu de echte (mock) ingeplande dagen voor dat project, i.p.v. een herhaling van start-/einddatum.
- **[FEATURE]** Projectdetail → "Medewerkers koppelen"-modal werkt nu functioneel (in-memory) in plaats van een no-op.

### Verbeteringen
- **[UI]** Lege-staat op `/projecten` vervangen door een Tabler-icoon + uitleg + "filters wissen"-actie (was een kale emoji, in strijd met de iconregels).
- **[UI]** Consistente hover-transities toegevoegd aan de planningsitems op `/planning`.
- **[CLEANUP]** Ongebruikte imports (`IconX`, `berekenVoortgang`) verwijderd uit `ProjectDetail.tsx`.

### Bekende beperkingen (bewust uitgesteld)
- Projecten/Planning/medewerkerskoppeling zijn volledig mock-data — niets wordt persistent opgeslagen in Supabase. Een echte `projecten`-tabel, migratie en RLS-policies zijn een aparte, volgende sprint.
- Dark mode blijft niet uitgerold — deze sprint blijft binnen het bestaande lichte thema.

## v1.0.0 — MVP Release

### Auth fixes
- **[CRITICAL FIX]** `AuthInitializer` component toegevoegd in `App.tsx` root die auth eenmalig initialiseert. Voorheen riep elke Guard component `useAuth()` aan met eigen `onAuthStateChange` listener → race condition → infinite loading state.
- **[FIX]** `useAuth` hook vereenvoudigd naar pure store-reader zonder eigen `useEffect`. Voorkomt meervoudige listeners.
- **[FIX]** Login navigeert naar `/` (RootRedirect) in plaats van direct naar `/dashboard`. RootRedirect stuurt op basis van rol door na het laden van het profiel.
- **[FIX]** Automatisch profiel aanmaken bij `PGRST116` fout (profiel bestaat niet in database maar gebruiker wel in auth).
- **[FIX]** Foutscherm toegevoegd als profiel laden mislukt — geen oneindige loading state meer.

### Database / RLS fixes
- **[CRITICAL FIX]** `42P17 infinite recursion` opgelost. Oude policies deden `EXISTS (SELECT 1 FROM profiles ...)` binnen een policy op `profiles` → zelfreferentie → recursie.
- **[FIX]** `SECURITY DEFINER` functie `get_mijn_rol()` geïntroduceerd. Draait als postgres-eigenaar buiten RLS-context. Alle policies gebruiken deze functie voor rolcheck.
- **[FIX]** `FOR ALL` policy op `werkbon_medewerkers` opgesplitst in aparte `INSERT`/`DELETE` policies met correcte `WITH CHECK`.
- **[FIX]** `uitnodigingen_update` had `or true` (iedereen kon updaten) → beperkt tot beheerder of ingelogde gebruiker.
- **[FIX]** Indexen toegevoegd op veelgebruikte kolommen (status, datum, werkbon_id, medewerker_id).
- **[FIX]** Alle bestaande (recursieve) policies worden verwijderd voor opnieuw aanmaken.
- **[FIX]** Idempotente migratie — veilig meerdere keren uitvoerbaar.

### Code kwaliteit
- **[CLEANUP]** Alle tijdelijke debug `console.log` statements verwijderd uit productie build (51 statements in App.tsx, authStore.ts, Login.tsx).
- **[CLEANUP]** `RouteLogger` debug component verwijderd.
- **[CLEANUP]** Debug UI banner verwijderd van loginpagina.
- **[CLEANUP]** `useLocation` import verwijderd (was alleen voor debug).
- **[CLEANUP]** `versie debug-2` commentaar verwijderd.

### Bevestigd werkend
- ✅ Login met Supabase Auth
- ✅ Sessie herstel bij pagina refresh
- ✅ Logout
- ✅ Beheerder → dashboard
- ✅ Medewerker → mijn werkbonnen
- ✅ RLS: medewerker ziet alleen eigen werkbonnen
- ✅ RLS: beheerder ziet alles
- ✅ Geen infinite recursion
- ✅ Geen infinite loading state

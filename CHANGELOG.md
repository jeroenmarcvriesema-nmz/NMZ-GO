# NMZ GO — Changelog

## Het opleverrapport als PDF, gemaakt in de browser

- **[FEATURE]** Bij elke klus met foto's staat nu **Download als PDF**. Eén druk en je hebt een echt PDF-bestand: titelblad met het logo, projectgegevens, de uitgevoerde punten met een rode stip bij wat niet is afgerond, en de fotorapportage per punt. Alleen voornamen van de ploeg, en een leeg projectnummer staat er niet.
- **Waarom in de browser en niet op de server.** De verwerker is er drie keer op zijn resource-limiet afgeschoten (HTTP 546) — ook met de logobalk eruit en met de foto's al in de cache. `pdf-lib` draagt de complete standaardlettertypen en een zlib mee en houdt het hele document in het geheugen tot het in één keer wordt weggeschreven. Dat past niet in een edge function. Dat is geen instelling die verkeerd stond, maar de verkeerde plek voor dit werk.
- **De knop staat los van de aanvraag.** Aanvragen zet een rapport in de bucket voor het dossier en straks voor ClickUp; deze knop geeft je nú een bestand om te versturen, met de laatste stand van de klus. Geen wachtrij, geen bestand van vorige week.
- pdf-lib wordt pas opgehaald als je op de knop drukt. Statisch meegebundeld groeide de werkbondetailpagina van 35 naar 470 kB — het scherm dat de ploeg de hele dag op een telefoon openslaat, en dat is niet de plek voor een halve megabyte die de meesten nooit gebruiken.
- Een foto die niet op te halen is wordt overgeslagen in plaats van het hele rapport te laten mislukken. Zijn het er minder geworden, dan zegt de melding hoeveel van hoeveel erin zitten.
- De verwerker schrijft weer HTML, zoals daarvoor. Die weg is niet kapot en houdt de automatische route open.

## Zelf kiezen op welke klus je start

- **[FIX]** **De ploeg kan nu een klus aantikken en daar de werkdag starten.** Sinds de klussen van vandaag allemaal op het scherm staan, zagen Danny en Martijn er twee — maar de startknop hoorde altijd bij de klus die de app had gekozen. Op de andere klus konden ze niet klokken. Aantikken verplaatst je werkdag nu naar dat adres, en dat staat er ook bij: "Tik een klus aan om daar je werkdag te starten."
- Ook het werk van een eerdere dag dat nog niet af is, is aan te tikken. Wie gisteren niet klaar kwam en er vandaag op terugkomt, klokt gewoon op dat adres.
- De automatische keuze blijft gelden zolang niemand kiest — bij één klus per dag is dat altijd de goede, en dan verandert er niets aan het scherm.
- **Een waarschuwing tegen dubbel klokken.** Sta je geklokt op de ene klus en kies je de andere, dan verschijnt er een amber blok: *je werkdag loopt nog op X, stop die eerst*. Met een knop om er meteen naartoe te springen. Bewust geen blokkade — soms verkas je echt en dan moet het gewoon kunnen — maar niemand hoort er per ongeluk in te rollen en aan het eind van de week twee werkdagen op één dag te vinden.

## Repo en database lopen weer gelijk

- **[FIX]** De **geocodeerronde** stond in de productiedatabase uit de planner, maar in de repo stond hij er nog in. Wie de database opnieuw zou opbouwen uit deze migraties kreeg `nmzgo-geocoderen` er elke tien minuten ongevraagd bij terug — precies de ronde die bewust geparkeerd is tot de grondslag voor de afstandsmeting rond is. Migratie 042 legt de werkelijkheid vast.
- De functies blijven staan: `geocode_hartslag`, `afstand_meters`, `locaties_opruimen` en `meld_afstand_bij_aanmelden` doen niets zolang niemand ze aanroept, en weggooien zou betekenen dat een latere proefronde opnieuw gebouwd moet worden. De opruimcron blijft ook draaien — die beschermt, en doet niets zolang er niets staat.
- Aanzetten is en blijft drie handelingen met opzet: de ronde inplannen, de vlag in de app omzetten, en de verwerker uitrollen. Dat staat nu ook als commentaar op de functie in de database zelf.

## Waar je geklokt staat, daar ben je

- **[FIX]** De klus waarop je **geklokt staat** blijft nu bovenaan het scherm Vandaag staan, ook als de planning inmiddels iets anders zegt. Klokte iemand 's ochtends in op de weekklus en drukte kantoor er om tien uur een spoedje tussen, dan sprong de bovenste kaart naar dat spoedje terwijl zijn werkdag nog op de weekklus liep — met het risico dat hij punten afvinkte op het verkeerde adres.
- Geklokt zijn is geen voorspelling maar een feit, en dat weegt zwaarder dan de planning. Het spoedje verdwijnt niet: dat staat eronder in de lijst met de andere klussen van vandaag, met "alleen vandaag" erbij.
- Valt de klok naar een klus die al is afgerond of die niet meer bestaat, dan telt gewoon de planning weer. Drie tests dekken die terugval af.

## Een spoedje ertussendoor is te zien én te herkennen

- **[FEATURE]** Bij elke klus op het scherm van de ploeg staat nu **waar in de klus die dag zit**: "dag 2 van 10", "laatste dag van 2", of "alleen vandaag". Twee adressen onder elkaar zeiden niet welke de klus van tien dagen was en welke het spoedje dat er tussendoor is gedrukt — precies het verschil dat bepaalt wat er die dag af moet.
- "Alleen vandaag" is bewust het sterkste geval: dat is de klus waar één dag voor is. "Laatste dag" komt daarna, want dat is de dag waarop je nog even doorzet in plaats van het naar morgen te schuiven.
- Het staat op **Vandaag** — bij de klus zelf én bij de andere klussen van die dag — en op **Mijn week**, waar het per dag meetelt: de klus van 1 t/m 10 september staat op de 2e als "dag 2 van 10" en het spoedje ernaast als "dag 1 van 2".
- Zes tests erbij, gebouwd op precies dat scenario, inclusief de randgevallen: een bon zonder einddatum telt als één dag, en een klus die uitloopt krijgt geen "dag 12 van 10" maar blijft op zijn laatste dag staan — die heeft zijn eigen blok op het scherm.

## Geklokt is bezig, en een tussendoorklus verdwijnt niet meer

### Justin stond geklokt en toch bij "nog niet gestart"
- **[FIX]** Op het scherm **Lopend** telde een lopende werkdag niet mee voor de stand van een klus. Justin klokte om 11:13 in op Het Sander 10 in Enschede en de klus stond er als **Nog niet gestart** — onderaan de lijst, tussen het werk waar nog niemand naar had omgekeken. De klus zat wél in de lijst; hij stond alleen in het verkeerde blok, want de lijst sorteert op stand.
- De oorzaak is een half toegepaste regel. `klusstand` weet allang dat een lopende werkdag hetzelfde bewijs is als een afgevinkt punt — een monteur klokt in als hij aankomt en vinkt zijn eerste punt pas uren later af. Het dashboard geeft dat gegeven ook netjes mee, op vier plekken. `useLopend` berekende het, zette het in de uitvoer, en gaf het niet door aan `klusstand`. Dat gebeurt nu wel.
- Het verschil is zichtbaar zodra iemand nog niets heeft afgevinkt. Danny en Martijn stonden wél goed op Bezig, maar alleen omdat ze toevallig al twee punten af hadden — niet omdat de app wist dat ze aan het werk waren.

### Een klusje tussendoor stond nergens
- **[FIX]** **De ploeg ziet nu álle klussen die vandaag voor ze staan.** Wie vijf dagen op één klus staat en er één dag een klusje tussendoor krijgt, zag dat tweede nergens: het scherm Vandaag koos één klus, en dat werd altijd de meerdaagse. De tussendoorklus is nu juist degene die vandáág af moet — er is één dag om hem te doen.
- **De volgorde gaat op einddatum in plaats van begindatum.** Wat vandaag eindigt gaat voor wat pas donderdag eindigt. Bij een gelijke einddatum wint de klus die het langst loopt: daar staat de ploeg al, en die hoort niet ineens tweede te worden.
- Daarnaast staan de andere klussen van vandaag als lijstje op het scherm, in dezelfde vorm als het blok "nog niet afgerond van een eerdere dag" dat er al stond. Eén klus onzichtbaar is één klus die niet gedaan wordt, en welke van de twee bovenaan komt hoort dat niet te bepalen.
- Zes tests erbij op `looptVandaag` en `kiesVandaag`, waaronder het geval uit de uitvoering zelf: een weekklus van 24 t/m 28 augustus met een tussendoorklus op de 26e.

## Zeven knoppen die stilletjes niets deden

- **[FIX]** **De ploeg wijzigen, de planning verzetten, een punt toevoegen of weghalen, een container of dixi afvinken, en vervolgwerk melden of afronden werkten geen van alle.** Ze gaven `violates check constraint "werkbon_gebeurtenissen_soort_check"` en lieten de klus achter zoals hij was. Migratie 039 zet het recht.
- De oorzaak zat in het logboek, niet in de knoppen. `werkbon_gebeurtenissen` kende sinds migratie 015 drie soorten — stilgelegd, hervat, opgeleverd — en elke handeling die er daarna bij kwam schrijft een eigen soort in dat logboek zonder dat de controle daarop is meegegroeid.
- Waarom dat de hele handeling sloopt en niet alleen de regel eronder: die insert is de laatste stap ín de functie, en een functie is één transactie. De afgekeurde logregel rolt alles terug wat ervoor gebeurde. Kantoor zette dus een nieuwe ploeg op de bon, kreeg een foutmelding, en de oude ploeg stond er nog. Dat is het vervelendste soort fout — de foutmelding gaat over iets anders dan wat er misging.
- **[FIX]** En zodat dit niet nog eens maanden onopgemerkt blijft: `tests/migraties.test.ts` leest de migraties zoals Postgres ze zou toepassen, houdt per kolom bij welke waarden de laatste check nog toestaat, en legt daar elke waarde naast die ergens in een insert wordt geschreven. Draait mee in de CI op elke push. De test vond zelf twee van de zeven overtredingen die met de hand over het hoofd waren gezien.
- Zonder migratie 039 valt hij om met alle zeven, mét de naam van het bestand en de waarde die ontbreekt — een build-fout in plaats van een telefoontje. De regel staat nu ook bij de verboden acties in `.ai/CLAUDE.md`.
- Bestaande gegevens blijven ongemoeid. Er stonden alleen soorten in die al waren toegestaan — de rest is nooit binnengekomen.

## "Nog spuiten/isoleren" is geen stilgelegde klus

- **[FIX]** Er staan vier knoppen op de werkbon en alle vier riepen `werkbon_stilleggen()` aan. Voor **stilleggen** en **asbest** klopt dat — daar staat het werk stil. Voor **nog spuiten/isoleren** en **opnieuw inplannen/later** niet: dat zijn statussen op het bord in ClickUp, en de klus loopt gewoon door. Toch zetten ze `stilgelegd_op`, en omdat `klusstand()` die kolom als eerste leest ging de héle app erin mee — het kaartje werd rood met "Ligt stil", op de planning, op het dashboard, in de containerlijst en in de telling van wat er vastzit.
- De twee vervolgknoppen gaan nu naar **`werkbon_vervolg_melden()`** (migratie 035). Die zet de status in ClickUp, legt vast wát er nog moet gebeuren en waarom, en **raakt `stilgelegd_op` niet aan**. De klus houdt zijn echte stand — bezig, niet gestart, klaar om af te ronden — en blijft als lopend werk meetellen.
- De melding staat op de bon in een **blauw** blok in plaats van het oranje "ligt stil": nog spuiten/isoleren of opnieuw inplannen, met de toelichting en de status zoals hij op het bord staat. Ook zichtbaar op de werkbonkaart, op Lopend en op het scherm van de zwamsaneerder — die moet weten dat er nog iets ligt. Eén knop **"Vervolgwerk is gedaan"** haalt hem er weer af en zet de taak in ClickUp terug op de gewone status.
- De twee vervolgknoppen zijn blauw geworden, zodat je vóór het klikken ziet dat ze iets anders doen dan de twee ernaast. De uitleg bij het vrije stilleggen zei dat je reden de ClickUp-status stuurt; er staat nu dat die knop de klus écht stillegt, en dat je voor de andere gevallen de blauwe knoppen hebt.
- **Twee klussen stonden er al fout in** — Hugo de Grootlaan 7 en Muiderslotweg 222, allebei met "Nog spuiten/isoleren" — en worden door de migratie rechtgezet: hun toelichting verhuist mee, en ze liggen niet meer stil. Hun ClickUp-status was al goed, dus daar gaat niets naartoe.

## De containerlijst uit het dashboard, en punten weghalen dat werkt

### Containers & dixi's krijgen een eigen scherm
- **[FEATURE]** Nieuw scherm **Containers & dixi's** (`/voorzieningen`), in de zijbalk onder Uitloop en op een telefoon in het "Meer"-blad. De volledige lijst stond als kaart halverwege het dashboard: je moest ernaartoe scrollen langs alles waar het niet over ging, terwijl dit het enige blok op dat scherm is waar een dag uitstel meteen geld kost.
- Op het dashboard staan nu **drie aantikbare tegels** — Af te melden, Te bestellen, Staat er — direct onder de werkvoorraad. Met het scherpste geval eronder in plaats van een samenvatting: "langste 8 dagen over de datum" zegt of dit vandaag moet, "3 open" niet. Een tegel op nul gaat nergens heen.
- Kleur draagt de dringendheid: **rood** is over de datum, **oranje** vandaag of morgen, **blauw** binnen drie dagen, **grijs** later. Als streepje links van de regel, als chip mét het woord erin, en in de kop van de stapel — die de kleur van zijn zwaarste regel krijgt, zodat je aan de kaart al ziet of er iets te laat is. Geen geel: dat is van het merk.
- De tekst stond in drie regels grijs van elf pixels onder elkaar en las op een telefoon als één vlek. Nu: het adres groot, daaronder wát het is en wannéér het moet als aparte chips, en de datums en het bonnummer eronder.
- De knoppen dragen in beide standen kleur, en het woord verandert mee: vóór het stempelen staat de handeling ("Bestellen", "Afmelden"), daarna de stand ("Besteld", "Afgemeld"). Ze waren allebei grijs tot je ze aantikte, waardoor wat er nog moest gebeuren en wat al gedaan was alleen in een vinkje van veertien pixels verschilden.

### Punten weghalen was nergens te zien
- **[FIX]** De knop **Punt weg** stond achter `!readOnly` en was daarmee op élk scherm onzichtbaar. Op de werkbon van kantoor staat `readOnly` altijd aan — daar wordt niet afgevinkt — en op het scherm waar hij uit staat zit de zwamsaneerder, die de bevoegdheid niet heeft. De knop bestond dus wel, maar niemand kon erbij. Hetzelfde gold voor de knop die de **fotoplicht** per punt aan- en uitzet.
- Afvinken en beheren zijn nu twee dingen: `readOnly` gaat over de ploeg, de beheerknoppen staan er los van en verschijnen zolang de bon niet is opgeleverd — dezelfde grens die `werkbon_punt_verwijderen()` zelf trekt (migratie 032).
- De melding "de foto's konden niet worden geladen" stond in datzelfde blok en was daardoor voor kantoor onzichtbaar. Die staat nu bij de foto's, waar hij over gaat.

## Een herziene werkopdracht, en wat er op een klus gebeurt

### De herziene werkopdracht komt binnen
- **[FIX]** Wordt er een **nieuwe versie van de werkopdracht** in ClickUp gehangen, dan leest NMZ GO die nu opnieuw. Dat gebeurde niet: de ronde slaat een bon over zodra hij zijn PDF heeft — met reden, anders wordt er elke vijf minuten vijfenveertig keer een PDF gedownload — maar daarmee kwam een herziening nooit meer binnen. Ging de container daarin van 6 naar 10 kuub, dan bleef in de app 6 staan, en op die 6 wordt besteld. Precies het geval waar de containerlijst voor is gebouwd.
- Het kost niets. ClickUp geeft de datum van de bijlage mee in het antwoord dat we tóch al ophalen, dus die vergelijking is gratis; de PDF wordt alleen gehaald als hij écht nieuwer is (migratie 034 bewaart die datum per bon). Hangt de opdracht los aan de taak in plaats van in het veld, dan wordt de taak apart opgehaald — maar alleen als ClickUp zegt dat er sinds onze vorige ronde iets aan die taak is veranderd.
- De vijfenveertig bonnen die er al stonden hadden nog geen datum. Die krijgen er bij de eerstvolgende ronde eentje, **zonder dat hun PDF opnieuw wordt gehaald** — wat we hebben ontleed hoort immers bij de bijlage die er nu hangt. Zonder dat ijkpunt is er niets om "nieuwer" tegen af te meten en zou een herziening op de bestaande klussen nooit gezien worden. Hangt de opdracht los aan de taak in plaats van in het veld, dan wordt daar eenmalig voor gekeken; anders zou juist die groep nooit een ijkpunt krijgen.
- De twee datums worden als **tijdstip** vergeleken en niet als tekst. Postgres geeft `...+00:00` terug waar ClickUp `...Z` levert — hetzelfde moment, andere letters, en alfabetisch staat "Z" ná "+". De eerste ronde na het uitrollen laadde daardoor zesentwintig PDF's opnieuw en meldde ze allemaal als herzien. Gerepareerd en met twee ronden nagemeten: 27 ongewijzigd, geen enkele download.
- **Wat wél wordt bijgewerkt:** de kop van de opdracht — container, dixi, kluiscode, inspecteur en zijn telefoonnummer. Daar wordt op besteld en gebeld, en daarvoor wordt een herziening rondgestuurd. De PDF zelf wordt ook vervangen, dus wie hem openslaat ziet de nieuwe.
- **Wat níét wordt bijgewerkt:** de punten. Daar hangt het afvinkwerk aan, met foto's en al; opnieuw invoeren zou dat wissen en samenvoegen betekent raden welke regel "dezelfde" is als eentje die net iets anders is opgeschreven. Staat er in de herziening ander werk, dan hoort een mens daarnaar te kijken — daarom komt elke herziening als melding terug in het resultaat van de ronde.

### Een activiteitenfeed per lopende klus
- **[FEATURE]** Klap je op **Lopend** een klus open, dan staat er naast de punten nu een **activiteitenfeed**: wie er is gestart en gestopt, welk punt wanneer is afgevinkt, wanneer er foto's bij kwamen, en of de klus is stilgelegd, hervat, opgeleverd of van ploeg of planning gewijzigd. Op volgorde van tijd, met de tijd van vandaag als klok en alles daarvoor met de dag erbij.
- De bon laat de **toestand** zien: welke punten af zijn. Wat hij niet laat zien is het **verloop** — of het vanochtend om acht uur op gang kwam of pas om elf uur, en of er halverwege iets is veranderd. Dat is wat je 's middags wilt weten.
- Geen fotorapportage: die staat al op de bon zelf. Foto's worden per punt samengevat — "4 foto's bij Balk 12" met het moment van de laatste. Twintig losse regels "foto toegevoegd" is geen feed maar een logboek.
- Laadt pas als je een klus openslaat, niet voor alle acht tegelijk.
- Een punt weet sinds migratie 034 ook **wannéér** het is afgevinkt. Uitvinken haalt dat moment weer weg — anders zou de feed een tijd tonen die niet meer klopt. Wat vóór deze migratie is afgevinkt heeft geen moment en staat er dus niet in; dat is eerlijker dan er een tijd bij verzinnen.

## Lopend, punten weghalen, en de containers

### Eén scherm voor wat er vandaag loopt
- **[FEATURE]** Nieuw scherm **Lopend**: alle klussen die vandaag lopen, onder elkaar, mét hun activiteiten. Per klus de ploeg, de werktijden van vandaag, de voortgang, en de punten met hun titel — welke af zijn en welke nog een foto missen. Het dashboard zei hoevéél er liep en de bonnenlijst wélke klussen er waren; voor "wat gebeurt er nu op de vloer" moest je elke bon los openslaan. Bij acht klussen is dat acht keer klikken en terug.
- De punten staan ingeklapt. Acht klussen van twintig punten is honderdzestig regels, en dan ben je het overzicht juist kwijt.
- Er staat een teller bij hoeveel punten fotoplicht hebben maar nog geen foto. Dat is wat het afronden vanavond tegenhoudt, en dat wil je nú weten en niet als de ploeg al thuis is.

### Een punt van een werkbon halen
- **[FEATURE]** Kantoor kan een punt **verwijderen** — beheerder, uitvoerder, werkvoorbereider, planner en eigenaar. Nodig als de parser een kopregel als punt heeft gelezen, of als meerwerk toch niet doorgaat; zo'n punt blijft anders eeuwig openstaan en houdt het afronden tegen. Twee tikken, want het is onomkeerbaar.
- Drie sloten (migratie 032): niet op een opgeleverde bon, en niet als er foto's aan het punt hangen. Die foto's zijn het bewijs dat het werk gedaan is; die gooien we niet weg als bijvangst. Wie het punt écht kwijt wil haalt eerst de foto weg — dan is dat een aparte, zichtbare handeling. Wat eraf gaat komt met titel en al in de gebeurtenissen te staan.

### Containers en dixi's afvinken
- **[FEATURE]** Kantoor kan per container en per dixi aanvinken dat hij **besteld** is en dat hij **afgemeld** is (migratie 033). Zonder dat blijft het een lijst die elke ochtend opnieuw doorgelopen moet worden — en dan belt de een de verhuurder voor de tweede keer terwijl de ander denkt dat het geregeld was.
- **Afmelden kan altijd, ook vóór de opleverdatum.** Een klus die op dag twee van de vijf al leeg is hoeft de container niet nog drie dagen te houden; dat is precies de huur die je bespaart. Daarvoor is er een derde stapel **Staat er**: besteld en nog niet afgemeld.
- De drie stapels sluiten elkaar uit, dus afvinken verplaatst een regel zichtbaar naar de volgende in plaats van hem twee keer te laten staan. Een vinkje kan er ook weer áf: wie de verkeerde regel aantikt hoort daar niet aan vast te zitten.
- Eén regel per voorziening in plaats van per klus. Een container en een dixi zijn twee bestellingen met elk hun eigen moment — de container kan besteld zijn terwijl de dixi nog moet.
- Alleen voor kantoor: de tabel laat via RLS niemand anders binnen, en het vinkje gaat door dezelfde rolcheck als de rest.

### Containers en dixi's
- **[FEATURE]** Nieuwe kaart op het dashboard: **Containers & dixi's**, per adres, met twee blokken. **Afmelden** staat bovenaan — de opleverdatum is bereikt en de huur loopt door — en **Bestellen** eronder, voor wat er de komende tien dagen moet staan. Op de opleverdatum zelf staat er "vandaag afmelden"; daarna telt hij de dagen die eroverheen zijn.
- Het wordt gelezen uit de werkvoorbereiding die er al staat. Geen nieuw veld en geen extra invoer: de werkvoorbereider vult het al in ClickUp in, en het twee keer laten opschrijven is een garantie dat het ooit niet meer overeenkomt.
- De tekst is grillig en dat is de hele klus. Met en zonder vraagteken, "Ja 6 m3" naast "6m3", aan elkaar geplakt ("Neebewoners tel.nr."), en geregeld staat de sjabloonvraag ("Ja of Nee incl. aantal m3.") vóór het echte antwoord — zonder die weg te strepen leest élke opdracht als "ja". Ook "2x 10m3" wordt gelezen, want één container bestellen waar er twee moeten staan is een halve klus. Veertien tests, allemaal op teksten die letterlijk in de database staan.
- Wat er niet staat wordt niet geraden: dat heet "niet vermeld" en niet "nee". Het verschil is precies het verschil tussen wél en niet bellen. Zulke klussen komen daarom ook niet in de lijst — anders vult die zich met klussen waarvan we het gewoon niet weten, en dan is een volle lijst geen signaal meer.
- Een stilgelegde klus blijft in de lijst staan. Juist dán blijft er een container voor de deur staan waar niemand meer aan denkt.

## Doorklikken vanaf het dashboard, en de uren terug in beeld

- **[FEATURE]** De vier tegels bovenaan het dashboard zijn nu **aantikbaar**. Klik op "Bezig" en je komt in de werkbonnenlijst met dat filter al aan — hetzelfde voor stilgelegd, af te ronden en niet gestart. Alleen "Uitgelopen" houdt zijn eigen scherm: daar staat de reden en de historie bij, en dat is een andere vraag dan "welke klussen zijn dit". Een tegel op nul gaat nergens heen; doorklikken naar een lege lijst is een belofte die niet wordt waargemaakt.
- **[FEATURE]** **De werktijden staan weer bij de klussen.** Op het dashboard bij elke klus van vandaag: "sinds 08:12 · 3:14 u" met een groen stipje zolang er iemand loopt, of "08:12–16:30 · 8:18 u" als ze zijn geweest. Dat verschil is het hele punt — zonder dat is 08:12 een getal zonder betekenis.
- Dit lag er al half in: de starttijd wérd berekend, want daarmee bepaalt het dashboard of een klus achterloopt. Alleen kwam hij nergens op het scherm. Kantoor zag dus wél dat een klus achterliep en niet sinds hoe laat er iemand aan het werk was.
- **[FEATURE]** Nieuwe kaart **Werktijden** op de werkbon zelf, voor kantoor: per persoon per dag de start, de stop en het aantal uren, met het totaal bovenaan. De werkdaglogs bestaan sinds migratie 006 en werden door drie schermen gebruikt, maar nergens vanuit de klus — terwijl dat precies het getal is dat je bij een uitloopgesprek of een discussie over meerwerk nodig hebt.
- Een dag die door de nachtelijke opruiming is dichtgezet staat er als **automatisch afgesloten** bij. Dat is geen gewerkte tijd maar een vergeten stopknop, en anders staat er een dag van tien uur in de lijst die niemand kan verantwoorden.
- Een zwamsaneerder ziet deze kaart niet: zijn eigen tijden staan op Vandaag, de uren van zijn maat zijn niet aan hem.

## Asbest in het oranje, en twee knoppen erbij

- **[FEATURE]** Een klus die op **asbest** stilligt is nu fel oranje: rand, vlak en badge op de planning en in de bonnenlijst, met het woord "asbest" erbij. Rood was al bezet door stilgelegd — en asbest ís stilgelegd, dus dat maakte geen onderscheid. Dit is dezelfde kleur die ClickUp aan "onhold door asbest" geeft: wie de twee borden naast elkaar heeft, ziet hetzelfde. Asbest gaat vóór uitloop: een asbestklus die ook over zijn datum heen is, blijft in de eerste plaats een asbestklus.
- **[FEATURE]** Vier knoppen in plaats van twee: **stilleggen, asbest, opnieuw inplannen en nog spuiten/isoleren**. Ze zetten alle vier hetzelfde in gang; het verschil is het woord dat vóór je reden komt, en dus welke status de taak in ClickUp krijgt. Asbest heeft er een gekregen omdat het de zwaarste is — dat je dat woord precies moest intypen om die status te raken was een onnodig risico op de verkeerde plek.
- **[FEATURE]** "Nog spuiten/isoleren" bestond al als status in ClickUp maar niet in NMZ GO; zulke klussen vielen terug op het algemene "on hold". Juist die status zegt wélk werk er nog ligt en dus wie er ingepland moet worden. Migratie 031 zet hem erbij.
- **[FIX]** De herkenning kijkt nu door de Nederlandse vervoeging heen: "geïsoleerd" (met trema) en "gespoten" werden allebei gemist. Iemand die met natte handschoenen op een telefoon typt hoort daar niet op af te ketsen.
- **[FEATURE]** Filteren op **asbest** op de weekplanning en in de bonnenlijst, naast het uitloopfilter.

## Een zesde kleur: klussen die uitlopen

- **[FEATURE]** Een klus die over zijn opleverdatum heen is krijgt nu **amber**: een rand links op de planningkaart en de werkbonkaart, met het woord "loopt uit" erbij. De berekening (`dagenUitloop`) bestond al, maar werd op precies één scherm gebruikt — de Uitloop-pagina van kantoor. Overal anders was een klus die drie dagen te laat is niet te onderscheiden van een klus die keurig op schema loopt: allebei blauw, allebei "Bezig". Dat is informatie die er lag en die niemand zag.
- Uitloop is bewust **geen nieuwe stand maar een laag eroverheen**. Een klus die uitloopt is nog steeds bezig of ligt nog steeds stil; dat blijft de eerste vraag. De badge houdt daarom de stand, de rand draagt de uitloop.
- Amber en niet rood: rood is gereserveerd voor stilgelegd, het enige dat een telefoontje vraagt. Een klus die uitloopt lóópt nog — die vraagt aandacht, geen ingreep. En amber is niet het merkgeel uit de knoppen.
- **[FEATURE]** Een **stilgelegde klus die óók over zijn datum heen is** telt mee als uitloop. Dat tweede verdwijnt niet omdat het eerste waar is, en het is precies de combinatie waar kantoor naar zoekt.
- **[FEATURE]** Filteren op stand in de **weekplanning** — die had alleen een filter op ploeg en een zoekveld. Van een volle week maak je nu een lijstje van de vier klussen die stilliggen of te laat zijn. Op de werkbonnenlijst is "Loopt uit" als filter bijgekomen.
- Zes tests bij `looptUit`, waaronder het randgeval dat een afgeronde klus nooit uitloopt hoe laat hij ook was.

## Wijzigen terwijl de klus loopt

- **[FEATURE]** Kantoor kan nu **de ploeg van een lopende klus wijzigen** — beheerder, uitvoerder, werkvoorbereider en planner. Dat kon nergens: wie erop stond kwam uit ClickUp en was in NMZ GO niet aan te raken. Viel er iemand uit, dan moest het in ClickUp en maar hopen dat de ronde het ophaalde.
- **[FEATURE]** Wat je hier wijzigt **gaat terug naar ClickUp**. De ploeg komt onder Medewerkers te staan, de datums als start- en opleverdatum én in de custom velden. Zonder dat zou de synchronisatieronde de ploeg binnen vijf minuten terugzetten naar wat ClickUp nog dacht — de ronde veegt namelijk elke keer iedereen weg die niet handmatig is toegewezen.
- **[FEATURE]** Er kan een **punt worden toegevoegd** aan een klus die al loopt. Meerwerk dat in de kruipruimte wordt afgesproken stond nergens, en er werd dus ook geen foto van gevraagd. Standaard mét fotoplicht: meerwerk is juist het werk waarvan achteraf de vraag komt of het echt gedaan is. Gaat niet naar ClickUp — de punten komen uit de PDF en daar is aan die kant geen veld voor.
- **[FIX]** Op de Planning-kaart stond dat ClickUp zou winnen en dat de eerstvolgende ronde je datums zou terugzetten. Dat was niet waar: een bon die zijn PDF heeft wordt door de ronde overgeslagen, op de status na. Die waarschuwing hield mensen van een knop af die gewoon werkte.
- **[FIX]** Een lange titel duwde de sluitknop uit het venster op een telefoon, en de inhoud van een venster stond op 28 pixels marge terwijl de kop erboven op 24 stond. Kop en inhoud lopen nu gelijk en de marge volgt de rest van de app: krap op mobiel, ruim vanaf tablet.

## Klussen die er niet in stonden

- **[FIX]** Dahliastraat 6 te Rijnsburg stond op "deze week", had een werkopdracht en kwam toch niet in de app. De reden: de PDF hing als losse bijlage aan de ClickUp-taak in plaats van in het veld "Werkopdracht (PDF)". De synchronisatie keek alleen naar dat veld, zag niets en sloeg de taak over. Voor de werkvoorbereider is een PDF in de taak slepen één handeling in plaats van drie, en aan de ClickUp-kant ziet het er hetzelfde uit — dus dat gaat gebeuren. De synchronisatie kijkt nu op allebei de plekken. De bon staat er inmiddels: 18 punten, kluiscode 1975, Rene en Justin erop.
- Er wordt niet geraden. Alleen een PDF met "opdracht" in de naam telt mee en een tekening wordt uitgesloten; is er niets dat past, dan blijft het een overslag mét reden. Een willekeurige bijlage als werkopdracht ontleden is erger dan een ontbrekende bon.
- **[FIX]** De synchronisatie las maar één pagina van ClickUp. Die geeft er honderd per keer terug en zegt in `last_page` of er meer zijn — dat werd niet gelezen. Nu staan er 26 taken op de triggerstatussen, dus het viel niet op; op de dag dat het er meer worden zou de rest zonder melding verdwijnen. Wordt nu doorgebladerd.
- **[FIX]** "Geen werkopdracht-PDF op de taak" zei niet wat er moest gebeuren. De melding noemt nu allebei de plekken waar gekeken is.
- **[FIX]** Een bijlageveld in ClickUp neemt méér dan één bestand aan, en de werkvoorbereider hangt de tekening geregeld in hetzelfde veld als de opdracht. De code pakte blind het eerste bestand. Bij Amsteldijk 157 HS stonden ze in de volgorde tekening, opdracht — en dus werd de tékening als werkopdracht ontleed, met "de kop ontbreekt" als uitkomst. Zeven klussen struikelden hierover. Er wordt nu op naam gekozen: de opdracht heet "Opdracht_…", de tekening heeft "TEK" of "tekening" in de naam. Staat er één bestand in, dan verandert er niets.
- Na deze ronde staan er **elf klussen bij** die er niet in stonden, waaronder Dahliastraat 6 en Amsteldijk 157 HS. Zes blijven over, allemaal met reden in het resultaat en geen van alle een fout in de koppeling: vier opdrachten wijken af van het sjabloon (geen kop, of geen punten onder de kop), één PDF is stuk ("Invalid PDF structure"), en Project Utrecht heeft geen enkele bijlage.
- **Bekend en niet opgelost:** van de 44 bonnen uit ClickUp hebben er 2 een werktekening. De tekening wordt alleen gezocht in velden die "tekening" heten; hangt hij in het werkopdrachtveld of los aan de taak, dan blijft hij liggen. Dat stond al zo en is een eigen klus.
## Een klus met de hand inplannen

- **[FEATURE]** Bij het handmatig aanmaken van een werkbon kun je nu een **startdatum en een opleverdatum** invullen. Zonder die twee viel een handmatige bon terug op "vandaag" en stond hij dus in de verkeerde week — precies het geval dat je nodig hebt als een klus niet vanzelf uit ClickUp komt. De opleverdatum mag leeg blijven; dan is het een klus van één dag.
- **[FEATURE]** Op de werkbon zelf staat nu een kaart **Planning** waarmee je die twee datums alsnog kunt wijzigen. Een typefout betekende hiervoor: bon weggooien en opnieuw aanmaken. Bij een klus uit ClickUp staat erbij dat ClickUp wint — de eerstvolgende ronde zet de datums daar terug.
- **[FEATURE]** Eigen knop **"Opnieuw inplannen"** naast stilleggen. De ClickUp-status *opnieuw inplannen/later* was al bereikbaar, maar alleen door precies die woorden in de reden te typen; nu zet de knop dat zelf. De melding op de bon zegt dan "Deze klus moet opnieuw ingepland worden" in plaats van "ligt stil" — dezelfde toestand, een andere beslissing.
- Geen migratie: de database leidt de ClickUp-status al af uit de reden (`statusUitReden`, migratie 015).

## Repo en productie weer op één lijn

- **[FIX]** De edge function `verwerker` liep achter op de repo en is uitgerold (v13). Daarmee gingen drie dingen live die alleen in de code stonden: het bijwerken van het personenregister tijdens elke ronde, de stilleg-tekst naar ClickUp die geen verschoven opleverdatum meer belooft (migratie 029 was al toegepast, dus productie meldde daar iets onjuists), en de handler voor het opruimen van de fotobucket.
- De eerste ronde op de nieuwe versie bewees het meteen: `toegevoegd: ["Jeffrey Huizenga", "Anthony", "Nico Kuijt"]` — precies de drie namen die in ClickUp waren toegevoegd en in de app niet bestonden. 29 taken gezien, niets mislukt.
- **[FIX]** Blok E van migratie 027 was nooit uitgevoerd: de cronjob `nmzgo-fotos-opruimen` bestond niet, dus de opruimronde van de fotobucket draaide nooit. Staat nu ingepland op 03:15 UTC. Vooraf gecontroleerd wat hij zou raken: nul foto's, nul weesbestanden — de wachttijd van veertien dagen na oplevering betekent dat er tot eind augustus niets gebeurt.
- **[FEATURE]** Elke deploy wordt voortaan teruggelezen en byte-voor-byte met de repo vergeleken; hoe dat gaat en welk onschuldig verschil je kunt tegenkomen staat in `DEPLOYMENT.md`. De volledige stand van git, database, functies en cron staat in `HANDOVER.md` (hoofdstuk 0a).

## Een uitrol mag de man in het veld niet omvergooien

- **[FIX]** Elke keer dat er een nieuwe versie werd uitgerold, klapte de app bij iedereen die hem al open had staan. De oorzaak zit in de combinatie van twee dingen die los prima zijn: elk scherm wordt apart ingeladen met een hash in de bestandsnaam, en `netlify.toml` stuurt alles wat niet bestaat door naar `index.html`. Een telefoon die sinds vanochtend openstaat vraagt dus om een bestand dat niet meer bestaat en krijgt HTML terug in plaats van JavaScript: *"'text/html' is not a valid JavaScript MIME type"*. Op 12 augustus stond dat acht keer in het foutenlogboek, bij twee gebruikers, op een dag met drie uitrollen.
- Nu vangt de app het zelf op. Vite meldt zo'n mislukte inlaadpoging, en de app herlaadt zichzelf — hoogstens één keer per minuut, want een herlaadlus is erger dan de fout. Komt het tóch bij de Foutvanger terecht, dan staat er geen rood storingsscherm maar "Er is een nieuwe versie" met één knop. Het is namelijk geen storing.
- **[FIX]** Een mislukte foto-upload gaf altijd dezelfde zin: *"De foto kon niet worden opgeslagen. Probeer het opnieuw."* Dat klopt zelden. Er zijn drie gevallen met drie verschillende vervolgstappen: geen bereik (straks opnieuw), sessie verlopen doordat de telefoon lang op de achtergrond stond (opnieuw inloggen — drukken helpt niet), of een echte serverfout (kantoor bellen). De app zegt nu welke van de drie het is.
- **[FEATURE]** En vooral: **de foto blijft klaarstaan.** Mislukt het versturen, dan houdt het scherm het bestand vast en staat er een knop "Foto opnieuw versturen" — met dezelfde foto, zonder dat iemand terug de kruipruimte in moet.
- **[FEATURE]** 9 tests erbij (`uploadfout`), **152 in totaal**.

## Een werkdag die niet wordt afgemeld

- **[FIX]** Wie 's avonds vergat af te melden, liet een werkdag openstaan — en die telde daarna voor **nul uren**, want `usePersoonDetail` slaat een log zonder stoptijd over. Op het dashboard stond zo iemand tot in de nacht "aan het werk". Twee dagen stonden er open, waarvan één van twee dagen oud.
- **[FEATURE]** Migratie 031: `werkdagen_afsluiten()` zet zo'n dag dicht op **17:00**, in Amsterdamse tijd van zijn eigen datum (niet in UTC — anders verschuift het moment met de zomertijd). Draait elk uur via pg_cron; de functie kijkt zelf of vijf uur al geweest is, dus de werkdag van vanmiddag blijft gewoon lopen.
- 17:00 is een aanname en geen meting, en dat staat er ook bij: de nieuwe kolom `automatisch_afgesloten` maakt het verschil zichtbaar tussen "hij heeft afgemeld" en "de computer heeft het dichtgezet". Meldt iemand alsnog zelf af of hervat hij zijn dag, dan gaat die vlag weer uit.
- Wat dit **niet** is: urenregistratie. Geen pauzes, geen correcties, geen goedkeuring — die grens uit migratie 006 blijft staan. Dit repareert alleen dat een dag helemaal niet meetelde.

## De ploeg groeide niet mee met ClickUp

- **[FIX]** Wie in ClickUp bij het veld *Medewerkers* werd toegevoegd, bestond in NMZ GO niet. De oorzaak: "De ploeg" komt uit de tabel `personen`, en die is één keer met de hand gevuld door migratie 010/014 met 32 namen. **Niets werkte die lijst ooit bij** — de synchronisatie leest hem alleen om namen op een klus te herkennen, en de app had geen enkele knop om iemand toe te voegen. Verversen hielp dus niet: de namen stonden nergens.
- **[FEATURE]** De synchronisatieronde houdt het register nu gelijk met ClickUp. De keuzelijst van het medewerkersveld zit al in elke taak die hij toch al ophaalt, dus dat kost geen extra aanroep. Nieuwe namen worden aangemaakt (naam én ClickUp-koppeling), en de labellijst in de instellingen groeit mee.
- **[FEATURE]** Knop **"Uit ClickUp ophalen"** op de medewerkerspagina, voor wie niet op de volgende ronde wil wachten omdat er vanmiddag iemand ingepland moet worden. Werkt ook in een week zonder klussen: de nieuwe edge function `ploeg-bijwerken` vraagt de veldenlijst rechtstreeks bij ClickUp op. De service-role wordt daar voor precies één ding gebruikt — het token uit Vault — en al het lezen en schrijven daarna gaat door de client van de aanroeper, dus RLS bepaalt wat mag.
- **[FEATURE]** Knop **"Persoon toevoegen"** ernaast: naam en optioneel de ClickUp-naam. Nodig voor wie helemaal niet in ClickUp staat, en als noodklep als de koppeling hapert.
- Twee dingen gebeuren bewust **niet**: er wordt niemand verwijderd als een naam uit ClickUp verdwijnt (er hangen werkbonnen, uren en misschien een account aan), en een bestaande koppeling wordt nooit stilletjes gebroken — de labellijst is de vereniging van wat ClickUp aanbiedt en wat al in gebruik is.
- De regels staan in één bestand (`verwerker/register.ts`) dat door allebei de wegen wordt gebruikt. Twee kopieën lopen uit de pas, en dan hangt het van de route af of iemand wel of niet in de ploeg belandt.

## De werkopdracht mag er ook met de hand in

- **[FEATURE]** Bij het handmatig aanmaken van een werkbon kun je nu de **werkopdracht als PDF** aanreiken. De punten onder *Uit te voeren werkzaamheden* worden eruit gehaald en staan meteen als taken op de bon — met dezelfde parser als de ClickUp-route, dus dezelfde punten voor dezelfde opdracht. Kluiscode, inspecteur, telefoonnummer, adres en werkvoorbereiding komen mee, en het opdrachtnummer van de werkvoorbereider wordt het bonnummer (migratie 022).
- Wat al ingevuld staat blijft staan. Zijn er al punten ingetypt, dan overschrijft de PDF ze niet maar verschijnt er een knop *Punten overnemen*. Tien punten kwijtraken omdat je de tekening erbij zocht is geen wisselgeld.
- Is het geen NMZ-werkopdracht, dan valt de herkenning terug op opsommingstekens en nummers — dezelfde herkenning als het tabblad *Gripp import* — en zegt het scherm er eerlijk bij dat de punten nagelopen moeten worden. Een scan zonder tekstlaag levert een duidelijke melding op in plaats van een lege lijst.
- **[FEATURE]** **Werkopdracht en werktekening als PDF toevoegen**, zowel bij het aanmaken als achteraf op een bestaande bon. De opslag ervoor bestond al sinds migratie 012 — besloten bucket, kolommen `opdracht_pad` en `tekening_pad`, en de knoppen op de bon — maar werd alleen gevuld door de ClickUp-synchronisatie. Een klus die met de hand werd aangemaakt kreeg ze dus nooit, en een tekening die later los kwam kon er niet meer bij zonder de bon opnieuw te maken.
- **[FEATURE]** Nieuwe edge function `opdracht-lezen`: één PDF erin, de punten eruit. Hij schrijft niets weg en gebruikt geen service-role — hij werkt met het token van de gebruiker, dus RLS geldt onverkort en wie geen werk mag beheren komt er niet voorbij de deur. De PDF-leeslaag zit daarmee op de server, niet in de bundel van een telefoon.
- **[FEATURE]** 9 tests erbij (`opdracht`), **143 in totaal**.
- Geen migratie nodig: bucket, kolommen en policies stonden er al.

## Meer beeld, minder losse getallen

- **[FEATURE]** Het dashboard heeft een **werkvoorraadbalk**: één gestapelde balk met daaronder per stand het aantal en het aandeel. Vijf getallen naast elkaar vertellen hoevéél er is maar niet hoe het staat — of de voorraad vooral uit wachtend werk bestaat of uit klussen die lopen, en hoe groot het rode stuk is.
- **[FEATURE]** En een **weekdoorkijk**: de komende zes werkdagen als staafjes, opgebouwd uit dezelfde standkleuren. Of morgen vol staat of leeg was de vraag waarvoor je anders naar de planning ging om te tellen. Aantikken opent de planning.
- **[FEATURE]** Op de planning krijgt elke dagkop een **werkvoorraadstreepje**: de vorm van die dag in één lijn, onder de telling. De kaarten eronder vertellen wélke klus wat is; de streep vertelt hoe de dag eruitziet.
- **[FEATURE]** Het scherm van de zwamsaneerder opent nu met één **dagkaart met een voortgangsring** in plaats van vier losse tegels. De ring lees je met een halve blik en een handschoen aan; de kleur zegt hoe het staat, het getal hoe ver. "Punten klaar 1/3" en "Voortgang 33%" stonden er bovendien allebei — hetzelfde ding twee keer.
- **[FIX]** Datzelfde percentage stond daarna nóg een keer in de kop van de werkbon eronder. Op Vandaag is dat blok nu weg; op `/werkbon/:id`, waar geen ring staat, blijft het.
- **[FEATURE]** "Mijn cijfers" was drie kale getallen met een streepje ertussen. Nu drie vakjes met een pictogram, die op een telefoon van 390 pixels niet meer uit elkaar vallen.
- **[FIX]** De kolom "Laatste update" in het projectoverzicht viel af op 1280 pixels, omdat de tabel daar maar tweederde van de breedte krijgt. Verschijnt nu pas vanaf een breder scherm.
- **[FIX]** Op een telefoon liep "Alle projecten →" het scherm uit doordat er twee knoppen naast de kop stonden.

## Dashboard, projecten, planning en de storingen

### Storingen zijn van de eigenaar
- **[FIX]** De crashes van de app stonden als kaart bovenaan het dashboard, boven het werk. Dat is de verkeerde volgorde: het dashboard gaat over klussen, en een uitvoerder die zijn week inplant heeft niets aan een stacktrace. Ze staan nu op een eigen pagina, `/storingen`, met een eigen lege staat en een foutstaat, en kijken veertien dagen terug in plaats van zeven.
- **[FIX]** En ze waren te breed zichtbaar. `fouten_select_kantoor` stond open voor alle vijf de kantoorrollen, terwijl er in staat wat er misging op het toestel van een collega — pad, browser en naam. **Migratie 030** vervangt die policy door `fouten_select_eigenaar` op de bestaande `public.is_eigenaar()`. Het slot zit nu op drie plekken: het menu toont de ingang niet, de route stuurt je weg, en de database geeft niets terug. Alleen die derde is beveiliging.

### Het dashboard zag een derde van het werk
- **[FIX]** De KPI's lazen `werkbonnen` met de datum van vandaag: vijf van de eenendertig bonnen, terwijl er veertien klussen daadwerkelijk lopen. Een klus die vorige week begon en volgende week doorloopt heeft `datum` in het verleden en viel er volledig buiten — en dat is nou juist de klus waar je iets van wilt weten. De tegels tellen nu de hele werkvoorraad.
- **[FEATURE]** Vijf tegels in de standen van de app: Ligt stil · Klaar om af te ronden · Bezig · Niet gestart · Uitgelopen. "Uitgelopen" is de opleverdatum die voorbij is terwijl de klus niet af is, en is aanklikbaar naar `/uitloop`.
- **[FIX]** De volgorde van het dashboard: eerst de cijfers, dan het projectoverzicht en de activiteit van vandaag, en pas onderaan de operationele meldingen. Die stonden bovenaan, wat las als een storingspagina met een dashboard eronder.
- **[FIX]** Élke KPI-tegel kwam omhoog bij hover, ook de tien die nergens heen gaan. Dat belooft dat er iets gebeurt als je klikt. Nu doet alleen de tegel die dat waarmaakt het nog.

### Eén woordenlijst, en sorteren op wat er van je gevraagd wordt
- **[FIX]** Het projectoverzicht op het dashboard had een eigen statuslijstje — "Gestart" waar de rest van de app "Bezig" zegt, en rood voor "achter" terwijl rood elders "ligt stil" betekent. De projectenpagina had er ook een, met "Loopt" en "Actief". Alles komt nu uit `lib/klusstand.ts`. "Achter op schema" is behouden maar staat náást de stand: het gaat over tempo, en een klus kan tegelijk bezig én achter zijn.
- **[FEATURE]** Eén sorteervolgorde (`STANDVOLGORDE`) op dashboard, projecten en planning: ligt stil → klaar om af te ronden → bezig → niet gestart → afgerond → opgeleverd, en binnen dezelfde stand de oudste eerst. De projectenpagina stond op "nieuwste datum eerst", waardoor een klus van volgende maand bóven een klus stond die vandaag stillag.
- **[FEATURE]** Het statusfilter op Projecten heeft dezelfde zes knoppen als Alle werkbonnen.
- De planning van de zwamsaneerder ("Mijn week") is bewust niet aangeraakt: die kijkt naar één dag met één of twee klussen en heeft aan sorteren niets.

### Planning
- **[FIX]** "Naar deze week" was grijze tekst tussen twee grijze pijlen — het las als een bijschrift, niet als een knop, terwijl het de meest gebruikte handeling op dat scherm is. Nu de bestaande `secondary`-knop met een terugpijl en het doelweeknummer erin: "Naar deze week (wk 33)".
- **[FEATURE]** Elke dagkop heeft een telling met een bolletje in de zwaarste stand van die dag. Je ziet bij het openslaan van de week in welke kolommen iets te doen is zonder één kaart te lezen.

## Het scherm van de man in het veld

- **[FIX]** In de hele werkdagflow was elke foto onzichtbaar. Op Vandaag stond bij een afvinkpunt een leeg cameravakje, terwijl datzelfde punt via "Werkbon openen" gewoon twee foto's liet zien. De oorzaak zat één regel diep: `useWerkbonnen()` haalde `taken(*)` op en `useWerkbon(id)` haalde `taken(*, fotos(*))` op. `TaakItem` doet `taak.fotos ?? []` en tekende zonder die relatie een leeg uploadvak — in alle drie de fasen van de werkdag: vóór het starten, tijdens het werk en na het stoppen.
- Opgelost zonder de overzichtslijst zwaarder te maken. Daar `fotos(*)` bij zetten betekent dertig bonnen inclusief elke foto op een telefoon in een kruipruimte, terwijl geen enkel overzichtsscherm die foto's tekent. Vandaag kiest nu eerst de bon van vandaag uit de lichte lijst en haalt daarná díé ene bon op met dezelfde hook die `/werkbon/:id` gebruikt: één rij extra, geen dertig.
- **[FIX]** Bijkomend: na een foto knippert Vandaag niet meer weg. Het scherm ververste zich met de lijst-refetch — die zet de laadstatus aan en gooit de hele pagina terug naar een spinner. Het gebruikt nu de stille ophaalronde die `/werkbon/:id` al had.

### Eén scherm voor één werkbon
- **[FIX]** Vandaag bouwde de checklist zelf op, `/werkbon/:id` deed hetzelfde werk in een nettere opbouw, en onderaan Vandaag stond een knop "Werkbon openen" die van de een naar de ander sprong. Woorden van de eigenaar: "ik doe werkdag starten, ik kom bij de werkbon, en daarna klik ik op werkbon openen en kom ik bij dezelfde werkbon maar dan werkt het iets mooier." Beide schermen tekenen nu hetzelfde blok — `Klusuitvoering` — in de opmaak van `/werkbon/:id`. De knop is weg.
- De route `/werkbon/:id` blijft: vanuit "Mijn bonnen" en "Mijn week" open je daarmee een bon die níét die van vandaag is. Wat daar ontbreekt is de werkdag — starten en stoppen hoort bij de dag, niet bij een bon van volgende week.
- **[FEATURE]** De werkdagknop staat nu in alle drie de fasen op dezelfde plek: een balk onderin, boven de navigatie. Starten stond halverwege de pagina, stoppen vastgezet onderin, hervatten weer bovenaan. Met dertig punten onder je duim is "waar stond die knop ook alweer" een echte vraag.
- **[FEATURE]** Een werkbon afronden kan nu ook vanaf Vandaag. Dat zat alleen op het andere scherm, dus de laatste handeling van de klus was precies de handeling waarvoor je moest doorklikken.
- **[FIX]** De schil van Vandaag was een component-in-een-component. Die krijgt bij elke hertekening een nieuwe identiteit, waarna React de hele inhoud opnieuw ophangt: elk afvinkpunt vroeg zijn ondertekende fotolinks dan opnieuw op en de miniaturen knipperden terug naar een grijs vakje.
- **[FIX]** Het bijschrift bij "Uit te voeren punten" stond ernáást en duwde de kop op een telefoon van 390 pixels over drie regels uiteen. Staat nu eronder.

### "Klaar om af te ronden" is een eigen stand

- **[FEATURE]** Een bon waar de ploeg alles had afgevinkt maar die nog niet was afgerond, heette "Bezig" op 100% — een tegenspraak, en groen zou te vroeg zijn geweest want er moet nog iemand op afronden drukken voordat kantoor kan opleveren. Dat is nu een eigen stand tussen bezig en afgerond in: **Klaar om af te ronden**, in violet.
- Violet is een bewuste omweg. Amber zou de gewone keuze zijn voor "hier moet iemand iets doen", maar geel is merkkleur. Turkoois stond er eerst en lag te dicht bij groen: in donkere modus was een klus die wacht niet te onderscheiden van een klus die klaar is, en juist dat verschil is de hele reden dat deze stand bestaat.
- Zichtbaar op alle schermen die de kleurtaal gebruiken, met een eigen filterknop op Alle werkbonnen: dat is de wachtrij van kantoor.
- Een bon zonder punten telt niet mee — nul van nul is geen voltooide klus maar een verse bon waarvan de werkopdracht nog niet is ontleed.
- **[FEATURE]** 2 tests erbij, **136 in totaal**.

### De statusknoppen op de werkbon

- **[FIX]** Op de werkbon stonden drie knopjes — Open, Bezig, Voltooid — waarmee kantoor de kolom met de hand zette. "Bezig" schreef een waarde die niets in de app las en die niemand ooit zette. Nu de stand uit de afgevinkte punten komt, was dat een keuze zonder gevolg. Er staat nu één handeling, passend bij het moment: **Werkbon afronden** als alles is afgevinkt, **Heropenen** als de bon al op afgerond staat, en anders de reden waarom afronden nog niet kan ("nog 16 van de 23 punten open"). Dat is wat de database toch al afdwong — je hoorde het alleen pas ná het klikken.
- **[FIX]** Een opgeleverde bon bood nog steeds "Heropenen" aan, met eronder de tekst "kan zolang hij nog niet is opgeleverd" — terwijl er direct naast "Opgeleverd en bevestigd" stond. Opgeleverd is een dichtgeklapt dossier: de klant heeft bericht, ClickUp staat op opgeleverd en de foto's zijn onderweg. Die knop is weg.
- **[FIX]** De filterknoppen op Alle werkbonnen waren Alle · Open · Bezig · Voltooid en lazen dezelfde dode kolom: twee van de vier gaven altijd nul resultaten. Het zijn nu Alle · Niet gestart · Bezig · Afgerond · Ligt stil — dezelfde vijf woorden en kleuren als op de kaarten eronder, en ze werken alle vijf. "Afgerond" vangt ook het opgeleverde werk.
- De kolom zelf blijft ongemoeid: `'open' | 'bezig' | 'voltooid'` staat nog in de database en in het type, en `klusstand()` accepteert `'bezig'` nog steeds als de waarde er ooit toch in komt. Geen migratie.

### Eén kleurtaal, op alle schermen

- **[FIX]** De grootste vondst zit onder de kleur: **niets zet ooit `werkbonnen.status` op `'bezig'`.** De ClickUp-synchronisatie raakt die kolom niet aan en de handmatige knop op de werkbon gebruikt niemand. Alle dertig bonnen stonden op `'open'` — óók Gaaspstraat 46 met zeven afgevinkte punten en elf foto's. Elk scherm noemde dat "nog niet gestart", en blauw kwam nergens voor. De stand komt nu uit de feiten: een afgevinkt punt is bewijs dat iemand daar geweest is.
- **[FEATURE]** `src/lib/klusstand.ts` is de enige bron voor "hoe staat deze klus ervoor" en "welke kleur is dat". Zeven schermen beantwoordden dat zelf: een klus die liep was blauw op de planning, amber op de werkbon en geel op Mijn bonnen, en de rand van een werkbonkaart was geel voor open, bezig én afgerond — en zei daarmee niets.
- De taal: **grijs** nog niet gestart · **blauw** bezig · **groen** afgerond en opgeleverd · **rood** ligt stil. Geel doet niet mee aan status: dat blijft het merk — knoppen, vandaag, voortgangsbalken, de kickerbalk. Elke stand heeft ook een woord, want kleur alleen is nooit genoeg in fel zonlicht.
- Doorgevoerd op: weekplanning, Alle werkbonnen, Mijn bonnen, Mijn week, Afgerond, Archief, Rapporten, de werkbon van kantoor en die van de ploeg. De lijstkaarten krijgen ook een zachte tint in de kleur van hun stand; één schakelaar (`KLEURWAS` in `klusstand.ts`) zet dat terug naar alleen rand en badge.
- **[FIX]** `groepsstatus()` in `klusgroepen.ts` leunde op diezelfde dode kolom: een projectgroep waar werk in zat heette "niet gestart".
- **[FIX]** Op Mijn week liep het woord "vandaag" over de kop van donderdag heen, en stond "Ligt stil" twee keer in hetzelfde kaartje.
- **[FEATURE]** 11 tests erbij (`klusstand`), **134 in totaal**.

### Kleur op de weekplanning
- **[FEATURE]** Een klus in de planning kreeg zijn status alleen mee als randje van drie pixels en een bolletje. Het hele kaartje draagt nu die kleur: blauw voor bezig, groen voor afgerond, rood voor stilgelegd. Van een meter afstand zie je welke kolom loopt en welke stilligt zonder één woord te lezen.
- Wat nog niet begonnen is blijft bewust neutraal. Anders krijgt een week vol werk dat nog moet starten de meeste kleur van allemaal, en dat is precies verkeerd om.
- **[FIX]** De dagkop stond in hetzelfde wit als de inhoud eronder en las daardoor niet als kop. Die heeft nu een eigen tint (`surface-2` / `surface-dark-3`).
- **[FEATURE]** Vandaag licht op als hele kolom — gele rand rondom in plaats van alleen een gele hoed bovenop.
- **[FEATURE]** Zaterdag heeft een eigen tint. Hij hoort in de planning — er wordt afgemaakt en garantiewerk gedaan — maar het is geen dag als de andere vijf, en een volle zaterdag zegt iets anders dan een volle dinsdag. Leisteen, geen nieuwe felle kleur: blauw, groen en rood zijn vergeven aan de status van een klus en geel is vandaag. Is het zaterdag én vandaag, dan wint vandaag.

### Het laatste draadje van de projecten
- **[FIX]** `usePlanning()` joinde nog `project:projecten` en vulde daarmee `PlanningItem.projectId` en `projectnaam`. Die join gaf bij elke rij een leeg project terug — nul rijen in de tabel, nul van de dertig werkbonnen met een `project_id` — en `projectId` werd sinds de opruiming hierboven door niemand meer gelezen. Join en velden zijn weg.

### De projectdetailpagina is weg
- **[FIX]** `/projecten/:id` was een dode route. Sinds de projectenpagina op klusgroepen is herbouwd wees er niets meer naartoe, en de pagina las nog de tabel `projecten` — nul rijen, en van de dertig werkbonnen heeft er nul een `project_id`. Wie de URL intypte kreeg "Project niet gevonden"; nu stuurt de app je terug naar je eigen startscherm.
- Het tabblad "Foto's" op die pagina tekende nepvakjes: `n` identieke gele blokjes met een fototeken, met een handje-cursor die nergens heen ging.
- Weg: de pagina (326 regels), de route, en uit `useProjecten.ts` de hooks `useProjecten()`, `useProject()` en `useMedewerkers()` plus het bijbehorende select en mapwerk (±180 regels). Het type `Project` in `types/index.ts` las daarna niemand meer.
- Blijft: `/projecten` zelf, de weekplanning (`usePlanning`) en de statushelpers die de projectenlijst gebruikt. `ProjectStatus` blijft ook — die hoort bij een groep klussen met hetzelfde opdrachtnummer.
- De tabel `projecten` is niet aangeraakt. Geen migratie.

### De andere schermen nagelopen
- **[FEATURE]** De tegels op Vandaag — punten klaar, foto's, voortgang, gewerkte tijd — staan nu bovenaan, direct onder de groet. Ze stonden onder de checklist, dus je moest twintig afvinkpunten langsscrollen voor het antwoord op "hoe sta ik ervoor".
- **[FIX]** Dezelfde ontbrekende relatie stond ook op vier andere plekken een nul te tonen: "0 foto's" op Mijn bonnen en Rapporten, en op de werkbonkaart (Alle werkbonnen, Afgerond) verscheen de fototeller helemaal niet, want die toont zichzelf alleen bij meer dan nul. Rapporten zette die nul ook in de Excel-export. De overzichtslijst haalt nu per foto het **id** op — genoeg om te tellen, en een fractie van een volle rij. Miniaturen komen nog steeds uit `useWerkbon`.
- **[FIX]** "Verderop ingepland" op Mijn week toonde een kale datum uit de database (`2026-08-17`) in plaats van "17 aug 2026".
- **[FIX]** De uitleg onder Rapporten klopte niet meer: die zei dat er geen scherm is waar iemand de rapportvelden invult. Dat scherm staat er sinds de vorige ronde op de werkbon zelf.

### Klaar voor de opruiming van de fotobucket
- **[FEATURE]** Migratie 027 haalt het bestand uit de bucket zodra ClickUp de foto heeft en de klus veertien dagen geleden is opgeleverd. De rij in `fotos` blijft staan met `opgeruimd_op` gevuld. Een ondertekende link levert dan niets meer op, en dat was in de schermen niet te onderscheiden van een foto die nog laadt — een grijs vakje, voor altijd. Zulke foto's krijgen nu hun eigen vakje: "bij ClickUp", met de volledige uitleg als je hem opent.
- Die paden gaan ook niet meer mee naar de ondertekening. Dat scheelt een ronde naar de server voor een antwoord dat toch leeg is.
- **[FIX]** In het archief verdween een opgeruimde foto stilzwijgend uit de strook terwijl de kop er wél bij telde: vier foto's beloofd, twee te zien. Juist daar telt het, want het archief gáát over oud werk en oud werk is precies wat opgeruimd wordt.
- Speelt pas veertien dagen na de eerste oplevering. Er is nog niets opgeruimd, dus dit is voorbereiding — niet een fout die iemand al gezien heeft.

---

## De eerste echte foto's — twee fouten die dat blootlegde

De eerste twee foto's ooit zijn gemaakt op Bentinckstraat 63. Ze kwamen
correct in de database en in de bucket terecht; wat eromheen zat klopte niet.

- **[FIX]** Een foto was nooit te zíén. Onder een afvinkpunt stond een geel vakje met een fototeken erin — niet de foto zelf. De enige manier om te controleren of de opname goed was, was hem in een nieuw tabblad openen met een ondertekende link: op een werktelefoon een tabwissel, en soms een geblokkeerd venster. Er staan nu echte miniaturen, en aantikken opent de foto op volle grootte in de app zelf, met pijltjes als er meer zijn.
- **[FIX]** Elke foto en elk vinkje leek het scherm te verversen. `useWerkbon.refetch()` zette de laadstatus aan, waarna de hele pagina werd vervangen door een spinner en bovenaan terugkwam — je verloor je plek in een lijst van vijftien punten, elke keer opnieuw. Alleen de eerste keer weet je nog niets; daarna blijft het scherm staan terwijl de nieuwe gegevens onderweg zijn.
- **[FIX]** Kantoor kon de fotorapportage helemaal niet zien. De fotostrook zat achter de `readOnly`-voorwaarde, en die betekende daarmee "niet te zien" in plaats van "niet te wijzigen". Op de werkbon van kantoor was elke foto onzichtbaar, en na het afronden voor de ploeg ook.
- **[FIX]** Een mislukte ophaalronde was volledig stil: het scherm hield de oude gegevens vast en niemand kreeg iets te zien. Er staat nu een melding dat wat je ziet verouderd kan zijn.
- **[FIX]** Ondertekende links worden in één aanroep opgehaald voor alle foto's van een punt in plaats van één voor één.

---

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

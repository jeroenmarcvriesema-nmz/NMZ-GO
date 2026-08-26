# De afstandsmeting bij aanmelden — wat er is gebouwd en wat er nog moet

Dit document hoort bij migratie 040 en 041. Het legt vast wat het
systeem doet met de locatie van een medewerker, zodat dat te
verantwoorden is als er ooit naar gevraagd wordt.

**Dit is geen juridisch advies.** Het is de technische onderbouwing plus
een lijst met wat er buiten de software om geregeld moet worden. Laat
het onderste deel toetsen door iemand die daar wél voor is opgeleid.

## Wat het systeem doet

Bij het aanmelden op een klus vraagt de app eenmalig de positie van het
toestel op. De database rekent uit hoe ver dat van het werkadres ligt,
**wist daarna de coördinaat**, en bewaart alleen de afstand in meters
plus de nauwkeurigheid die de telefoon zelf meldde.

- Er wordt **niet** gevolgd tijdens de dag. Eén meting, bij het
  aanmelden, en verder niets.
- Er wordt **niets geblokkeerd**. Aanmelden lukt altijd, ook zonder
  toestemming, zonder signaal of ver van de klus.
- De coördinaat wordt **niet bewaard**. Wat overblijft is "op 240 m,
  telefoon zei ±15 m". Er is dus geen plaatsbepaling om terug te kijken.
- Kantoor krijgt een melding bij meer dan honderd meter, met de
  onnauwkeurigheid van de telefoon eraf getrokken.
- Alles wordt na **negentig dagen** gewist, inclusief de meldingen —
  want "op 240 m van de Bonairestraat" is dezelfde plaatsbepaling, maar
  dan in een zin.

## Waarom het zo is gebouwd

| Beginsel | Hoe het hier is ingevuld |
|---|---|
| Doelbinding | Eén doel: weten of iemand op de klus was bij het aanmelden. Nergens anders voor gebruikt. |
| Dataminimalisatie | Alleen de afstand blijft over. De coördinaat wordt in dezelfde bewerking gewist. |
| Opslagbeperking | Negentig dagen, automatisch opgeruimd (`locaties_opruimen`). |
| Proportionaliteit | Eén meting op een zelfgekozen moment, in plaats van volgen. Geen blokkade. |
| Transparantie | De medewerker ziet vóór het aanmelden waarvoor de locatie wordt gebruikt. |
| Integriteit | De afstand wordt serverkant berekend, niet door het toestel aangeleverd. |

## Wat er buiten de software om nog moet gebeuren

Dit is het deel dat techniek niet kan afdekken. Zonder dit is de
functie niet te verantwoorden, hoe netjes de tabel ook is.

1. **Grondslag vastleggen.** Toestemming van een werknemer geldt in een
   gezagsverhouding doorgaans niet als vrij gegeven. De route is een
   gerechtvaardigd belang, en dat vraagt om een afweging die je
   opschrijft: welk belang, waarom is dit noodzakelijk, en waarom weegt
   het op tegen de privacy van de medewerker. Die afweging hoort op
   papier te staan vóórdat de functie aanstaat.

2. **Instemming van de personeelsvertegenwoordiging.** Een regeling voor
   het waarnemen van personeel is instemmingsplichtig. Is er een OR of
   PVT, leg het daar voor. Is die er niet, leg dan vast dat en hoe het
   personeel is geïnformeerd en gehoord.

3. **Opnemen in het personeelsreglement**, met minimaal: wat er gemeten
   wordt, waarom, wie het ziet, hoe lang het bewaard blijft, en wat er
   gebeurt als iemand ver weg blijkt te zijn aangemeld.

4. **Inzagerecht.** Een medewerker heeft recht op zijn eigen gegevens.
   Dat de ploeg de afstand niet in de app ziet is een keuze over het
   scherm en niet over het recht: vraagt Mario ernaar, dan krijgt hij
   het. Spreek af wie die vraag behandelt.

5. **Verwerkingsregister.** Deze verwerking hoort erin, met doel,
   grondslag, categorieën en bewaartermijn.

6. **DPIA.** Stelselmatige waarneming van werknemers valt al snel onder
   de gevallen waarvoor een gegevensbeschermingseffectbeoordeling nodig
   is. Deze verwerking is bewust klein gehouden, maar laat toetsen of
   dat genoeg is.

7. **Afspreken wat je met een melding doet.** Een signaal zonder
   afgesproken gevolg wordt vanzelf een dossier. Leg vast dat een
   afwijking aanleiding is voor een gesprek, en niet meer dan dat.

## Wat bewust níet is gebouwd

- **Geen blokkade op honderd meter.** GPS haalt die nauwkeurigheid niet
  tussen hoge gevels, en sommige adressen in dit bestand zijn een reeks
  ("Rembrandstraat 79 t/m 129") die naar het midden van een straat
  geocodeert. Een harde grens houdt dan mensen tegen die op de goede
  plek staan.
- **Geen melding als iemand geen locatie deelt.** Wie zijn toestemming
  intrekt hoort daar geen signaal over te veroorzaken; dan is het geen
  recht meer maar een knop met gevolgen.

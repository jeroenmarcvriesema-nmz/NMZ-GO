---
name: verwerker-uitrollen
description: De edge function `verwerker` van NMZ GO veilig uitrollen naar Supabase — alle bronbestanden in één keer, daarna teruglezen en de eerste ronde controleren. Gebruik dit altijd wanneer er iets is gewijzigd in supabase/functions/verwerker/, en ook wanneer je vermoedt dat de uitgerolde versie achterloopt op de repo.
---

# De verwerker uitrollen

De `verwerker` is de motor achter de ClickUp-koppeling: hij trekt de verwerkingswachtrij leeg, haalt klussen binnen, leest werkopdrachten uit, schrijft status en ploeg terug en ruimt foto's op. Hij draait elke minuut via pg_cron. Ligt hij plat, dan stopt de synchronisatie zonder dat iemand het meteen ziet.

## De ene regel die er echt toe doet

**Rol álle bestanden in één `deploy_edge_function`-aanroep uit. Nooit één bestand.**

Een halve uitrol heeft de verwerker eerder plat gelegd. De bestanden importeren elkaar; rol je er één uit, dan draait die tegen de oude versie van de rest, en dat faalt op een manier die niet meteen zichtbaar is.

Op dit moment zijn dat deze bronbestanden:

```
supabase/functions/verwerker/index.ts
supabase/functions/verwerker/clickup.ts
supabase/functions/verwerker/ontleden.ts
supabase/functions/verwerker/opruimen.ts
supabase/functions/verwerker/register.ts
supabase/functions/verwerker/statusregels.ts
supabase/functions/verwerker/werkopdracht.ts
```

**Controleer die lijst altijd zelf** met `ls supabase/functions/verwerker/` voordat je uitrolt — er kunnen bestanden bij zijn gekomen sinds dit werd geschreven. Neem alles mee wat de functie importeert.

`werkopdracht_parser_proef.py` hoort **niet** mee: dat is een los proefscript, geen onderdeel van de functie.

## Vooraf

1. **Kijk wat er draait.** Lees de uitgerolde versie terug (`get_edge_function`) en vergelijk met de repo. Het is al voorgekomen dat productie achterliep en daardoor iets onjuists meldde aan de klant — migratie 029 was toegepast, maar de functie beloofde nog een verschoven opleverdatum.
2. **Vraag toestemming.** Dit raakt een draaiende productiekoppeling met echte klussen erin.
3. **`git pull` eerst**, zeker als er meerdere sessies lopen.

## Uitrollen

Eén aanroep, alle bestanden. Daarna:

1. **Lees terug** wat er nu draait en controleer dat het overeenkomt met de repo. Niet aannemen dat de uitrol geslaagd is omdat er geen fout kwam.
2. **Wacht één ronde af** (hij draait elke minuut) en bekijk het resultaat in `verwerkingsronden`. Een geslaagde ronde ziet er ongeveer zo uit: aantal taken gezien, aantal verwerkt, nul mislukt.
3. **Kijk naar `overgeslagen`.** Daar horen alleen bekende gevallen in te staan — opdrachten die van het sjabloon afwijken, een stukke PDF, een taak zonder bijlage. Staat er ineens iets nieuws in, dan heeft de uitrol iets gebroken.

## Als er iets misgaat

- Gebruik `clickup.tekstproef` om te zien wat de parser precies uit een werkopdracht leest. Daar is die taaksoort voor.
- Een taak die op onverwerkbaar staat, bied je opnieuw aan met `taak_opnieuw()`. Doe dat pas als de oorzaak weg is, anders vervuil je de wachtrij.
- De vier cron-jobs staan in `cron.job`: `nmzgo-verwerker` (elke minuut), `nmzgo-clickup-hartslag` (elke 5 min, 04–19 UTC), `nmzgo-werkdagen-afsluiten` (elk uur op :05) en `nmzgo-fotos-opruimen` (dagelijks 03:15 UTC). Draait er niets, controleer daar eerst.

## Dingen die je moet weten voordat je hier iets wijzigt

- **Ploeg die vanuit NMZ GO wordt gezet, krijgt `handmatig = true`.** `zetPloeg` wist elke ronde iedereen die dat niet is. Zet je het op `false`, dan is de keuze binnen vijf minuten weg.
- **Datums na de eerste import komen niet meer uit ClickUp.** De ronde slaat een bon met `opdracht_pad` over, dus er is geen strijd om die velden.
- **Datums gaan als middernacht UTC naar ClickUp** (`naarMs`), de omkering van `datum()` die met `toISOString()` leest. In een Nederlandse werkruimte toont ClickUp dat als 02:00 dezelfde dag. Gaat het bedrijf ooit in een tijdzone vóór UTC werken, dan valt die tijdstempel op de vorige dag — dán moet dit mee.
- **Twee modules zijn gedeeld:** `ontleden.ts` (werkopdracht uitlezen) en `register.ts` (personenregister). Maak daar nooit een tweede kopie van in een andere functie — dan hangt de uitkomst af van welke weg iets toevallig neemt.

## Afronden

- `npm test` — de parser en de statusregels zijn getest; die tests horen bij fouten die echt zijn voorgekomen.
- `CHANGELOG.md` bijwerken.
- Noteer in `.ai/HANDOVER.md` hoofdstuk 0 welke versie er nu draait en wat erin zit — **door dat hoofdstuk te herschrijven, niet door er een nieuw hoofdstuk onder te hangen.**

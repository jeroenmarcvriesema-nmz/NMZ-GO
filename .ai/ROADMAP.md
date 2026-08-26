# ROADMAP.md — Toekomstvisie en bekende aandachtspunten

Dingen die bewust **nog niet** gebouwd zijn, maar wel op de horizon staan. Bouw deze niet ongevraagd — houd er wel rekening mee bij architecturale keuzes, zodat ze later zonder grote herbouw toegevoegd kunnen worden.

*Bijgewerkt 14 augustus 2026. Alles hieronder is geverifieerd tegen de codebase en de database, niet overgenomen uit een eerdere versie van dit document.*

## Geplande uitbreidingen

- **PDF-generatie van het opleverrapport.** Nog steeds niet gebouwd, en inmiddels het enige gat in een verder complete keten: de aanvraagknop staat live, `rapportage_aanvragen()` maakt de rij en zet een wachtrijtaak `rapportage.genereren` klaar, maar die taaksoort heeft geen handler. De verwerker zet zo'n taak één keer op onverwerkbaar en laat hem verder met rust. Zodra de generatie er is, moeten de blijven liggen aanvragen opnieuw worden aangeboden met `taak_opnieuw()`. De architecturale keuze is inmiddels gemaakt en al deels bewezen: dit hoort in de edge-functionlaag, niet client-side — de PDF-leeslaag (`unpdf`) staat daar al.
- **ClickUp-attachmentupload (`clickup.fotos_uploaden`).** De foto's van een opgeleverde klus als bijlage naar de gekoppelde ClickUp-taak. Bestaat nog niet als handler; de kolommen (`fotos.clickup_geupload_op`, `fotos.clickup_attachment_id`) staan er al klaar. Dit is de voorwaarde voor het opruimen hieronder.
- **Foto's opruimen na oplevering.** De cron (`nmzgo-fotos-opruimen`) en de handler `onderhoud.fotos_opruimen` draaien, maar mogen pas echt wissen als het uploadstempel gevuld is. Zonder dat stempel gooi je bewijs weg dat nergens anders staat.
- **Signed URLs voor foto-opslag**, ter vervanging van de huidige public `werkbon-fotos`-bucket, zodra privacy/beveiliging van foto's zwaarder gaat wegen.
- **E-mailbevestiging bij registratie** heroverwegen naarmate de gebruikersgroep groeit (momenteel uitgeschakeld; accounts ontstaan via de uitnodigingsflow).

## Bekende aandachtspunten (huidige stand)

- **Nog nooit een klus opgeleverd.** 0 van de 46 werkbonnen. Alles vóór die knop is inmiddels in het veld bewezen — 67 foto's van vier monteurs — maar alles eráchter (attachmentupload, statusterugkoppeling naar ClickUp, opruimen, opleverrapport) is nog nooit echt gelopen. Dat is op dit moment het grootste onbewezen stuk van de app.
- **`postcode`, `plaats` en `opdrachtnummer` zijn overal leeg** (0 van de 46 bonnen). Zoeken kijkt er wél in maar vindt er niets; het adresveld bevat de plaats meestal wel. Belangrijker: het opdrachtnummer is de enige sleutel die een klus in NMZ GO aan dezelfde klus in ClickUp en in Gripp zou kunnen knopen. Zolang het leeg is, is uitvoering niet aan omzet te koppelen. De ClickUp-parser moet die velden gaan vullen.
- **De werktekening komt bijna nooit mee.** Hij wordt alleen gezocht in velden waarvan de náám "tekening" bevat; hangt hij in het werkopdrachtveld of los aan de taak, dan blijft hij liggen. `TEKENING_BESTAND` in `clickup.ts` staat klaar; er ontbreekt een fallback zoals `opdrachtUitBijlagen` die voor de opdracht doet. Voor de man in de kruipruimte is dat een echt gemis — de opdracht verwijst ernaar ("groen = bovenaf, beige = onderaf").
- **Foto storage:** de bucket `werkbon-fotos` is public voor directe URL's. Omzetten naar signed URLs is een aparte, bewuste stap (zie hierboven).
- **Weesbestanden:** een foto verwijderen haalt de databaserij weg maar laat het bestand in Storage staan. Hoort bij het opruimen hierboven.
- **Dubbele migratienummers.** `030` en `031` bestaan allebei twee keer, doordat twee sessies tegelijk een nummer pakten. De inhoud is verschillend en alle vier zijn ze toegepast, dus dit is geen fout in de database — maar het maakt de map misleidend en het is al eens eerder gebeurd (bij 027). Zie `GIT_WORKFLOW.md` → Migratienummers voor de afspraak die dit hoort te voorkomen.
- **Eigen SMTP en lekwachtwoord-controle** staan nog open. Dat laatste is een vinkje in het Supabase-dashboard, geen code.

## Afgerond — stond hier eerder als toekomstplan

Deze punten stonden lang op deze lijst en zijn inmiddels gebouwd. Ze staan hier zodat een volgende sessie ze niet opnieuw als openstaand leest:

- **Geautomatiseerde tests.** Een Vitest-suite onder `tests/`, die bij elke push door de CI wordt gedraaid. Zie `TESTING.md`.
- **Dark mode.** Volledig uitgerold: `themeStore` met opgeslagen voorkeur, `class`-strategie, no-flash-script in `index.html`, toggle in `Sidebar` en `Topbar`. Light is het standaardthema.
- **Serverlaag.** Drie edge functions plus een verwerkingswachtrij in Postgres, aangedreven door vier pg_cron-jobs. De architectuur is daarmee niet langer client-only; zie `ARCHITECTURE.md`.

## Groeiprincipe

Groei blijft bewust beheerst. Bij twijfel of iets een architecturale uitbreiding rechtvaardigt (nieuwe backend-laag, nieuwe grote dependency, nieuwe globale state), is het antwoord: bespreek het eerst met de gebruiker, bouw het niet stilzwijgend als bijproduct van een kleinere taak. Zie `CLAUDE.md` → Projectvisie en Verboden acties.

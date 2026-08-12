# HANDOVER.md — Overdracht tussen sessies

**Doel van dit document:** een volgende sessie moet dit project kunnen overnemen **zonder enig contextverlies**. Geen enkel feit hieronder is aangenomen; alles is geverifieerd tegen de daadwerkelijke codebase, database, git-historie en documentatie.

Lees hoofdstuk 0 als eerste — dat is de actuele stand. De hoofdstukken daarna beschrijven de architectuur, de visie van de eigenaar en de geschiedenis; die blijven geldig, maar zijn geschreven vóór Epic 4.

---

# 0. Actuele stand — augustus 2026

## LEES DIT EERST — waar je begint

De opdracht voor de volgende sessie is: **de ClickUp-fotosynchronisatie**.

De eigenaar wil deze keten, in deze volgorde:

```
foto's staan in NMZ GO
  -> foto's gaan als attachment naar de gekoppelde ClickUp-taak
  -> klus wordt opgeleverd in NMZ GO
  -> status in ClickUp gaat naar "opgeleverd"
  -> pas daarna mag de bucket opgeruimd worden
```

Het punt van die laatste stap: als ClickUp de foto's heeft, is Supabase
Storage nog maar een doorgeefluik en hoeven ze daar geen maanden te
blijven staan.

**Concreet te bouwen, in volgorde:**

1. **`clickup.fotos_uploaden`** als nieuwe wachtrijtaak in
   `supabase/functions/verwerker/`. Haalt de foto's uit de bucket
   `werkbon-fotos` en zet ze via `POST /task/{id}/attachment`
   (multipart) op de ClickUp-taak. Per foto een stempel wegschrijven,
   zodat een tweede ronde niets dubbel doet — dezelfde aanpak als
   `rapportages.clickup_geupload_op`.
2. **Koppelen aan opleveren.** `werkbon_opleveren()` zet nu al een
   `clickup.status_bijwerken`-taak klaar. De foto-upload moet dáárvóór,
   zodat de bijlagen er staan op het moment dat de status springt.
3. **Pas daarna opruimen.** Alleen wissen als het uploadstempel gevuld
   is, en met een wachttijd van een week of twee. Zonder dat stempel
   gooi je bewijs weg dat nergens anders staat.
4. **Dan pas de PDF-generatie** van het opleverrapport, want die leest
   dezelfde foto's.

**Waarschuwing uit ervaring:** de Edge Function moet in zijn geheel
opnieuw worden uitgerold — alle vijf bestanden in één
`deploy_edge_function`-aanroep. Eén keer half uitrollen heeft de
verwerker plat gelegd. Rol nooit één bestand uit.

### Twee sessies naast elkaar — wie waar aan zit

Deze opdracht loopt in een eigen sessie, naast de sessie die de
schermen doet. Dat kan zolang jullie niet in dezelfde bestanden
schrijven; git voegt dat niet netjes samen.

| Sessie | Werkt in |
|---|---|
| ClickUp-fotoketen | `supabase/functions/verwerker/`, nieuwe migraties |
| Schermen | `src/`, `tests/` |

Afspraken die daarbij horen:

- **Eerst `git pull`, elke keer.** Beide sessies duwen naar `main`.
- **Migratienummers.** Tot en met 025 is gebruikt. De fotoketen neemt
  **026**. Zit je in de andere sessie en heb je ook een migratie nodig,
  pak dan 027 en hoger — nooit een nummer hergebruiken.
- **`clickup.ts` is gewijzigd zonder uitrol.** De opmerking bij
  `stilgelegd` noemde een "Nieuwe opleverdatum". Die bestaat niet meer
  (zie migratie 027) en de regel is aangepast in de broncode, maar
  **niet uitgerold** — jij bent degene die die functie uitrolt, en een
  halve uitrol heeft de verwerker eerder plat gelegd. Neem deze
  wijziging mee in jouw eerstvolgende `deploy_edge_function`, met alle
  vijf bestanden.
- **Migratie 027 bestaat al** (`werkbon_stilleggen` schuift de planning
  niet meer op). 026 is nog vrij en blijft voor jou; pak anders 028.
- **De aanvraagknop van het opleverrapport staat al live.** Wie erop
  drukt maakt een rij in `rapportages` én een wachtrijtaak
  `rapportage.genereren`. Die taaksoort heeft nog geen handler, dus de
  verwerker zet hem één keer op onverwerkbaar en laat hem verder met
  rust — geen vervuilde wachtrij, maar de aanvraag blijft wel liggen.
  Zodra de PDF-generatie er is, moet je de blijven liggen aanvragen
  opnieuw aanbieden met `taak_opnieuw()`.

---

## Wat er sinds de audit is gebouwd

**Beveiliging.** Het RPC-oppervlak is van dertien anon-aanroepbare
functies terug naar drie (`get_mijn_rol`, `get_mijn_tenant`,
`uitnodiging_controleren` — die drie zijn er met reden). `tenants` heeft
een expliciete leespolicy. `taak_opnieuw()` toetste nog op de rolnáám
"beheerder" en sloot de eigenaar buiten; `clickup_hartslag()` stond open
voor elke ingelogde gebruiker. Beide toetsen nu op bevoegdheid.

**Een bug die de sync stilhield.** `werkbonnen_bonnummer_key` liet twee
ClickUp-taken elke ronde afvallen. Het bonnummer komt uit het
opdrachtnummer en dat hoort bij de ópdracht, niet bij de klus.
Constraint eruit (migratie 022). Resultaat: 28 -> 30 werkbonnen,
378 -> 405 punten, overgeslagen van 7 naar 5 — en die vijf zijn echte
gaten in de brongegevens.

**Tests.** Vitest, 93 tests, `npm test`. Parser, planningsrekenwerk,
statusregels, ClickUp-link, CSV-export, rollen, foutfilter. Elke test
hoort bij een fout die daadwerkelijk is voorgekomen. CI draait
typecheck, tests en build bij elke push. Let op: `npm run build`
typecheckt bewust alleen `src/`; `npm run controle` en de CI doen ook
`tests/`. Een fout in een test hoort geen uitrol tegen te houden.

**Foutmonitoring.** Een `fouten`-tabel, een `Foutvanger` rond de app, en
een filter (`lib/foutfilter.ts`) dat rommel van browserextensies buiten
de storingenlijst houdt. Zichtbaar op het dashboard, maar alleen als er
iets is.

**Nieuwe schermen.** `/archief` (terugzoeken op adres met foto's),
`/uitloop` (wat staat over de planning heen en waarom),
`/medewerkers/:id` (dossier per man met cijfers, en rol wijzigen /
wachtwoord resetten / op non-actief zetten).

**Weekbeeld.** Eén `Weekkiezer` met weeknummer op planning, werkbonnen
en mijn week. Een klus die meerdere weken duurt staat in élke week
waarin hij loopt, met "loopt door" erbij. `maandagVanWerkweek()` rolt op
zondag door naar de komende maandag — zonder dat opende de planning in
het weekend op de week die net voorbij was.

**Zaterdag** is een volwaardige werkdag: `WERKDAGEN = 6`. Zondag niet.

**Planner** is de zesde rol (migratie 024), met dezelfde bevoegdheden als
uitvoerder en werkvoorbereider. Dat dit één migratie was en niet
zevenenveertig, is precies waarom de policies op bevoegdheid toetsen en
niet op rolnaam.

**Navigatie op een telefoon:** tabbalk onderin plus een "Meer"-blad.
Bewust geen hamburgermenu — dat verstopt alles achter één knop en kost
twee tikken voor werk dat je twintig keer per dag doet.

**Opleverrapportage — fundament** (migratie 025). De twee regels staan
in de database, niet in de knop: uitvoerder of hoger, én minstens één
foto. Er is bewust géén insert-policy op `rapportages`; aanmaken kan
alleen via `rapportage_aanvragen()`. Geverifieerd met een rollentest:
zwamsaneerder -> 42501, kantoor zonder foto -> 23514, directe insert ->
42501.

## Het opleverrapport — structuur uit het echte document

Uitgelezen uit `Opleverrapport Scheibeekstraat 9 te Assendelft` (5
pagina's):

1. **Titelblad** — "OPLEVERRAPPORT ALGEMEEN", adres, datum, opgemaakt door
2. **Projectgegevens** — opdrachtgever, vaste juridische alinea,
   projectnummer, werkadres met postcode, opleverdatum, opmerkingen
   bewoners, vaste alinea over uitgevoerde werkzaamheden, extra
   werkzaamheden, kwaliteitschecklist, opmerkingen/bijzonderheden
3. **"Fotorapportage"** als sectiekop, daarna de foto's

**Beslissingen van de eigenaar hierover:**
- De kwaliteitschecklist (zes vaste punten) **hoeft niet**.
- Drie tekstvelden volstaan: opmerkingen, bijzonderheden, extra
  uitgevoerde werkzaamheden.
- Het projectnummer ("C515") is een handmatig veld voor grote projecten;
  bij losse klussen blijft het leeg en staat alleen het adres op het
  rapport.
- Rapport maken is voor **uitvoerder of hoger**. Een zwamsaneerder niet:
  een rapport wordt pas opgemaakt als kantoor heeft vastgesteld dat het
  goed is.

## Wat nog openstaat

- **P0** Geen enkele foto ooit gemaakt — de hele fotoketen is onbewezen.
- **P0** Geen zwamsaneerder heeft ooit ingelogd.
- **P0** PDF-generatie van het opleverrapport bestaat niet.
- **P1** ClickUp-terugkoppeling (status + opmerking) is nooit live
  uitgevoerd, alleen in droogloop.
- **P1** ClickUp attachment-upload bestaat niet.
- **P1** Weesbestanden: een foto verwijderen haalt de databaserij weg
  maar laat het bestand in Storage staan. Hoort bij stap 3 van de
  fotoketen: pas opruimen als het uploadstempel gevuld is.
- **P1** `postcode`, `plaats` en `opdrachtnummer` zijn in de database
  overal leeg (0 van 30). Zoeken kijkt er sinds deze ronde wél in, maar
  vindt er niets zolang de brongegevens leeg blijven — het adresveld
  bevat de plaats meestal wel, dus zoeken op een plaatsnaam werkt in de
  praktijk via `adres`. Zodra de ClickUp-parser die velden vult, werkt
  de rest vanzelf mee. Het opdrachtnummer is bovendien wat een grote
  klus tot een project maakt op de projectenpagina; zolang het leeg is
  is elke klus daar een losse kaart.
- **P2** Eigen SMTP, lekwachtwoord-controle (dat laatste is een vinkje
  in het Supabase-dashboard, geen API).

**Opgelost in de ronde ná dit hoofdstuk:** de projectenpagina las de
lege tabel `projecten` (leest nu de werkbonnen), het zoekveld keek maar
in één gevuld veld (kijkt nu in tien), het opleverrapport had geen knop
en de drie tekstvelden geen invoerveld, en de planning had geen filters.

## Stand van de gegevens

30 werkbonnen · 405 afvinkpunten · 43 toewijzingen · 33 personen (2 met
account) · 31 documenten · **0 foto's** · 0 projecten · 0 opgeleverd ·
25 migraties, allemaal als bestand in Git. Geen drift.

---

**De sessie daarvóór stond volledig in het teken van Epic 4: Intelligent Work Preparation.** Dat is de koppeling tussen ClickUp en NMZ GO, plus de intelligentielaag daarbovenop.

## Het architectuurdocument

De volledige architectuur van Epic 4 is uitgewerkt en staat hier:
**https://claude.ai/code/artifact/68edd097-0c39-4c48-9789-dad233cf8e64**

Lees dat vóór je aan Epic 4 werkt. Alles erin is geverifieerd tegen de echte ClickUp-werkruimte, een echte werkopdracht en een echt opleverrapport — niet tegen aannames.

## Drie kernbesluiten van de eigenaar

1. **Serverlaag: Supabase Edge Functions.** De huidige client-only opzet kan Epic 4 niet dragen — een ClickUp-token hoort niet in browsercode, een webhook heeft een altijd bereikbare URL nodig. Blijft bij de bestaande leverancier.
2. **Multi-tenancy nu inbouwen.** De ambitie is SaaS en white label; tenant-isolatie achteraf toevoegen betekent elke RLS-policy herschrijven. Uitgevoerd in migratie 002.
3. **ClickUp is leidend, NMZ GO schrijft direct terug.** ClickUp blijft de bron van waarheid voor alles wat het kan uitdrukken. Elke wijziging in NMZ GO gaat *direct* terug, niet pas bij afronding — anders overschrijft een synchronisatie het werk van de monteur. Gevolg voor de planning: de synchronisatie mag niet in productie vóór de terugkoppeling er is.

## Wat er van ClickUp geverifieerd is

- Alleen Space **Werkvoorbereiding** doet mee (niet de 98 "Project Management X"-spaces). Folder *Planning overzicht - 2026*, lijst *Uitvoering 2026 Diemen*. Eén taak = één adres = één werkbon.
- **`volgende week` betekent "klaar voor uitvoering"** — dat is de synchronisatietrigger. Elk weekend wordt die status handmatig omgezet naar `deze week`; die omzetting ís de vrijgavebeslissing, dus NMZ GO heeft geen eigen vrijgaveknop nodig.
- Terugkoppeling bij oplevering: `opgeleverd` als de foto's compleet zijn, anders `wacht op foto's`.
- Van de 30 custom fields doen er drie mee: **Kluiscode**, **Werkopdracht (PDF)**, **Werktekening**. De rest staat al op de werkopdracht zelf.
- De werkopdracht is een vast sjabloon met labels en opsommingstekens. De uit te voeren punten zijn daarom **met een deterministische parser** uit te lezen — geen taalmodel nodig, en dus geen hallucinatierisico.
- Foto's: "voor" komt van de inspecteur, "na" van de monteur. Het rapport combineert beide.

## Fase 0 is afgerond

| Wat | Waar | Status |
|---|---|---|
| Migratie 002 — tenants, projecten, rapportvelden | `supabase/migrations/002_projecten_tenants_rapportvelden.sql` | Gedraaid door de eigenaar |
| `useProjecten.ts` van mock naar echte queries | commit `587ba30` | Gepusht, build groen |

Concreet toegevoegd: een `tenants`-tabel met `tenant_id` op alle tabellen, `get_mijn_tenant()` in dezelfde `SECURITY DEFINER`-stijl als `get_mijn_rol()`, de `projecten`-tabel met `project_id` op werkbonnen, en de velden die het opleverrapport vereist (postcode/plaats, opdrachtnummer, opleverdatum, vier vrije tekstblokken, `fase` op foto's).

**De projectenschermen tonen nu een lege lijst. Dat is correct** — de tabel bestaat, er staat alleen nog niets in. De vulling komt via de ClickUp-synchronisatie in fase 2.

## Openstaand — eerst afmaken

- ~~**Verificatiequery** na migratie 002~~ — **gedaan.** Rollen kloppen (`jeroenmarcvriesema@gmail.com` = beheerder), `get_mijn_rol()` en `get_mijn_tenant()` staan als `SECURITY DEFINER` met vaste `search_path`, geen `42P17` recursie.
- ~~**Rollentest** (beheerder + medewerker)~~ — **gedaan, en die vond een kritiek lek.** Zie hieronder; opgelost in migratie 003.
- ~~**Volledige rollentest na 002/003/004**~~ — **gedaan.** 16 van 17 schemacontroles groen, 45 rolcontroles waarvan 44 groen. Drie bevindingen, waarvan één beveiligingslek. Zie "Rollentest — volledige uitslag" hieronder.
- **Twee vragen liggen bij de eigenaar:** welk veld leidend is (`Werktekening` óf `Werktekening (PDF)` — er zijn er twee), en of het opleverrapport de fotopagina's apart exporteert.

## Migratie 003 — rol-escalatie gedicht

De voorgeschreven rollentest heeft een privilege escalation aangetoond die al sinds migratie 001 in het schema zat en in 002 is meegekopieerd. `profiles_update_own` had wel een `using`- maar geen `with check`-clausule. Postgres valt dan voor de controle op de nieuwe rij terug op `using ( auth.uid() = id )`, en `id` verandert niet bij een update — dus elke kolom van de eigen rij was vrij bewerkbaar.

Eén PostgREST-call als gewone medewerker volstond:

```
PATCH /rest/v1/profiles?id=eq.<eigen-id>
{ "rol": "beheerder", "tenant_id": "<andere-tenant>" }
```

Daarmee vielen de rolscheiding én de tenant-isolatie uit 002 tegelijk om: de medewerker werd beheerder in de tenant van een andere klant en kon diens werkbonnen lezen. Dit is aangetoond in een transactie met `rollback`; er is geen productiedata gewijzigd.

`003_fix_rolescalatie_profiles.sql` zet er twee sloten op: een `before update`-trigger die rol- en `tenant_id`-wijzigingen tegenhoudt (een trigger ziet `OLD`/`NEW`, een policy niet), plus `with check` op beide update-policies als tweede laag. `profiles_insert_own` had hetzelfde gat bij het aanmaken en is meegenomen. **Deze migratie is al toegepast op de database.**

Blijvend aandachtspunt: een tenant-verhuizing kan nu bewust alleen nog via `service_role`, niet via de app — ook niet door een beheerder.

Twee losse eindjes die geen blokkade vormen: `tenants` heeft RLS aan met nul policies (alles dicht — veilig, maar zodra een scherm de tenantnaam wil tonen is een select-policy nodig), en leaked-password-protection staat uit in Supabase Auth.

## Rollentest — volledige uitslag

De schemaverificatie van 002/003/004 (17 controles) en de rollentest voor beide rollen plus een niet-ingelogde bezoeker (45 controles) zijn uitgevoerd op de echte database. Het testscript staat in **`supabase/tests/rollentest.sql`** en is herbruikbaar — draai het opnieuw na elke RLS-wijziging, zoals `GIT_WORKFLOW.md` voorschrijft.

De test bootst een rol na met `set local role authenticated` plus een JWT-claim, precies zoals PostgREST dat voor de app doet. Elke schrijfpoging eindigt met een opzettelijke fout die het subtransactieblok terugdraait, dus er is geen productiedata gewijzigd. De testrijen (tweede tenant, twee werkbonnen, een project, een taak, een uitnodiging) zijn na afloop verwijderd; de database staat weer op 1 tenant, 1 werkbon, 3 taken, 0 projecten, 2 profielen.

**Schema (16 van 17 goed):** tenants-tabel gevuld, `tenant_id` op alle zes tabellen `not null` met `get_mijn_tenant()` als default en geen enkele rij zonder tenant, `projecten` met FK vanaf `werkbonnen` en RLS aan, alle acht rapportvelden en `fotos.fase` aanwezig, de trigger en `with check` uit 003 actief, en de wachtrij uit 004 met RLS aan en nul schrijfpolicies. De zeventiende controle is de periodieke starter — zie bevinding 3.

**Medewerker (21/21 goed):** ziet uitsluitend de eigen werkbon en de taken daarvan — niet een werkbon van de eigen tenant waaraan hij niet is toegewezen, en niets uit een andere tenant. Geen projecten, geen andere profielen, geen verwerkingswachtrij. Schrijven: rol-escalatie geweigerd door de trigger, tenant-hop geweigerd, werkbon/project/verwerkingstaak aanmaken geweigerd door RLS, `taak_aanmaken()` geweigerd, een taak van een vreemde bon raakt 0 rijen, een eigen taak naar een andere tenant verplaatsen wordt geweigerd. Taken van de eigen werkbon afvinken werkt.

**Beheerder (17/17 goed):** ziet de hele eigen tenant en niets daarbuiten. Een werkbon van een andere tenant is onzichtbaar, niet te wijzigen (0 rijen) en niet te verwijderen (0 rijen); aanmaken mét een vreemde `tenant_id` wordt geweigerd, en een eigen werkbon naar een andere tenant verplaatsen ook. Rollen zetten binnen de eigen tenant mag, een profiel verhuizen niet. `taak_aanmaken()` werkt, direct in `verwerkingstaken` schrijven niet.

**Niet ingelogd:** nul rijen op werkbonnen, profielen, taken, projecten en tenants — zie bevinding 2 voor de uitzondering.

### Bevinding 1 — medewerker kan zijn werkbon niet afronden — *opgelost in 005*

`src/pages/medewerker/WerkbonUitvoeren.tsx:26` zet de werkbon op `voltooid`:

```ts
await supabase.from('werkbonnen').update({ status: 'voltooid' }).eq('id', werkbon.id)
```

`werkbonnen_update` staat alleen een beheerder toe. De update raakt dus 0 rijen. PostgREST geeft daar geen fout op — een update die niets raakt is een geldige lege respons — en de code kijkt niet naar `error` of naar het aantal geraakte rijen. **De monteur krijgt te zien dat de bon is afgerond terwijl er niets is opgeslagen.** Dit staat los van 002/003/004; de policy is zo sinds 001.

Opgelost in migratie 005 met dezelfde tweetrapsopzet als 003: een extra update-policy voor wie op de bon staat, plus een trigger die zo iemand beperkt tot de kolom `status` en tot de waarden `bezig`/`voltooid`. Aan de clientkant checkt `WerkbonUitvoeren.tsx` nu `error` én het aantal geraakte rijen, zodat een geblokkeerde update niet meer als succes wordt gemeld. Datzelfde is gedaan op `WerkbonDetail.tsx`, `TaakItem.tsx` (afvinken én foto-upload).

### Bevinding 2 — uitnodigingstokens zijn publiek leesbaar — *opgelost in 005*

`uitnodigingen_select` heeft als voorwaarde letterlijk `true`. Aangetoond met een testrij: een **niet-ingelogde** bezoeker leest alle uitnodigingen van alle tenants op, inclusief `token`. De anon-key staat in de browserbundel, dus dit is voor iedereen te doen. Wie een ongebruikt token opvraagt, kan zich met `Registreer.tsx` in de bijbehorende tenant inschrijven.

`uitnodigingen_update` is vergelijkbaar ruim (`get_mijn_rol() = 'beheerder' or auth.uid() is not null`, zonder `with check`): elke ingelogde gebruiker kan de uitnodiging van een willekeurige andere tenant op `gebruikt` zetten.

De select-policy stond er omdat `Registreer.tsx` het token vóór de login moet kunnen opzoeken. Migratie 005 zet de tabel dicht voor iedereen behalve de beheerder van de eigen tenant, en zet daar `uitnodiging_controleren(token)` naast: een `security definer`-functie die één token als argument neemt en alleen `true`/`false` teruggeeft — geen rij, geen tenant, geen lijst. `Registreer.tsx` gebruikt die functie nu.

### Bevinding 3 — de verwerker draait nog niet periodiek (afmaken vóór fase 1)

Blok A t/m F van `004_verwerkingswachtrij.sql` staan op de database: de tabellen, de RLS, `taak_aanmaken()`. **Blok G niet.** `start_verwerker()` bestaat niet, er staat geen job in `cron.job`, en de Vault bevat geen `project_url` of `service_role_key`. De wachtrij vult zich dus wel, maar niets start de Edge Function.

Dat is geen fout in de migratie — blok G staat er bewust buiten de transactie, want het heeft twee secrets nodig die niet in git horen. Het moet eenmalig door de eigenaar gedraaid worden, in de SQL-editor van Supabase:

```sql
select vault.create_secret('<service-role-key>', 'service_role_key');
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
```

Daarna blok G uit `004_verwerkingswachtrij.sql` uitvoeren. Controleer met `select jobname, schedule, active from cron.job;` dat `nmzgo-verwerker` er staat.

### Bevinding 4 — iedereen kon zich als beheerder registreren — *opgelost in 005*

Dit kwam boven tijdens het schrijven van de fix voor bevinding 2, en weegt zwaarder dan de rest. De rollentest kon het niet vinden, want het gaat volledig buiten RLS om.

`handle_new_user()` is de trigger die bij een registratie het profiel aanmaakt. Die las de rol uit `new.raw_user_meta_data->>'rol'`. Die metadata komt rechtstreeks uit de client:

```ts
supabase.auth.signUp({ email, password, options: { data: { rol: 'beheerder' } } })
```

Eén registratie volstond om beheerder te worden. De `with check` op `profiles_insert_own` uit migratie 003 hielp hier niet: `handle_new_user()` draait als `security definer` en gaat dus langs RLS heen. Migratie 005 zet de rol vast op `'medewerker'`; promoveren doet een bestaande beheerder, en dat loopt langs de trigger uit 003.

**Let op:** dit gat stond open zolang zelfregistratie mogelijk was. Als je in Supabase Auth zelfregistratie aan hebt staan, is het de moeite waard de bestaande accounts één keer na te lopen: `select id, naam, rol from profiles where rol = 'beheerder';` — op dit moment is dat er één, jouw eigen account, dus er is niets misgegaan.

### Bevinding 5 — uitgenodigde belandde in de verkeerde tenant — *opgelost in 005*

`handle_new_user()` zette geen `tenant_id`, waardoor de kolomdefault greep: `get_mijn_tenant()`. Tijdens een registratie is er nog geen JWT, dus die functie viel terug op haar laatste redmiddel — de oudste tenant. Met één tenant valt dat niet op; met twee komt iedere uitgenodigde bij de verkeerde klant binnen.

De uitnodiging draagt de tenant al. Migratie 005 leest het token uit de metadata, haalt de tenant uit de uitnodiging en verzilvert die in dezelfde transactie. Daarmee is een token ook niet meer twee keer te gebruiken — dat was voorheen een aparte call vanuit de client, met de race die daarbij hoort.

## Migratie 005 — wat er is gewijzigd

`supabase/migrations/005_uitnodigingen_en_werkbonstatus.sql`, **al toegepast op de database.** Dicht bevinding 1, 2, 4 en 5. Raakt geen data.

Na afloop opnieuw getest met `supabase/tests/rollentest.sql`, uitgebreid met de nieuwe gevallen: 8 controles op de medewerker (afronden lukt nu, terugzetten naar `open` niet, een andere kolom wijzigen niet, de bon van een collega niet), 4 op de niet-ingelogde bezoeker (geen tokens meer zichtbaar, de controlefunctie werkt wel) en 5 regressiecontroles op de beheerder (status, adres, tenant-grens, uitnodiging aanmaken). Alle 17 zoals verwacht, geen regressie. De testrijen zijn opgeruimd; de database staat weer op 1 tenant, 1 werkbon met status `open`, 3 taken, 0 uitnodigingen, 2 profielen.

Aan de clientkant: `Registreer.tsx` (via de functie, token als metadata mee), `WerkbonUitvoeren.tsx`, `WerkbonDetail.tsx` en `TaakItem.tsx` (foutafhandeling, `alert()` eruit). `npm run build` groen.

## ClickUp-scope — besloten: Diemen én Leek

Het architectuurdocument gaat uit van één lijst: *Uitvoering 2026 Diemen*. Een telling in de echte werkruimte (augustus 2026) liet zien dat dat te smal is. Op status `volgende week` stonden **30 taken**, verdeeld over drie lijsten:

| Lijst | Lijst-ID | Taken |
|---|---|---|
| Uitvoering 2026 Diemen | `901517814355` | 24 |
| Uitvoering 2026 Leek | `901522829990` | 5 |
| Uitvoering | `901506909996` | 1 |

Alleen Diemen synchroniseren zou vijf adressen stil laten verdwijnen — Bolswarderbaan in Sneek, Stationsstraat in Eext, 27 woningen in Oude Pekela, Bangmastrjitte in Rheduzum, Dahliastraat in Rijnsburg — zonder dat iemand het merkt tot een monteur ergens zonder werkbon staat.

**Besluit van de eigenaar: Diemen én Leek doen mee.** Leek is een tweede vestiging met dezelfde werkwijze. De losse lijst *Uitvoering* (1 taak) blijft buiten scope; die lijkt een restant.

Voor fase 2 betekent dit: de synchronisatie filtert op deze twee lijst-ID's, niet op de space (dan zou *Uitvoering* er alsnog bij komen) en niet op één lijst. Zet ze als constante bij elkaar bovenin de handler, zodat een derde vestiging één regel is.

Space *Werkvoorbereiding* = `90152805075`.

## Mock data — eruit

`useDashboard` en `useWerkdag` waren de laatste twee hooks op verzonnen data. Beide draaien nu op echte tabellen; migratie 006 voegde `werkdag_logs` toe. Daarmee is er **geen mock data meer in de app**.

Wat dat praktisch betekent voor de testfase: het dashboard toont nu wat er werkelijk staat. Met één werkbon in de database die niet op de datum van vandaag staat, zie je een lege staat — dat is correct, geen bug. Wil je het dashboard gevuld zien, maak dan een werkbon aan met de datum van vandaag, koppel er een monteur aan, en laat die zijn werkdag starten.

De drempels waarop het dashboard alarm slaat staan als benoemde constanten bovenin `useDashboard.ts`: verwachte starttijd 08:00, één uur bezig zonder foto is een melding, en na twee uur bezig met minder dan de helft van de taken klaar geldt een bon als "achter op schema". Dat zijn keuzes, geen natuurwetten — verstel ze als de praktijk anders blijkt.

**Nog wel op mock/afwezig:** niets in de hooks. Wat resteert zijn features die simpelweg nog niet bestaan (PDF-export, foto-annotaties) — zie de backlog.

## Designfase — afgerond

**De overdracht hieronder (hoofdstuk 7, 10 en 11) is op dit punt achterhaald.** Die stelt dat de premium redesign nog volledig moet gebeuren. Dat klopt niet meer: in Sprint 3.1 en 3.1b is die grotendeels uitgevoerd, ná het schrijven van dat hoofdstuk. Wat er nu staat:

- Themasysteem compleet — `themeStore` met opgeslagen voorkeur, `class`-strategie, no-flash-script in `index.html`, toggle in zowel `Sidebar` als `Topbar`. `dark:`-varianten zitten in vrijwel elk bestand.
- Merktokens, radius-/schaduwschaal, `ease-brand`-curve en `animate-page-in` staan in `tailwind.config.ts` en worden overal gebruikt.
- `SectionHeading` vervangt alle losse sectiekoppen.

Wat de fase openhield was niet het uiterlijk maar de **samenhang**: zes `alert()`-popups, acht verschillende lege staten, zeven emoji als icoon, geen enkele foutstaat, en een `Modal` met een permanent donkere kop. Dat is nu opgelost — zie het bovenste blok in `CHANGELOG.md` en de nieuwe componenten in `.ai/COMPONENT_LIBRARY.md`.

**Eén beslissing die expliciet blijft staan:** het thema is light-primair, niet dark-primair. `PRODUCT_VISION.md` schrijft dark-primair voor, maar in 3.1b is bewust omgedraaid naar light. Dat is de latere beslissing en die is aangehouden. Wil je alsnog dark-primair, dan is dat één regel in `themeStore` plus het script in `index.html` — maar het is een keuze van de eigenaar, geen achterstallig werk.

**Nog open, bewust:** `Select`, generieke `Table` en `Dialog`. Geen enkel scherm heeft ze nodig. Bouw ze op het moment dat het eerste scherm ze vraagt.

## Volgende stap

**Fase 1: serverlaag en verwerkingswachtrij.** Eerste Edge Function, takenwachtrij in Postgres, periodieke starter, en een beheerdersscherm dat toont wat er draait — bewust nog zonder ClickUp, om het patroon te bewijzen op iets ongevaarlijks.

## Beperkingen van de ontwikkelomgeving

- **`supabase.co` is geblokkeerd** vanuit de Claude-container (netwerkpolicy). De app kan daar dus niet ingelogd getest worden. Database-toegang loopt via de **Supabase-connector**, die buiten die blokkade om werkt — als die connector wegvalt, is een nieuwe sessie starten de betrouwbaarste oplossing.
- Om ingelogde schermen te bekijken is er een truc: zet tijdelijk een mock-profiel in `AuthInitializer` (`App.tsx`) achter een env-vlag. Dashboard, Projecten en Planning draaien op data die geen echte login vereist. **Draai die wijziging altijd terug voor je commit.**

---

# 1. Projectoverzicht

**NMZ GO** is een interne webapplicatie voor NMZ waarmee monteurs en beheerders **werkbonnen** (werkopdrachten) digitaal aanmaken, plannen, uitvoeren en afronden.

- **Voor wie:** ~30 medewerkers van NMZ, dagelijks gebruik. Geen externe/klant-facing toegang — dit is intern gereedschap, geen product dat verkocht wordt.
- **Bedrijfscontext:** NMZ is een bedrijf met monteurs die op locatie (bij klanten, op daken, in schakelkasten) werk uitvoeren. Vóór deze app werd dit proces papieren/ad-hoc bijgehouden.
- **Doel van de software:** één digitale, betrouwbare bron van waarheid voor het werkbonnenproces — projecten → werkbonnen → taken → foto-bewijs → afronding → rapportage.
- **Gebruikersrollen** (hard gescheiden in UI én database via RLS):
  - **Beheerder** — maakt projecten/werkbonnen aan, plant medewerkers in, beheert medewerkers, bekijkt dashboard/rapportages. Werkt vaker op desktop, moet ook op tablet werken.
  - **Medewerker** — ziet uitsluitend eigen werkbonnen, vinkt taken af, uploadt foto's als bewijs. Werkt vrijwel altijd op een telefoon, vaak buiten, met wisselende connectiviteit.
- **Huidige ontwikkelfase:** post-MVP, sprintgewijze doorontwikkeling. Zie hoofdstuk 0 voor de actuele stand — de tekst hieronder in dit hoofdstuk beschrijft de situatie van vóór Epic 4 en is op onderdelen achterhaald.
- **Let op — de scope is verbreed.** Dit hoofdstuk en `PROJECT.md` beschrijven NMZ GO als intern gereedschap dat niet verkocht wordt. Dat is niet langer het uitgangspunt: de eigenaar wil het platform later als **SaaS en white label** aanbieden. Daarom is multi-tenancy al ingebouwd (migratie 002) en is "configuratie boven code" een leidend principe geworden. Zie het architectuurdocument in hoofdstuk 0.

---

# 2. Technische Architectuur

NMZ GO is een **client-only single-page application** — geen eigen backend-server. De React-app praat rechtstreeks met Supabase; **Row Level Security (RLS) is de enige autorisatielaag**.

**Stack:**
- **React 18** — functiecomponenten + hooks only, geen class components.
- **Vite 5** — dev server (`npm run dev`, poort 5173) en build (`npm run build` = `tsc` + `vite build`).
- **TypeScript 5**, `strict: true` in `tsconfig.json`. `noUnusedLocals`/`noUnusedParameters` staan uit, maar ongebruikte imports worden desondanks als hygiëne vermeden.
- **Tailwind CSS 3** — alle styling via utility-classes en de tokens in `tailwind.config.ts` (merkkleuren `brand.yellow`/`brand.red`, `surface`-lagen, radius-/shadow-schaal). Geen CSS-modules, geen losse `<style>`-blokken.
- **Zustand** — **uitsluitend** voor auth-state (`authStore.ts`: profile/loading/error/signOut). Geen tweede globale store.
- **Supabase** — Postgres + Auth + Storage. Eén client in `src/lib/supabase.ts`. Env-variabelen `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` verplicht (`.env.local`, niet gecommit).
- **react-router-dom 6** — routing centraal in `src/App.tsx`.

**Routering:** elke route hangt achter een guard.
- `BeheerderGuard`: `/dashboard`, `/projecten`, `/projecten/:id`, `/planning`, `/werkbonnen`, `/werkbonnen/nieuw`, `/werkbonnen/:id`, `/medewerkers`, `/rapporten`.
- `AuthGuard` (elke ingelogde gebruiker): `/mijn-werkbonnen`, `/werkbon/:id`, `/afgerond`.
- Zonder guard: `/login`, `/registreer`, `/` (→ `RootRedirect`, stuurt door op basis van rol).

**Auth-architectuur:** één `AuthInitializer`-component in `App.tsx` initialiseert sessie + auth-listener **eenmalig**. Guards lezen alleen uit de Zustand-store, starten nooit een eigen listener — dit is een **opgeloste kritieke bug** (race condition/oneindige laadstatus) en mag nooit terugkomen.

**Componentstructuur:**
```
components/
├── ui/        Button, Card, Badge/StatusBadge, Input/Textarea, Modal, Avatar, ProgressBar, Spinner/PageLoader
├── layout/    Sidebar, MobileNav, Topbar/MobileTopbar, PageWrapper
├── dashboard/ KpiCard, StatCard, ActivityFeed, MeldingItem, ProjectTabel
├── werkbon/   WerkbonKaart
└── taak/      TaakItem
```
Nog **niet** gebouwd (zie `.ai/COMPONENT_LIBRARY.md`): `Select`, generieke `Table`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`.

**Hooks** (`src/hooks/`): `useAuth` (pure store-reader), `useWerkbonnen`/`useWerkbon` (échte Supabase-queries), `useTaken`, `useFotos`, `useProjecten`/`useProject`/`usePlanning` (**mock data**, zie hoofdstuk 3), `useDashboard` (**mock data**), `useWerkdag` (mock/sessionStorage, wacht op een `werkdag_logs`-tabel).

**Pagina's** (`src/pages/`): `auth/` (Login, Registreer), `beheerder/` (Dashboard, Projecten, ProjectDetail, Planning, Werkbonnen, WerkbonNieuw, WerkbonDetail, Medewerkers, Rapporten), `medewerker/` (MijnWerkbonnen, WerkbonUitvoeren, Afgerond).

**Layoutstructuur:** `PageWrapper` is de enige paginaschil (Sidebar+Topbar op desktop, MobileTopbar+MobileNav op mobiel). Elke pagina rendert binnen `<PageWrapper title="..." actions={...}>`.

**Mappenstructuur (volledig):**
```
nmzgo/
├── CLAUDE.md                 # wijst uitsluitend naar .ai/CLAUDE.md
├── .ai/                      # volledige projectdocumentatie (zie hoofdstuk 5)
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   ├── components/ (zie boven)
│   ├── pages/ (zie boven)
│   ├── hooks/ (zie boven)
│   ├── lib/          supabase.ts, utils.ts
│   ├── store/        authStore.ts
│   └── types/        index.ts
└── supabase/
    └── migrations/   001_initial.sql (enige migratie tot nu toe)
```

---

# 3. Huidige status van het project

**Afgeronde sprints (gecommit):**
- **MVP / v1.0.0** — auth (login, sessieherstel, logout, rolgebaseerde redirect), RLS-basis (medewerker ziet alleen eigen werkbonnen, beheerder ziet alles). Zie `CHANGELOG.md`.
- **Sprint 2.1 — werkende versie** (commit `977effd`, enige commit in de git-historie).

**Sprint 3 — Projecten & Planning (deze sessie afgerond, nog niet gecommit):**
- Build gerepareerd (`Sidebar.tsx`/`MobileNav.tsx` waren middenin een restyling afgebroken — syntaxfout, build faalde).
- Projectenoverzicht (`/projecten`), projectdetail (`/projecten/:id`), weekplanning (`/planning`) volledig bruikbaar.
- Dashboard uitgebreid naar 6 project-gebaseerde KPI's.
- Kleine visuele polish (lege-staat, hover-transities) — zie hoofdstuk 7 voor waarom dit **niet** de volledige visuele redesign is die de eigenaar voor ogen had.

**Volledig werkend (echte Supabase-koppeling, productie-klaar):**
- Auth (login/registreer/sessieherstel/logout/rolgebaseerde redirect).
- RLS: rolscheiding beheerder/medewerker, `get_mijn_rol()` SECURITY DEFINER-patroon.
- Werkbonnen: aanmaken (`WerkbonNieuw.tsx`), overzicht, detail, taken afvinken, foto-upload — allemaal echte `supabase.from(...)`-calls.

**Draait op mock data (géén echte backend-koppeling):**
- `useDashboard.ts` — dashboard-cijfers, meldingen, activiteit.
- `useProjecten.ts` — projecten, planning, medewerkerskoppeling (`koppelMedewerkers` is deze sessie toegevoegd, maar puur in-memory).
- `useWerkdag.ts` — start/stop werkdag, sessionStorage, wacht op een `werkdag_logs`-tabel.
- Alle bovenstaande mock-hooks bevatten expliciete code-comments met de bedoelde Supabase-query voor later.

**Nog te ontwikkelen:**
- Echte `projecten`-databasetabel + migratie + RLS-policies (Project heeft velden — `opdrachtgever`, `startdatum`, `einddatum`, `opmerkingen` — die niet op `werkbonnen` bestaan; dit is bewust nog niet gebouwd, zie hoofdstuk 7 en 10).
- **De volledige premium UI-redesign** (dark-mode-primair, enterprise-uitstraling) — zie hoofdstuk 6/7/11, dit is nu de belangrijkste openstaande prioriteit.
- Ontbrekende UI-primitives: `Select`, generieke `Table`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`.
- PDF-export van rapporten, geautomatiseerde tests, signed URLs voor foto-opslag.

---

# 4. Git status

```
Branch:              main
Remote:              origin → https://github.com/jeroenmarcvriesema-nmz/NMZ-GO.git
Status t.o.v. remote: up to date with 'origin/main'
Commits (git log):   977effd  Sprint 2.1 werkende versie   ← enige commit in de historie
Staged wijzigingen:  GEEN
```

**Unstaged (modified, nog niet gestaged):**
```
CHANGELOG.md
src/App.tsx
src/components/layout/MobileNav.tsx
src/components/layout/PageWrapper.tsx
src/components/layout/Sidebar.tsx
src/components/layout/Topbar.tsx
src/index.css
src/pages/beheerder/Dashboard.tsx
src/types/index.ts
tailwind.config.ts
```

**Untracked (nieuwe bestanden):**
```
.ai/                                  ← volledige projectdocumentatie (zie hoofdstuk 5)
CLAUDE.md                             ← root-pointer naar .ai/CLAUDE.md
src/hooks/useProjecten.ts
src/pages/beheerder/Planning.tsx
src/pages/beheerder/ProjectDetail.tsx
src/pages/beheerder/Projecten.tsx
src/vite-env.d.ts
```

**Diff-omvang (unstaged, `git diff --stat`):** 10 bestanden, +226/−144 regels.

**Belangrijk:** er is op dit moment **geen enkele wijziging van Sprint 3 gecommit**. Alles staat in de werkmap. `npm run build` slaagt (laatste keer geverifieerd: schone build, 6283 modules, geen fouten). Commit is bewust uitgesteld tot na expliciete goedkeuring van de eigenaar op het resultaat — die goedkeuring is er tot nu toe nog niet geweest.

---

# 5. AI-documentatie

Alles staat in `.ai/` (verborgen map in de projectroot). Het root-`CLAUDE.md` verwijst uitsluitend naar `.ai/CLAUDE.md` zodat Claude Code/Desktop dit automatisch als projectcontext oppikt.

| Bestand | Waarvoor |
|---|---|
| `.ai/CLAUDE.md` | **Startpunt/AI-grondwet.** Projectvisie, verplichte AI-werkwijze, verboden acties, Definition of Done, index naar alle overige documenten. |
| `.ai/PROJECT.md` | Doel van NMZ GO, doelgroep, rollen, kernproces, scope. |
| `.ai/PRODUCT_VISION.md` | **De merk-/designvisie van de eigenaar** — premium enterprise-gevoel, dark-mode-strategie, kleurgebruik. Zie hoofdstuk 6/7 hieronder — dit is de sleuteldocument voor de volgende stap. |
| `.ai/ARCHITECTURE.md` | Lagen, auth-flow, technologie-stack, mappenstructuur, database, Supabase- en securityregels. |
| `.ai/DESIGN_SYSTEM.md` | **Huidige, daadwerkelijk geïmplementeerde** UI/UX-staat (tokens, componentregels, responsive) — bewust apart van de toekomstvisie in `PRODUCT_VISION.md`. |
| `.ai/UI_GUIDELINES.md` | Concrete patronen: spacing, typography, cards, forms, tables, modals, animaties, loading/empty/error states. |
| `.ai/COMPONENT_LIBRARY.md` | Elk bestaand component gedocumenteerd (doel/gebruik/varianten/regels) + wat nog ontbreekt. |
| `.ai/CODING_STANDARDS.md` | Coding standards, TypeScript, React, performance, naamgeving, refactor-/featureregels. |
| `.ai/GIT_WORKFLOW.md` | Branch-/commitconventies, build- en testprocedure. |
| `.ai/DEPLOYMENT.md` | Git-workflowoverzicht, build, productie (Netlify/Supabase), rollback. |
| `.ai/TESTING.md` | Handmatige testprocedure, build procedure, Definition of Done, release checklist. |
| `.ai/ROADMAP.md` | Wat bewust nog niet gebouwd is, bekende aandachtspunten. |
| `.ai/FEATURE_BACKLOG.md` | Sprint 3–6 en verdere toekomstige features, met prioriteit (zie hoofdstuk 10 voor de bijgewerkte volgorde). |
| `.ai/SPRINTS.md` | Sprintwerkwijze en sprintlog — inclusief het net afgeronde Sprint 3-verslag. |
| `.ai/HANDOVER.md` | **Dit document.** |

---

# 6. Visie van de eigenaar

De eigenaar (Jeroen) heeft expliciet vastgelegd — dit is geen interpretatie, dit staat letterlijk zo in `.ai/PRODUCT_VISION.md` — dat NMZ GO moet **aanvoelen als een premium bedrijfsplatform**, ook al gebruiken maar ~30 mensen het.

**Inspiratiebronnen (expliciet genoemd door de eigenaar):**
- **Apple** — rust, precisie, terughoudendheid.
- **Linear** — snelheid als gevoel, subtiele micro-animaties, donker canvas.
- **Notion** — veel witruimte, duidelijke hiërarchie.
- **Stripe Dashboard** — data serieus en helder presenteren.
- **Raycast** — (door de eigenaar genoemd bij deze overdracht-opdracht, nog niet in `PRODUCT_VISION.md` opgenomen tot deze sessie — inmiddels toegevoegd) keyboard-first snelheid, minimale chrome, strakke command-palette-achtige efficiëntie.

**Esthetische eigenschappen (niet onderhandelbaar):**
- Strak, minimalistisch, professioneel, rustig.
- Veel witruimte — content ademt, wordt niet platgedrukt.
- Grote, duidelijke typografie voor nadruk (KPI's, koppen).
- Mooie, functionele animaties — nooit puur decoratief, nooit vertragend.
- Moderne kaarten: heldere randen, diepte via subtiele schaduw, geen zware borders.
- Consistente, afgeronde hoeken via de radius-schaal.
- **Snelheid boven overbodige effecten** — een animatie die geen betekenis toevoegt (bevestiging/richting/hiërarchie) hoort er niet te zijn.
- Geen drukke interface — rustige UX, geen concurrerende accenten.

**Thema:** **dark mode is de primaire, standaard ervaring.** Light mode wordt **volledig** ondersteund (niet als bijzaak) — relevant omdat medewerkers vaak in fel buitenlicht werken. Gebruiker kan wisselen; voorkeur wordt opgeslagen.

**Kleurgebruik:** NMZ Geel = primaire accentkleur (acties, actieve navigatie, voortgang). NMZ Rood = uitsluitend waarschuwingen/kritieke acties. **Geen overmatig kleurgebruik** — kleur is altijd functioneel, nooit decoratief. De basis van elk scherm is neutraal.

**Wat dit niet betekent (ook expliciet vastgelegd):** premium/minimalistisch mag nooit ten koste gaan van bruikbaarheid in het veld (contrast, leesbaarheid, grote touch targets voor monteurs), Nederlandse mensentaal, en "één duidelijke actie per scherm."

---

# 7. Wat is er misgegaan tijdens Sprint 3

**Eerlijke reconstructie van deze sessie:**

1. Een eerdere, afgebroken sessie had `Sidebar.tsx`/`MobileNav.tsx` middenin een restyling laten staan — de build was **kapot** (TypeScript-syntaxfouten). Dit is deze sessie ontdekt en gerepareerd.
2. Bij het plannen van Sprint 3 is de eigenaar expliciet een keuze voorgelegd: *volledige Supabase-backend nu bouwen* vs. *alleen de UI afmaken op de bestaande mock data*. De eigenaar koos bewust voor de kleinere, mock-data-only scope.
3. Vervolgens is gevraagd om Dashboard/Projecten/Planning **visueel te toetsen** aan `PRODUCT_VISION.md`/`UI_GUIDELINES.md` en te verbeteren "binnen de bestaande mock-data scope" — met de expliciete restrictie "geen dark-mode-implementatie".
4. Dit is uitgevoerd als een **compliance-audit + lichte polish**: één echte overtreding gevonden en gefixt (een emoji in een lege-staat, in strijd met de iconregel), plus kleine hover-transitie-verbeteringen. Dashboard bleek al grotendeels in lijn met de richtlijnen.
5. **Resultaat:** build succesvol, code stabiel, Projecten/Planning/ProjectDetail functioneel compleet op mock data — maar **visueel is de app nog steeds het bestaande lichte thema met kleine incrementele verbeteringen**, niet de premium, dark-mode-primaire, Apple/Linear/Notion/Stripe/Raycast-achtige transformatie die in hoofdstuk 6 staat beschreven.

**Waarom dit waarschijnlijk is gebeurd:**
`PRODUCT_VISION.md` zelf (geschreven eerder in dezelfde sessie) framet de dark-mode/premium-visuele overgang expliciet als een **bewust aparte, latere migratietaak** — juist om te voorkomen dat er ongepland een grote, risicovolle herstyling van de hele app plaatsvindt binnen een kleinere sprint. Toen tijdens Sprint 3 werd gevraagd om "binnen de bestaande mock-data scope te verbeteren" én "geen dark-mode" werd herbevestigd, is dit correct geïnterpreteerd als: een gerichte, kleine compliance-pas — **niet** als een opdracht tot de volledige visuele redesign. Met andere woorden: de gedocumenteerde scope-afbakening (bedoeld om risico te beperken) en de daadwerkelijke verwachting van de eigenaar (die intussen groter was gegroeid, richting "dit moet er nu al premium uitzien") zijn uit elkaar gaan lopen. Dit is geen technisch falen — build en code zijn stabiel — maar een **scope-/verwachtingsmismatch** die niet expliciet genoeg is uitgevraagd voordat er werd geïmplementeerd.

---

# 8. Belangrijkste lessen

1. **Eerst analyseren, dan pas plannen.** De kapotte build was alleen te vinden door de daadwerkelijke bestanden te lezen en `npm run build` te draaien vóór het schrijven van een plan — niet door op de eerdere sprintlog te vertrouwen.
2. **Scope-forks expliciet voorleggen, niet zelf beslissen.** De keuze "volledige backend nu vs. mock-data-only" is terecht aan de eigenaar voorgelegd — dat werkte goed.
3. **"Verbeter volgens de richtlijnen" is dubbelzinnig tussen "kleine compliance-fix" en "volledige redesign".** Dit onderscheid is deze sessie **niet** expliciet uitgevraagd, met een verwachtingsmismatch als gevolg (zie hoofdstuk 7). Volgende keer: bij een vage "verbeter dit visueel"-opdracht expliciet laten kiezen tussen polish-niveau en redesign-niveau, zeker wanneer er een groot visie-document (`PRODUCT_VISION.md`) met een expliciet nog-niet-geïmplementeerde stijl in de buurt is.
4. **Build draaien na élke stap, niet pas aan het einde.** Dit voorkomt dat kleine fouten zich opstapelen.
5. **Fouten zelf oplossen binnen scope**, niet rapporteren-en-stoppen.
6. **Pas committen na expliciete goedkeuring van het resultaat.** Dit is deze sessie strikt aangehouden — er is bewust niets gecommit zonder akkoord, wat nu betekent dat Sprint 3 klaarstaat maar wacht op een go/no-go (zie hoofdstuk 4).
7. **Transparant zijn over verificatiegrenzen.** Er waren geen Supabase-testcredentials en geen browser-automatiseringstool beschikbaar in de terminalomgeving — dit is expliciet benoemd in plaats van een ongeteste browserflow als "geverifieerd" te presenteren.

---

# 9. Nieuwe ontwikkelstrategie

Vanaf nu geldt voor **elke** taak aan NMZ GO, groot of klein, deze volgorde — geen stap overslaan:

1. **Lees eerst alle relevante documentatie** in `.ai/` (minimaal `.ai/CLAUDE.md`, plus de specifieke documenten die de taak raakt — bij visuele taken altijd `PRODUCT_VISION.md` én `UI_GUIDELINES.md` én `DESIGN_SYSTEM.md` samen, niet één ervan).
2. **Analyseer de volledige, actuele codebase** — lees de daadwerkelijke bestanden, vertrouw niet op eerdere sprintlogs of aannames. Draai `npm run build`/`git status` vroeg in het proces om de echte staat te kennen.
3. **Maak een concreet implementatieplan** — welke bestanden, welke componenten (nieuw/hergebruikt), welke risico's, welke volgorde. Bij een vage of dubbelzinnige opdracht (met name "verbeter dit visueel"): expliciet navragen of het een kleine polish-pas of een volledige redesign betreft, vóórdat het plan wordt geschreven.
4. **Wacht op expliciete goedkeuring** van dat plan voordat er ook maar één regel code wordt geschreven.
5. **Implementeer** volgens het goedgekeurde plan.
6. **Draai `npm run build` na elke betekenisvolle stap** en los fouten zelfstandig op — ga niet door met een rode build.
7. **Geef een volledig overzicht** van gewijzigde bestanden, uitgevoerde wijzigingen, buildresultaat en resterende TODO's.
8. **Commit pas na expliciete goedkeuring** van de eigenaar op het resultaat.

---

# 10. Openstaande werkzaamheden (bijgewerkte backlog)

> Deze volgorde vervangt/verfijnt de eerdere volgorde in `.ai/FEATURE_BACKLOG.md` — de premium redesign is naar voren gehaald naar Sprint 3.1 omdat dit nu de duidelijkste, expliciet uitgesproken prioriteit van de eigenaar is.

**Sprint 3.1 — Premium UI Redesign (eerstvolgende prioriteit):**
- Volledige visuele redesign van Dashboard, Projecten, ProjectDetail, Planning (en waar nodig gedeelde componenten/layout) conform `PRODUCT_VISION.md` en `UI_GUIDELINES.md`: dark-mode-primair met volledig ondersteund light mode, theme-toggle + opgeslagen voorkeur.
- Ontbrekende UI-primitives bouwen waar de redesign ze nodig heeft: `Select`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`, generieke `Table`.
- Eerst het huidige Sprint 3-werk (zie hoofdstuk 4) laten beoordelen/committen door de eigenaar, of expliciet meenemen in dezelfde redesign-slag — dit is een keuze voor de eigenaar, geen aanname.

**Sprint 4 — Echte backend voor Projecten & Planning:**
- Nieuwe `projecten`-tabel + migratie (incl. `project_id`-FK op `werkbonnen`), RLS-policies, `useProjecten.ts` volledig herschrijven naar echte Supabase-queries.

**Sprint 5 — Rapportages & inzicht:**
- PDF-export van rapporten, dashboard analytics-uitbreiding (trends over tijd), verkennend: AI-rapportages.

**Sprint 6 — Veldgebruik verbeteren:**
- Foto-annotaties, GPS/locatiecontrole (privacy eerst bespreken), offline modus (basis), push notificaties.

**Toekomst (nog niet gepland):**
- Planning-optimalisatie (automatische suggesties), signed URLs voor foto-opslag, geautomatiseerde tests, medewerkersstatistieken, multi-vestiging/multi-team-ondersteuning (alleen bij concrete aanleiding).

---

# 11. Aanbevolen volgende stap

**NIET direct programmeren.** De eerste actie van Claude Desktop na het lezen van dit document is:

1. Lees de volledige `.ai/`-documentatie (in elk geval `CLAUDE.md`, `PRODUCT_VISION.md`, `UI_GUIDELINES.md`, `DESIGN_SYSTEM.md`, `COMPONENT_LIBRARY.md`).
2. Analyseer de volledige, actuele codebase (niet vertrouwen op dit document als vervanging daarvan — dit document is context, geen bron van waarheid over de code zelf).
3. Beoordeel de huidige UI daadwerkelijk (lees de gerenderde structuur van Dashboard/Projecten/ProjectDetail/Planning en de gedeelde componenten).
4. Vergelijk die huidige UI expliciet met `PRODUCT_VISION.md` en `UI_GUIDELINES.md` — benoem concreet elk verschil (kleuren, thema, typografie, spacing, componentgebruik).
5. Bevestig bij de eigenaar wat er met het huidige, niet-gecommitte Sprint 3-werk moet gebeuren (committen, meenemen in de redesign, of iets anders).
6. Maak pas dán een implementatieplan voor de **volledige Premium UI Redesign** (Sprint 3.1) en leg dat ter goedkeuring voor.

---

# 12. Definitieve instructie aan Claude Desktop

Vanaf dit moment draagt **Claude Desktop de volledige verantwoordelijkheid** voor de verdere ontwikkeling van NMZ GO.

**De belangrijkste regel, zonder uitzondering:**

**Schrijf NOOIT direct code zonder eerst:**
1. De documentatie te lezen.
2. De codebase te analyseren.
3. Een plan te maken.
4. Goedkeuring te vragen aan de eigenaar.

**Pas daarna implementeren** — en ook dan: build draaien, fouten zelfstandig oplossen, een volledig overzicht geven, en pas na expliciete goedkeuring committen (zie hoofdstuk 9).

Dit document bevat zoveel mogelijk concrete, geverifieerde details uit de terminalsessie zodat er geen context verloren gaat bij de overstap. Waar iets een aanname of interpretatie is in plaats van een hard feit (zoals de reconstructie in hoofdstuk 7), is dat expliciet benoemd.

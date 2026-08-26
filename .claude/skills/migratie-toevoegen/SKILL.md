---
name: migratie-toevoegen
description: De volledige procedure voor een databasewijziging in NMZ GO — nummer kiezen, migratie schrijven, RLS-regels toepassen, toepassen op de database en verifiëren met de rollentest. Gebruik dit bij elke wijziging aan het schema, aan een RLS-policy, aan een SECURITY DEFINER-functie of aan een cron-job. Ook bij een wijziging die "klein" lijkt.
---

# Een migratie toevoegen aan NMZ GO

RLS is de **enige** autorisatiegrens in dit project — er zit geen API-server tussen die fouten opvangt. Behandel elke wijziging hier met dezelfde zorg als een wijziging aan een login-systeem. Deze procedure bestaat omdat elke stap erin ooit een keer is misgegaan.

## 1. Pak een vrij nummer

```bash
npm run migraties
```

Die print het eerstvolgende vrije nummer. **Verzin het niet zelf en tel niet met de hand.** Twee sessies die tegelijk werken pakken anders allebei hetzelfde nummer — dat is al gebeurd bij `027`, en later bij `030` en `031`, die daardoor allebei dubbel bestaan.

De pre-commit hook blokkeert een dubbel nummer, maar dan heb je het werk al gedaan.

## 2. Schrijf de migratie

Naamgeving: `NNN_waar_het_over_gaat.sql`, in het Nederlands, `snake_case`.

Harde regels:

- **Idempotent.** `if not exists`, `drop policy if exists` vóór opnieuw aanmaken. De migratie moet veilig twee keer kunnen draaien.
- **Nooit een bestaande, al uitgevoerde migratie wijzigen.** Altijd een nieuwe toevoegen. Ook niet "even snel een typefout".
- **Elke nieuwe tabel met gebruikersdata krijgt RLS én policies in dezelfde migratie.** Nooit een tabel zonder RLS live laten staan, ook niet tijdelijk.
- **`tenant_id` op elke nieuwe tabel**, `not null`, met `get_mijn_tenant()` als default, en elke policy toetst erop.
- **Verificatie-output aan het einde**, zodat direct zichtbaar is of het gelukt is.

## 3. Policies: de vier valkuilen

Alle vier zijn hier echt voorgekomen.

**Toets op bevoegdheid, niet op rolnaam.** Gebruik `mag_werk_beheren()`, `mag_gebruikers_beheren()` of `is_eigenaar()`. Een policy die letterlijk op `'beheerder'` toetst, sluit de eigenaar buiten — dat is precies wat er met `taak_opnieuw()` gebeurde. Dit is ook waarom het toevoegen van de rol `planner` één migratie was en geen zevenenveertig.

**Nooit een zelfreferentiële policy.** Een `exists`-subquery op dezelfde tabel als waar de policy op staat, geeft `42P17 infinite recursion`. Rolchecks lopen via de bestaande `SECURITY DEFINER`-functies, die buiten de RLS-context draaien.

**Nooit `or true`**, ook niet tijdelijk om te debuggen. `uitnodigingen_select` had letterlijk `true` als voorwaarde; daarmee kon een niet-ingelogde bezoeker alle uitnodigingstokens van alle tenants uitlezen.

**Een policy ziet `OLD` niet, een trigger wel.** Moet je een wijziging *van* een waarde tegenhouden — bijvoorbeeld: niemand mag zijn eigen rol veranderen — dan heb je een `before update`-trigger nodig. `with check` alleen is niet genoeg: Postgres valt dan terug op de `using`-clausule, en `id` verandert niet bij een update. Zo was elke kolom van het eigen profiel vrij bewerkbaar. Zet beide sloten erop.

## 4. Toepassen op de database

Dit is een **gedeelde productieomgeving met echte klussen erin**. Vraag expliciet toestemming voordat je iets uitvoert, en voer nooit ongevraagd destructieve SQL uit.

Toepassen kan via `apply_migration` of de SQL-editor van Supabase. Draai daarna de verificatiequery onderaan het migratiebestand.

Let op: er zijn migraties met een blok dat **bewust buiten de transactie staat** omdat het secrets uit de Vault nodig heeft (zoals blok G van `004_verwerkingswachtrij.sql`). Die moet de eigenaar handmatig draaien; ze horen niet in git met de sleutels erin.

## 5. Verifiëren — niet overslaan

Bij elke wijziging die RLS, een policy of een `SECURITY DEFINER`-functie raakt:

```
supabase/tests/rollentest.sql
```

Dat script bootst een rol na met `set local role authenticated` plus een JWT-claim, precies zoals PostgREST dat voor de app doet, en draait elke schrijfpoging terug — er wordt geen productiedata gewijzigd. Het is herbruikbaar en het is de reden dat de rol-escalatie destijds gevonden is vóórdat iemand er last van had.

Vind je een nieuw gat, breid het script dan uit met dat geval. Ruim testrijen na afloop op.

## 6. Afronden

- `npm run controle` — migratienummers, typecheck en tests in één.
- `CHANGELOG.md` bijwerken als de wijziging functioneel zichtbaar is.
- Werkt de app anders door deze migratie? Dan hoort dat ook in `.ai/ARCHITECTURE.md`, maar **alleen de regel of het besluit** — geen cijfers, die verouderen.

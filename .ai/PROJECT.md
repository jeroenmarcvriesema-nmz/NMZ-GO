# PROJECT.md — Doel, doelgroep en scope van NMZ GO

## Doel van NMZ-GO

NMZ GO is een interne webapplicatie waarmee monteurs en beheerders **werkbonnen** (werkopdrachten) digitaal aanmaken, plannen, uitvoeren en afronden.

**Kernproces:**

```
Project aanmaken (beheerder)
  → Werkbon aanmaken binnen project (beheerder)
    → Medewerker(s) inplannen op werkbon
      → Medewerker voert taken uit, vinkt af, uploadt foto's per taak
        → Werkbon status: open → bezig → voltooid
          → Beheerder ziet voortgang op dashboard en in rapportages
```

**Wel in scope:**
- Werkbonnen (één ClickUp-taak = één adres = één werkbon), automatisch binnengehaald uit ClickUp of met de hand aangemaakt
- Klusgroepen en planning: wie werkt welke week waar, ploegindeling, uitloop
- Punten per werkbon, met titel, omschrijving, volgorde, voltooid-vlag en opmerking
- Foto-bewijs per punt (upload door de monteur)
- De werkdag: starten, werktijden, afronden — en automatisch afsluiten als iemand dat vergeet
- Voorzieningen per klus (containers, dixi's): besteld en afgemeld
- Dashboards voor kantoor: KPI's, werkvoorraad, activiteit per klus, meldingen, storingen
- Archief en rapporten, inclusief CSV/Excel-export
- Terugkoppeling naar ClickUp: status, opmerking, ploeg en planning

**Nog niet in scope** (zie [ROADMAP.md](./ROADMAP.md) voor details):
- PDF-generatie van het opleverrapport — de aanvraagknop staat live, de generatie zelf bestaat niet
- Foto's als bijlage naar de ClickUp-taak
- Signed URLs voor foto-opslag (huidige opzet: public bucket)
- Externe/klant-facing toegang

Dit is geen product dat naar buiten wordt verkocht — het is gereedschap voor één bedrijf, gebouwd om precies hún proces te ondersteunen. Wijzigingen worden getoetst aan "helpt dit een monteur of beheerder vandaag", niet aan generieke productmarktfit-overwegingen.

---

## Doelgroep

- **~30 medewerkers**, dagelijks gebruik.
- **Zes rollen**, hard gescheiden in UI én database (via RLS — zie `ARCHITECTURE.md`). De policies toetsen op **bevoegdheid**, niet op rolnaam; daarom was het toevoegen van de rol `planner` één migratie en niet zevenenveertig.

| Bevoegdheid | eigenaar | beheerder | uitvoerder | werkvoorbereider | planner | medewerker |
|---|---|---|---|---|---|---|
| Alles inzien, zoeken, plannen (`mag_werk_beheren`) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Werkbon aanmaken/wijzigen | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Gebruikers beheren, uitnodigen, rollen toekennen | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Storingen van de app zelf inzien | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Opleverrapport aanvragen | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Eigen werkbonnen zien | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Punten afvinken, foto's uploaden | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (eigen) |

De frontend-tegenhanger van deze tabel staat in **`src/lib/rollen.ts`** — één bron voor menu's én routes, met een test die het menu tegen de routes houdt. Die lijsten bepalen wat je te *zien* krijgt; de database bepaalt wat je *mag*.

- **Kantoor** (eigenaar, beheerder, uitvoerder, werkvoorbereider, planner) — plant werk in, beheert klussen en mensen, bekijkt dashboard en rapportages. Werkt vaker op desktop/laptop, moet ook op tablet kunnen werken.
- **Medewerker** (de zwamsaneerder/monteur) — ziet uitsluitend eigen werkbonnen, vinkt punten af, uploadt foto's als bewijs. Werkt vrijwel altijd op een **telefoon, vaak buiten of in een kruipruimte, met wisselende connectiviteit**.
- **Geen technische gebruikers.** Foutmeldingen, lege staten en flows moeten voor iemand zonder software-achtergrond direct begrijpelijk zijn, in het Nederlands.
- **Vertrouwde, niet-anonieme gebruikers.** Iedereen is een bekende medewerker van NMZ — dit verlaagt het risico op kwaadwillend gedrag, maar verhoogt het belang van **correcte RLS tussen rollen** (een medewerker mag nooit werkbonnen van een collega zien of wijzigen).

Elke UI- en UX-beslissing wordt getoetst aan: "kan een monteur dit met één duim, in de zon, met een paar procent batterij, zonder uitleg gebruiken?"

---

## Huidige status

De app draait in productie en wordt door echte monteurs op echte klussen gebruikt.

> **Wil je de cijfers? Meet ze.** Draai `supabase/stand.sql` — werkbonnen, punten, foto's, opleveringen, wie er in het veld uploadt. Hier staan ze bewust niet: dit document heeft maandenlang getallen bevat die verouderden zonder dat iemand het merkte, en een sessie heeft daar verkeerde conclusies uit getrokken. Zie `CLAUDE.md` → Geen cijfers in documentatie.

De verhouding die er op dit moment toe doet, en die niet uit een telling blijkt: **de veldtest loopt tot aan de opleverknop, en niet verder.** Monteurs vinken af en uploaden foto's op echte adressen. Maar er is nog geen enkele klus opgeleverd, en dus is alles daarachter — foto's als bijlage naar ClickUp, status terug naar `opgeleverd`, de bucket opruimen, het opleverrapport als PDF — nog nooit één keer echt gelopen. Dat is het grootste onbewezen stuk van de app; zie `ROADMAP.md` en `FEATURE_BACKLOG.md`.

Wat wél bevestigd werkend is:

- Auth (login, sessieherstel, logout, rolgebaseerde redirect) en RLS over zes rollen, met een herbruikbare rollentest in `supabase/tests/rollentest.sql`.
- De ClickUp-synchronisatie in beide richtingen: werk met status `volgende week` stroomt binnen inclusief werkopdracht, de punten worden er met een deterministische parser uitgelezen, en ploeg/planning/status schrijven direct terug.
- De werkdagflow op de telefoon: starten, punten afvinken met foto, werktijden, afronden.
- Een geautomatiseerde testsuite (Vitest), en CI die bij elke push typecheckt, test en bouwt.

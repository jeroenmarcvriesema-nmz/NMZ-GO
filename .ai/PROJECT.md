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
- Projecten (met status: actief, niet_gestart, op_schema, vertraging, afgerond)
- Werkbonnen (met status: open, bezig, voltooid) gekoppeld aan een project
- Taken per werkbon, met titel, omschrijving, volgorde, voltooid-vlag en opmerking
- Foto-bewijs per taak (upload door medewerker)
- Planning van medewerkers op werkbonnen/projecten
- Beheerdersdashboard: KPI's, activiteitenfeed, meldingen, projecttabel
- Rapportages

**Nog niet in scope** (zie [ROADMAP.md](./ROADMAP.md) voor details):
- PDF-export van rapporten
- Signed URLs voor foto-opslag (huidige opzet: public bucket)
- Geautomatiseerde tests
- Externe/klant-facing toegang

Dit is geen product dat naar buiten wordt verkocht — het is gereedschap voor één bedrijf, gebouwd om precies hún proces te ondersteunen. Wijzigingen worden getoetst aan "helpt dit een monteur of beheerder vandaag", niet aan generieke productmarktfit-overwegingen.

---

## Doelgroep

- **~30 medewerkers**, dagelijks gebruik.
- **Twee rollen**, hard gescheiden in UI én database (via RLS — zie `ARCHITECTURE.md`):

| Functie | Beheerder | Medewerker |
|---|---|---|
| Alle werkbonnen zien | ✅ | ❌ |
| Eigen werkbonnen zien | ✅ | ✅ |
| Werkbon aanmaken | ✅ | ❌ |
| Taken afvinken | ✅ | ✅ (eigen) |
| Foto's uploaden | ✅ | ✅ (eigen) |
| Medewerkers beheren | ✅ | ❌ |
| Dashboard | ✅ | ❌ |

- **Beheerder** — plant werk in, maakt projecten/werkbonnen aan, beheert medewerkers, bekijkt dashboard en rapportages. Werkt vaker op desktop/laptop, moet ook op tablet kunnen werken.
- **Medewerker** — ziet uitsluitend eigen werkbonnen, vinkt taken af, uploadt foto's als bewijs. Werkt vrijwel altijd op een **telefoon, vaak buiten, met wisselende connectiviteit**.
- **Geen technische gebruikers.** Foutmeldingen, lege staten en flows moeten voor iemand zonder software-achtergrond direct begrijpelijk zijn, in het Nederlands.
- **Vertrouwde, niet-anonieme gebruikers.** Iedereen is een bekende medewerker van NMZ — dit verlaagt het risico op kwaadwillend gedrag, maar verhoogt het belang van **correcte RLS tussen rollen** (een medewerker mag nooit werkbonnen van een collega zien of wijzigen).

Elke UI- en UX-beslissing wordt getoetst aan: "kan een monteur dit met één duim, in de zon, met een paar procent batterij, zonder uitleg gebruiken?"

---

## Huidige status

- Laatste sprint-checkpoint: **Sprint 2.1 — werkende versie** (zie [SPRINTS.md](./SPRINTS.md)).
- Auth-flow (login, sessieherstel, logout, rolgebaseerde redirect) en RLS-basis (rolscheiding beheerder/medewerker) zijn bevestigd werkend — zie `CHANGELOG.md` in de projectroot voor de opgeloste kritieke bugs (auth-race-condition, RLS-recursie).
- Op het moment van schrijven van deze documentatie staan er **niet-gecommitte wijzigingen** klaar rond projecten/planning (`Projecten.tsx`, `ProjectDetail.tsx`, `Planning.tsx`, `useProjecten.ts`) — zie `SPRINTS.md` voor de actuele sprintstatus.
- PDF-export is nog niet geïmplementeerd (bevestigd bekend aandachtspunt, zie README en `ROADMAP.md`).

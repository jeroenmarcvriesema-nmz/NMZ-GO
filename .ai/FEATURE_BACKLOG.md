# FEATURE_BACKLOG.md — Toekomstige ontwikkeling

Deze backlog is richtinggevend, geen vaste planning. Volgorde en inhoud van een sprint worden pas definitief bevestigd bij de start van die sprint (zie [`SPRINTS.md`](./SPRINTS.md)). Prioriteit: **Hoog** (eerstvolgende, concrete waarde) · **Middel** (waardevol, geen blokkerende afhankelijkheid) · **Laag** (nice-to-have, verkennen voordat gebouwd wordt).

Elk item wordt vóór opname in een sprint getoetst aan `PROJECT.md` (helpt dit een beheerder/medewerker vandaag) en aan de scope-regels in `CLAUDE.md`.

---

## Sprint 3 — Projecten & Planning afronden (afgerond, mock-data scope)

**Status: uitgevoerd** — zie `SPRINTS.md` voor het volledige verslag en `HANDOVER.md` voor de overdracht. Scope is bewust beperkt gebleven tot de UI op mock data; de Supabase-koppeling/RLS hieronder is doorgeschoven naar Sprint 4.

| Item | Status |
|---|---|
| Projectenoverzicht + projectdetail | Gereed op mock data (`Projecten.tsx`/`ProjectDetail.tsx`/`useProjecten.ts`) |
| Planningscherm | Gereed op mock data (`Planning.tsx`), incl. koppeling ProjectDetail ↔ planning per project |
| Dashboard-integratie | Gereed — 6 KPI's op basis van projectstatus |
| Volledig koppelen aan Supabase + RLS voor projecten | **Verplaatst naar Sprint 4** |

---

## Sprint 3.1 — Premium UI Redesign (nieuwe eerstvolgende prioriteit)

*Zie `HANDOVER.md` hoofdstuk 6/7/10 — dit is naar voren gehaald omdat de eigenaar expliciet een premium, dark-mode-primaire visuele stijl verwacht die Sprint 3 nog niet heeft doorgevoerd.*

| Item | Prioriteit | Toelichting |
|---|---|---|
| Volledige visuele redesign Dashboard/Projecten/ProjectDetail/Planning | Hoog | Conform `PRODUCT_VISION.md`/`UI_GUIDELINES.md`: dark-mode-primair, light mode volledig ondersteund |
| Theme-toggle + opgeslagen voorkeur | Hoog | Zie `PRODUCT_VISION.md` → Thema-strategie |
| Ontbrekende UI-primitives waar de redesign ze nodig heeft | Middel | `Select`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`, generieke `Table` |
| Skeleton loaders | Middel | Voor dashboardlijsten en tabellen, zie `UI_GUIDELINES.md` → Loading states |

---

## Sprint 4 — Echte backend voor Projecten & Planning

| Item | Prioriteit | Toelichting |
|---|---|---|
| Nieuwe `projecten`-tabel + migratie | Hoog | Incl. `project_id`-FK op `werkbonnen`; `Project` heeft velden (`opdrachtgever`, `startdatum`, `einddatum`, `opmerkingen`) die niet op `werkbonnen` bestaan |
| RLS-policies voor projecten | Hoog | Consistent met bestaande rolscheiding (zie `ARCHITECTURE.md`) |
| `useProjecten.ts` herschrijven naar echte Supabase-queries | Hoog | Vervangt de huidige mock-implementatie volledig |

---

*(De vroegere "Sprint 4 — Design-systeem volwassenheid" is opgegaan in Sprint 3.1 hierboven, incl. skeleton loaders — zie `UI_GUIDELINES.md` → Loading states voor die toevoeging.)*

## Sprint 5 — Rapportages & inzicht

| Item | Prioriteit | Toelichting |
|---|---|---|
| PDF-export van rapporten | Hoog | Bevestigd bekend gat sinds de MVP (zie README/`ROADMAP.md`); vereist architecturale keuze (client-side vs. edge function) — eerst afstemmen, zie `ARCHITECTURE.md` |
| Dashboard analytics-uitbreiding | Middel | Trends over tijd (bv. voortgang per week), niet alleen actuele snapshot-KPI's |
| AI-rapportages | Laag | Automatisch gegenereerde samenvatting van een werkbon/project op basis van taken, opmerkingen en foto's — verkennend; vereist een expliciete beslissing over welke AI-dienst/kosten hierbij horen voordat dit gebouwd wordt |

---

## Sprint 6 — Veldgebruik verbeteren

*Gericht op de medewerker-rol, de grootste en meest mobiele gebruikersgroep (zie `PROJECT.md` → Doelgroep).*

| Item | Prioriteit | Toelichting |
|---|---|---|
| Foto-annotaties | Middel | Eenvoudige markeringen/pijlen op een geüploade foto, om een probleem aan te wijzen |
| GPS / locatiecontrole | Laag | Locatie vastleggen bij het starten van een werkbon, ter verificatie — privacy-implicaties eerst bespreken (zie `ARCHITECTURE.md` → Security) |
| Offline modus (basis) | Laag | Taken kunnen afvinken/foto's queuen zonder verbinding, synchroniseren zodra er weer verbinding is — grote architecturale impact, apart te plannen los van een reguliere sprint |
| Push notificaties | Laag | Bv. melding bij nieuwe werkbon-toewijzing — vereist een notificatiedienst/service worker, apart te evalueren |

---

## Toekomst (nog niet gepland)

Ideeën die het waard zijn om te bewaren, maar nog niet aan een sprint zijn toegewezen — zie ook [`ROADMAP.md`](./ROADMAP.md) voor de architecturale/technische tegenhangers hiervan:

- **Planning-optimalisatie** — automatische suggesties voor het inplannen van medewerkers op basis van beschikbaarheid/locatie, ná een eerste, handmatige versie van het planningscherm (Sprint 3).
- **Signed URLs voor foto-opslag** — vervanging van de huidige public bucket (zie `ARCHITECTURE.md`/`ROADMAP.md`).
- **Geautomatiseerde tests** — introductie van een testsuite, los van reguliere featurewerk (zie `TESTING.md`).
- **Medewerkersstatistieken** — individuele prestatie-/workload-overzichten voor beheerders, met aandacht voor hoe dit gepresenteerd wordt (dit blijft interne kwaliteitscontrole, geen surveillance-achtige weergave).
- **Multi-vestiging/multi-team-ondersteuning** — alleen relevant als NMZ zelf structureel groeit; niet vooruit bouwen zonder concrete aanleiding (zie `CLAUDE.md` → Projectvisie: klein en overzichtelijk blijven).

Nieuwe ideeën worden hier toegevoegd zodra ze genoemd worden, ook als ze nog niet geprioriteerd zijn — deze lijst is de plek om ze niet kwijt te raken.

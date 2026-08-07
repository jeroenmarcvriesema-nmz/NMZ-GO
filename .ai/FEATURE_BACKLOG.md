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

## Sprint 4 — Echte backend voor Projecten & Planning ✅ afgerond

Opgegaan in **Epic 4, fase 0**. Zie `SPRINTS.md` en hoofdstuk 0 van `HANDOVER.md`.

| Item | Status |
|---|---|
| Nieuwe `projecten`-tabel + migratie | Gereed — migratie 002, incl. `project_id`-FK op `werkbonnen` |
| RLS-policies voor projecten | Gereed — via `get_mijn_rol()` + nieuwe `get_mijn_tenant()` |
| `useProjecten.ts` herschrijven naar echte Supabase-queries | Gereed — commit `587ba30` |
| Multi-tenancy (niet oorspronkelijk gepland) | Gereed — `tenant_id` op alle tabellen, vooruitlopend op SaaS/white label |

---

## Epic 4 — Intelligent Work Preparation (nieuwe hoofdlijn)

De koppeling met ClickUp en de intelligentielaag daarbovenop. **Volledige architectuur:** https://claude.ai/code/artifact/68edd097-0c39-4c48-9789-dad233cf8e64

Kern: werkvoorbereiders werken door in ClickUp, NMZ GO neemt de uitvoering over. Werk met status `volgende week` stroomt automatisch binnen, inclusief tekening en werkopdracht; de uit te voeren punten worden uit die werkopdracht gelezen en als taken op de werkbon gezet.

| Fase | Inhoud | Prioriteit |
|---|---|---|
| 0 | Projecten-tabel, tenant-isolatie | ✅ Afgerond |
| 1 | Serverlaag (Edge Functions) + verwerkingswachtrij | Hoog — volgende stap |
| 2 | ClickUp lezen, eenrichtingsverkeer | Hoog |
| 3 | Webhooks + waarneembaarheid | Hoog |
| 4 | Documenten binnenhalen, versiebeheer, privé-opslag | Hoog |
| 4b | Werkopdracht uitlezen naar taken (deterministische parser) | Hoog |
| 5 | Terugkoppeling naar ClickUp | Hoog — voorwaarde voor productie |
| — | Opleverrapport, gelijk aan het bestaande document | Hoog |
| 6–10 | Kennisbank, calculatie, workflowmotor, AI-assistent | Geen datum |

**Uitgesteld op verzoek van de eigenaar:** de materiaalberekening (later, en dan gericht op het aantal vloerplaten — vuistregel ±1,5 m² per Top Floor plaat) en het uitlezen van maatvoering uit tekeningen.

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

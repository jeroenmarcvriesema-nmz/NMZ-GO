# ARCHITECTURE.md — Architectuur, stack, database en security

## Architectuurprincipe

NMZ GO is een **client-only single-page application**: er is geen eigen backend-server. De React-app praat rechtstreeks met Supabase (Postgres + Auth + Storage), en **Row Level Security (RLS) is de enige autorisatielaag**. Er is geen custom API-server die als extra beveiligingslaag dient — dit maakt RLS-correctheid architectuur-kritiek, niet optioneel (zie "Security" hieronder).

## Lagen

Van boven naar beneden:

```
pages/          → orkestreert een scherm: roept hooks aan, geeft data door aan componenten
components/     → presentational: ontvangt props, toont UI, geen eigen datatoegang
hooks/          → enige plek die met Supabase praat, retourneert { data, loading, error, refetch/mutaties }
lib/supabase.ts → de ene Supabase-client, enige plek waar de client wordt aangemaakt
store/          → Zustand, uitsluitend voor auth-state (profile/loading/error), geen domeindata
types/          → gedeelde TypeScript-contracten tussen alle lagen hierboven
supabase/       → database schema + RLS-policies, de daadwerkelijke autorisatiegrens
```

**Regel:** pagina's praten nooit rechtstreeks met Supabase — alleen via een hook uit `src/hooks/`.

## Auth-architectuur

Eén `AuthInitializer`-component in `App.tsx` initialiseert sessie en auth-listener **eenmalig** voor de hele app:

```
App opstart
  └── AuthInitializer (eenmalig)
        ├── getSession() → bestaande sessie?
        │     ja → fetchProfile(userId)
        │     nee → loading = false → /login
        └── onAuthStateChange()
              SIGNED_IN  → fetchProfile(userId)
              SIGNED_OUT → profile = null

fetchProfile(userId)
  └── SELECT * FROM profiles WHERE id = ?
        gevonden    → profile in store → RootRedirect → /dashboard of /mijn-werkbonnen
        niet gevonden (PGRST116) → automatisch aanmaken → profiel in store
        fout        → error in store → foutscherm
```

Route guards (`AuthGuard`, `BeheerderGuard` in `App.tsx`) lezen **alleen** uit de Zustand-store — ze starten nooit hun eigen listener. Dit is geen stijlkeuze maar een opgeloste bug: meerdere listeners veroorzaakten eerder een race condition met een oneindige laadstatus (zie `CHANGELOG.md` in de projectroot en `CLAUDE.md` → Verboden acties).

## Routing

`react-router-dom`, centraal gedefinieerd in `src/App.tsx`. Elke route is expliciet gekoppeld aan een guard:

- `BeheerderGuard` — beheerder-only routes: `/dashboard`, `/projecten`, `/projecten/:id`, `/planning`, `/werkbonnen`, `/werkbonnen/nieuw`, `/werkbonnen/:id`, `/medewerkers`, `/rapporten`.
- `AuthGuard` — routes voor elke ingelogde gebruiker: `/mijn-werkbonnen`, `/werkbon/:id`, `/afgerond`.
- Zonder guard: `/login`, `/registreer`, `/` (→ `RootRedirect`, stuurt door op basis van rol).
- Onbekende routes (`*`) → redirect naar `/`.

Elke nieuwe route wordt aan een van deze guards gekoppeld — er is geen route zonder guard buiten de expliciet genoemde uitzonderingen.

## State-architectuur

Precies **één globale store** (`authStore`, Zustand) voor sessie/profiel. Alle overige data (werkbonnen, taken, projecten, planning) leeft **lokaal per hook-aanroep** via `useState`/`useEffect`, niet in een globale store. Dit is bewust: domeindata hoeft niet cross-page gedeeld te worden, en het voorkomt stale-cache-problemen.

Geen server-side rendering en geen custom backend. Wél twee Supabase edge functions in `supabase/functions/`, allebei voor werk dat niet in een browser thuishoort:

| Functie | Rol | JWT |
|---|---|---|
| `verwerker` | De verwerkingswachtrij: ClickUp-synchronisatie, foto's, statusterugkoppeling, opruimen. Aangeroepen door pg_cron of via `clickup_hartslag()`. Draait op de service-role. | uit (cron) |
| `opdracht-lezen` | Eén werkopdracht-PDF lezen en de punten teruggeven. Schrijft niets weg en gebruikt géén service-role: hij werkt met het token van de aanroeper, dus RLS geldt onverkort. | aan |
| `ploeg-bijwerken` | De namenlijst van het ClickUp-medewerkersveld ophalen en het personenregister aanvullen (knop "Uit ClickUp ophalen"). Service-role uitsluitend voor het token uit Vault; alle lees- en schrijfacties lopen via de client van de aanroeper, dus onder RLS. | aan |

Wat er in de database vanzelf draait (pg_cron), zoals het er nu écht bij staat:

| Job | Ritme | Doet |
|---|---|---|
| `nmzgo-verwerker` | elke minuut | trekt de verwerkingswachtrij leeg via de edge function |
| `nmzgo-clickup-hartslag` | elke 5 min, 04–19 UTC | zet een synchronisatieronde in de wachtrij |
| `nmzgo-werkdagen-afsluiten` | elk uur op :05 | sluit werkdagen die niet zijn afgemeld op 17:00 (migratie 031) |
| `nmzgo-fotos-opruimen` | dagelijks 03:15 UTC | zet een opruimronde voor de fotobucket in de wachtrij (migratie 027) |

Twee modules worden door meer dan één functie gebruikt en staan daarom bewust op één plek: `verwerker/ontleden.ts` (het ontleden van een werkopdracht) en `verwerker/register.ts` (het personenregister gelijkhouden met ClickUp). Een tweede kopie loopt uit de pas, en dan hangt de uitkomst af van welke weg iets toevallig neemt.

De PDF-leeslaag (`unpdf`) staat daarmee uitsluitend op de server — de frontend heeft er geen dependency voor. De parser zelf (`verwerker/ontleden.ts`) is één bestand zonder Deno-afhankelijkheden, wordt door beide routes gebruikt en is getest in `tests/ontleden.test.ts`; een handmatig aangereikte opdracht levert dus dezelfde punten op als dezelfde opdracht via ClickUp.

Zie `ROADMAP.md` voor waar dit richting de toekomst zou kunnen uitbreiden (bv. voor PDF-generatie) — dat is een architecturale beslissing die eerst expliciet met de gebruiker wordt besproken.

---

## Technologie-stack

| Laag | Keuze | Rol |
|---|---|---|
| Framework | React 18 | UI |
| Build tool | Vite 5 | Dev server + build |
| Taal | TypeScript 5 (`strict: true`) | Type-veiligheid |
| Styling | Tailwind CSS 3 | Utility-first styling |
| Backend | Supabase (Postgres, Auth, Storage) | Data, authenticatie, bestandsopslag |
| Client state | Zustand | Uitsluitend auth-state |
| Routing | react-router-dom 6 | Client-side routing |
| Datums | date-fns | Formattering/berekening |
| Class-utilities | clsx (via `cn()` in `lib/utils.ts`) | Conditionele Tailwind-classes |
| Icons | @tabler/icons-react | Iconenset |
| Hosting | Netlify | Static hosting + SPA-redirect (`netlify.toml`) |

Dit is een bewust kleine, stabiele stack. Elke toevoeging aan `package.json` is een architecturale beslissing (zie `CODING_STANDARDS.md` en `CLAUDE.md` → Verboden acties).

---

## Mappenstructuur

```
nmzgo/
├── src/
│   ├── App.tsx                 # Router, AuthInitializer, route guards, RootRedirect
│   ├── main.tsx                # Entry point
│   ├── index.css                # Tailwind-lagen + globale basisstijlen
│   ├── vite-env.d.ts             # Vite/env types
│   ├── components/
│   │   ├── ui/                    # Generieke, domein-loze bouwstenen: Button, Card, Badge, Input, Modal, Avatar, ProgressBar, Spinner
│   │   ├── layout/                  # Sidebar, MobileNav, Topbar, PageWrapper
│   │   ├── dashboard/                 # KpiCard, StatCard, ActivityFeed, MeldingItem, ProjectTabel
│   │   ├── werkbon/                     # WerkbonKaart e.d.
│   │   └── taak/                          # TaakItem (afvinken + foto-upload)
│   ├── pages/
│   │   ├── auth/                            # Login, Registreer
│   │   ├── beheerder/                         # Dashboard, Projecten, ProjectDetail, Planning, Werkbonnen, WerkbonNieuw, WerkbonDetail, Medewerkers, Rapporten
│   │   └── medewerker/                          # MijnWerkbonnen, WerkbonUitvoeren, Afgerond
│   ├── hooks/                                    # useAuth, useWerkbonnen, useTaken, useFotos, useProjecten, useDashboard, useWerkdag
│   ├── lib/                                        # supabase.ts (client), utils.ts (cn, formatters, helpers)
│   ├── store/                                        # authStore.ts (Zustand)
│   └── types/                                          # index.ts — gedeelde interfaces/types
└── supabase/
    └── migrations/                                        # Oplopend genummerde SQL-migraties (001_initial.sql, ...)
```

**Regels:**
- Generiek UI-element → `components/ui/`. Domein-specifiek → eigen submap onder `components/`.
- Elke datatoegang-behoefte krijgt een hook in `hooks/use<Domein>.ts`.
- Nieuwe SQL-wijziging → nieuwe, oplopend genummerde migratie (nooit een bestaande wijzigen).
- Gebruik het path-alias `@/` (wijst naar `src/`), geen `../../../`-ketens.

---

## Database

Kerntabellen (zie `src/types/index.ts` voor de TypeScript-contracten en `supabase/migrations/001_initial.sql` voor het schema):

| Tabel | Rol |
|---|---|
| `profiles` | Gebruikersprofiel: naam, rol (`beheerder`/`medewerker`), actief-vlag |
| `werkbonnen` | Werkopdracht: bonnummer, projectnaam, adres, opdrachtgever, datum, status |
| `taken` | Taak binnen een werkbon: titel, omschrijving, voltooid, opmerking, volgorde |
| `fotos` | Foto-bewijs per taak, gekoppeld aan `werkbon_id`/`taak_id`, verwijst naar Storage |
| `werkbon_medewerkers` | Koppeltabel: welke medewerker(s) op welke werkbon |
| `uitnodigingen` | Token-gebaseerde uitnodigingsflow voor nieuwe accounts |

**Regels:**
- **Migraties zijn append-only.** Elke schemawijziging is een nieuwe, oplopend genummerde file in `supabase/migrations/` (bv. `002_...sql`). Een migratie die al op een omgeving is uitgevoerd, wordt **nooit** met terugwerkende kracht aangepast.
- **Migraties zijn idempotent**: `if not exists`, `drop policy if exists` vóór opnieuw aanmaken, etc. — veilig opnieuw uitvoerbaar.
- **Kolomnamen:** `snake_case`, Nederlandse domeintaal, consistent met bestaande tabellen.
- **Indexen** op veelgebruikte filter-/joinkolommen (status, datum, `werkbon_id`, `medewerker_id`) — zoals al toegepast in `001_initial.sql`.
- **Elke nieuwe tabel met gebruikersdata krijgt direct RLS-policies**, in dezelfde migratie — nooit een tabel zonder RLS live laten staan, ook niet tijdelijk.
- **Foreign keys expliciet**, met bewust gekozen `on delete`-gedrag.
- **Verificatie-output aan het einde van een migratie** (zoals in `001_initial.sql`) om direct te kunnen zien of de migratie geslaagd is.

---

## Supabase-regels

- **Alle database-toegang via hooks in `src/hooks/`.** Geen rechtstreekse `supabase.from(...)`-calls in pagina's of presentational components.
- **RLS staat altijd aan** op elke tabel met gebruikersdata.
- **Nooit een zelfreferentiële policy** (een `EXISTS`-subquery op dezelfde tabel als waar de policy op staat) — veroorzaakte eerder `42P17 infinite recursion`. Rolchecks lopen via de bestaande `SECURITY DEFINER`-functie `get_mijn_rol()`, die buiten de RLS-context draait.
- **Policies gesplitst per actie** (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) met correcte `WITH CHECK`, in plaats van één brede `FOR ALL`-policy — zeker bij koppeltabellen zoals `werkbon_medewerkers`.
- **Nooit `or true`** of andere overbroad-condities, ook niet tijdelijk.
- **Nooit de `service_role`-key in client-code.** De frontend gebruikt uitsluitend `VITE_SUPABASE_ANON_KEY`; beveiliging loopt via RLS.
- **Storage** (`werkbon-fotos` bucket): huidige opzet is public voor directe URL's. Omzetten naar signed URLs is een bewuste, apart gedocumenteerde toekomstige stap (zie `ROADMAP.md`).
- **Env-variabelen verplicht valideren bij opstarten** (zie `lib/supabase.ts`) — geen stille fallback naar `undefined`.

---

## Security

- **RLS is de enige autorisatiegrens.** Behandel elke RLS-wijziging met dezelfde zorgvuldigheid als het wijzigen van een login-systeem.
- **Rolchecks lopen via `get_mijn_rol()`**, nooit via een losse, opnieuw uitgevonden query binnen een policy.
- **Nooit vertrouwen op client-side rolchecks als beveiliging.** UI-gedrag zoals `BeheerderGuard` is UX, geen beveiliging — de echte grens ligt in de database-policies.
- **Secrets** (Supabase keys, toekomstige API-keys) altijd via env-variabelen, nooit hardcoded, nooit gecommit. `.env.local` staat niet in git; `.env.example` bevat alleen placeholders.
- **Alleen de anon key in de frontend.** Elke actie die meer rechten nodig heeft dan de anon key + RLS toestaat, hoort niet client-side thuis zonder architecturaal overleg.
- **Foto-storage is public voor directe URL's** — wees je hiervan bewust bij het uploaden van gevoelige inhoud (zie `ROADMAP.md` voor de geplande overstap naar signed URLs).
- **Uitnodigingen (`uitnodigingen`-tabel):** token-gebaseerde flow, policies bewust beperkt tot beheerder of de betrokken ingelogde gebruiker — breid dit nooit stilzwijgend uit.
- **Elke wijziging aan auth, RLS of storage-policies wordt getest met beide rollen** vóórdat deze als afgerond geldt (zie `GIT_WORKFLOW.md` → testprocedure).

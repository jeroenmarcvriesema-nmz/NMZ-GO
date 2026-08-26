# ARCHITECTURE.md — Architectuur, stack, database en security

## Architectuurprincipe

NMZ GO is een **single-page application met een smalle serverlaag erachter**. De React-app praat rechtstreeks met Supabase (Postgres + Auth + Storage), en **Row Level Security (RLS) is de enige autorisatielaag voor alles wat de browser doet**. Er is geen custom API-server die als extra beveiligingslaag dient — dit maakt RLS-correctheid architectuur-kritiek, niet optioneel (zie "Security" hieronder).

Daarnaast draaien er drie **Supabase Edge Functions** plus een verwerkingswachtrij in Postgres. Die zijn er alleen voor werk dat niet in een browser thuishoort: een ClickUp-token hoort niet in clientcode, een PDF uitlezen hoort niet op de telefoon van een monteur, en een synchronisatieronde moet ook draaien als niemand is ingelogd. Zie "Serverlaag" hieronder.

**Deze splitsing is de belangrijkste architecturale grens in het project.** Alles wat de gebruiker doet, loopt onder RLS met de anon key. Alles wat de service-role nodig heeft, staat in een edge function — en nooit andersom.

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

`react-router-dom`, centraal gedefinieerd in `src/App.tsx`. Elke route zit achter een **slot**. De vier sloten en welk pad welk slot heeft, staan in **`src/lib/rollen.ts`** (`ROUTE_SLOT`) — dat bestand is de bron, niet deze tabel:

| Slot | Wie erin mag | Routes |
|---|---|---|
| `kantoor` | wie werk mag beheren (alles behalve `medewerker`) | `/dashboard`, `/projecten`, `/planning`, `/werkbonnen`, `/werkbonnen/nieuw`, `/rapporten`, `/archief`, `/uitloop`, `/lopend` |
| `gebruikersbeheer` | eigenaar, beheerder | `/medewerkers`, `/medewerkers/:id` |
| `eigenaar` | alleen de eigenaar | `/storingen` |
| `ingelogd` | elke ingelogde gebruiker | `/mijn-werkbonnen`, `/mijn-week`, `/mijn-bonnen`, `/afgerond` |

- Zonder slot: `/login`, `/registreer`, `/wachtwoord-vergeten`, `/wachtwoord-herstellen`, `/` (→ `RootRedirect`, stuurt door via `startPad()`).
- Onbekende routes (`*`) → redirect naar `/`.

**Waarom dit één bestand is:** de routelijst stond eerder op twee plekken — in `App.tsx` voor de routes en in `useAuth.ts` voor de menu's. Die liepen uit de pas, met als gevolg een knop "Team" in de mobiele balk die een uitvoerder terugsmeet naar het dashboard. Nu is er één bron, en `tests/rollen.test.ts` houdt het menu tegen de routes.

Een nieuwe route voeg je dus op **twee** plekken toe: de route in `App.tsx` en het slot in `ROUTE_SLOT`. Doe je alleen het eerste, dan valt de test om.

Onthoud waar de grens ligt: een guard is **UX, geen beveiliging**. De echte grens ligt in de RLS-policies.

## State-architectuur

**Geen enkele domeindata in een globale store.** Werkbonnen, taken, planning: die leven lokaal per hook-aanroep via `useState`/`useEffect`. Dat is bewust — domeindata hoeft niet cross-page gedeeld te worden, en het voorkomt stale-cache-problemen.

Er zijn drie kleine Zustand-stores, elk voor één zorg die wél door de hele app heen loopt:

| Store | Waarvoor |
|---|---|
| `authStore` | sessie en profiel |
| `themeStore` | licht/donker, met `persist` |
| `toastStore` | actiefeedback (`toast.goed/fout/info`) |

Dat is bewust dezelfde vorm en geen nieuw state-systeem: één kleine store per zorg. Een vierde store toevoegen voor domeindata is dat wél, en valt onder `CLAUDE.md` → Verboden acties.

## Serverlaag

Geen server-side rendering en geen custom API-server. Wél drie Supabase edge functions in `supabase/functions/`, alledrie voor werk dat niet in een browser thuishoort:

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
│   ├── App.tsx            # Router, AuthInitializer, route guards, RootRedirect, Toaster
│   ├── main.tsx           # Entry point
│   ├── index.css          # Tailwind-lagen + globale basisstijlen
│   ├── components/
│   │   ├── ui/            # Generieke bouwstenen: Button, Card, Badge, Input, Select, Modal,
│   │   │                  #   Dropdown, Avatar, ProgressBar, Voortgangsring, Spinner,
│   │   │                  #   SectionHeading, EmptyState, ErrorState, Toaster
│   │   ├── layout/        # Sidebar, MobileNav, Topbar, PageWrapper, Weekkiezer, Weekkop,
│   │   │                  #   Meldingen, Foutvanger
│   │   ├── dashboard/     # KpiCard, StatCard, ActivityFeed, MeldingItem, ProjectTabel,
│   │   │                  #   Standbalk, Weekdoorkijk, Voorzieningentegels
│   │   ├── werkbon/       # Klusinfo, Klusploeg, Klusplanning, Klusuitvoering, Klusacties,
│   │   │                  #   Klusactiviteit, WerkbonKaart, PlanningKaart, Werktijden,
│   │   │                  #   Werkdocumenten, DocumentKiezer, PuntToevoegen, Opleverrapport,
│   │   │                  #   Synchronisatie
│   │   └── taak/          # TaakItem (afvinken + foto-upload), Fotoviewer
│   ├── pages/
│   │   ├── auth/          # Login, Registreer, WachtwoordVergeten, WachtwoordHerstellen
│   │   ├── beheerder/     # Dashboard, Lopend, Voorzieningen, Projecten, Planning, Werkbonnen,
│   │   │                  #   WerkbonNieuw, WerkbonDetail, Medewerkers, PersoonDetail,
│   │   │                  #   Rapporten, Archief, Uitloop, Storingen
│   │   └── medewerker/    # MijnWerkbonnen (Vandaag), MijnBonnen, MijnWeek, WerkbonUitvoeren,
│   │                      #   Afgerond
│   ├── hooks/             # 15 stuks — enige plek die met Supabase praat
│   ├── lib/               # supabase.ts (client), rollen.ts (sloten), klusstand.ts (kleurtaal),
│   │                      #   klusgroepen.ts, planning.ts, opdracht.ts, clickup.ts, export.ts,
│   │                      #   zoeken.ts, voorzieningen.ts, bestelstand.ts, vervolgwerk.ts,
│   │                      #   afbeelding.ts, foutfilter.ts, foutmelder.ts, uploadfout.ts,
│   │                      #   versie.ts, utils.ts
│   ├── store/             # authStore.ts, themeStore.ts, toastStore.ts
│   └── types/             # index.ts — gedeelde interfaces/types
├── tests/                 # Vitest, draait in Node — geen browser, geen database
└── supabase/
    ├── functions/         # verwerker/ (7 bestanden), opdracht-lezen/, ploeg-bijwerken/
    ├── migrations/        # Oplopend genummerde SQL-migraties (001_initial.sql, ...)
    └── tests/             # rollentest.sql — herbruikbaar na elke RLS-wijziging
```

**Regels:**
- Generiek UI-element → `components/ui/`. Domein-specifiek → eigen submap onder `components/`.
- Elke datatoegang-behoefte krijgt een hook in `hooks/use<Domein>.ts`.
- Nieuwe SQL-wijziging → nieuwe, oplopend genummerde migratie (nooit een bestaande wijzigen).
- Gebruik het path-alias `@/` (wijst naar `src/`), geen `../../../`-ketens.

---

## Database

Achttien tabellen (zie `src/types/index.ts` voor de TypeScript-contracten en de migraties voor het schema). **Elke tabel draagt `tenant_id`** — zie "Multi-tenancy" hieronder.

**Kern — het werk zelf:**

| Tabel | Rol |
|---|---|
| `werkbonnen` | Eén adres = één klus. Bonnummer, adres, opdrachtgever, datum, status, ClickUp-koppeling, opleverdatum en de vrije tekstblokken van het opleverrapport |
| `taken` | Punt binnen een werkbon: titel, omschrijving, voltooid, opmerking, volgorde |
| `fotos` | Foto-bewijs per punt, verwijst naar Storage. `fase` (voor/na), `clickup_geupload_op`, `opgeruimd_op` |
| `werkbon_medewerkers` | Koppeltabel: wie staat op welke klus, en of dat handmatig is gezet |
| `werkbon_voorzieningen` | Containers en dixi's per klus: besteld en afgemeld |
| `werkbon_gebeurtenissen` | Wat er met een klus is gebeurd — voedt de activiteitenfeed |
| `werkdag_logs` | Start, werktijden en afronding van een werkdag |

**Mensen en toegang:**

| Tabel | Rol |
|---|---|
| `profiles` | Gebruikersprofiel: naam, rol (zes waarden, zie `PROJECT.md`), actief-vlag |
| `personen` | Het personenregister uit ClickUp — namen die (nog) geen account hebben |
| `uitnodigingen` | Token-gebaseerde uitnodigingsflow voor nieuwe accounts |
| `tenants` | De klant/organisatie waaronder alle data valt |

**Serverlaag en beheer:**

| Tabel | Rol |
|---|---|
| `verwerkingstaken` | De wachtrij: wat de verwerker moet doen. RLS aan, **nul schrijfpolicies** — vullen kan alleen via `taak_aanmaken()` |
| `verwerkingsronden` | Wat een ronde heeft gedaan: gezien, verwerkt, overgeslagen, mislukt |
| `clickup_instellingen` | Lijst-ID's en veldnamen van de ClickUp-koppeling |
| `rapportages` | Aangevraagde opleverrapporten. Geen insert-policy: aanmaken kan alleen via `rapportage_aanvragen()` |
| `meldingen` | Attentiepunten voor kantoor |
| `fouten` | Crashes van de app zelf, gevoed door `Foutvanger`. Alleen voor de eigenaar (migratie 030) |
| `projecten` | Bestaat, maar staat leeg en wordt door `src/` niet meer gelezen — zie de waarschuwing hieronder |

> **`projecten` is een lege tabel zonder afnemer.** De projectenpagina draait op klusgroepen die uit de werkbonnen worden afgeleid (`lib/klusgroepen.ts`), niet op deze tabel. Nul rijen, en nul werkbonnen met een `project_id`. De tabel is bewust blijven staan, maar bouw er niets nieuws op zonder dat eerst te bespreken — wat een grote klus tot een project maakt is op dit moment het **opdrachtnummer**, en dat is overal leeg (zie `ROADMAP.md`).

### Multi-tenancy

Elke tabel heeft `tenant_id`, `not null`, met `get_mijn_tenant()` als default, en elke RLS-policy toetst erop. Dit is vooruitlopend op een mogelijke SaaS/white-label-toekomst ingebouwd (migratie 002), omdat tenant-isolatie achteraf toevoegen betekent dat elke policy herschreven moet worden.

Twee dingen om te weten:
- Een **tenant-verhuizing kan alleen via `service_role`**, niet via de app — ook niet door een beheerder. Dat is bewust (migratie 003, na een aangetoonde privilege escalation).
- Er is op dit moment **één tenant**. De isolatie is getest met een tweede, tijdelijke tenant in `supabase/tests/rollentest.sql`.

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
- **Toets op bevoegdheid, niet op rolnaam.** De `SECURITY DEFINER`-functies `mag_werk_beheren()`, `mag_gebruikers_beheren()` en `is_eigenaar()` zijn de bron; `get_mijn_rol()` en `get_mijn_tenant()` liggen eronder. Nooit een losse, opnieuw uitgevonden rolcheck binnen een policy — dat is precies waarom het toevoegen van de rol `planner` één migratie was en niet zevenenveertig. Een policy die letterlijk op `'beheerder'` toetst, sluit de eigenaar buiten; dat is al een keer gebeurd.
- **Het RPC-oppervlak blijft klein.** Precies drie functies zijn anon-aanroepbaar: `get_mijn_rol`, `get_mijn_tenant` en `uitnodiging_controleren`. Elke nieuwe `SECURITY DEFINER`-functie die je toevoegt, krijgt bewust wél of géén anon-recht — niet per ongeluk.
- **Twee sloten waar één er niet genoeg is.** Een policy ziet `OLD` niet, een trigger wel. Rol- en tenant-wijzigingen op `profiles` worden daarom door een `before update`-trigger tegengehouden én door `with check` op de policy. Diezelfde tweetrapsopzet zit op de werkbonstatus die een monteur mag zetten.
- **Nooit vertrouwen op client-side rolchecks als beveiliging.** UI-gedrag zoals `BeheerderGuard` is UX, geen beveiliging — de echte grens ligt in de database-policies.
- **Secrets** (Supabase keys, toekomstige API-keys) altijd via env-variabelen, nooit hardcoded, nooit gecommit. `.env.local` staat niet in git; `.env.example` bevat alleen placeholders.
- **Alleen de anon key in de frontend.** Elke actie die meer rechten nodig heeft dan de anon key + RLS toestaat, hoort niet client-side thuis zonder architecturaal overleg.
- **Foto-storage is public voor directe URL's** — wees je hiervan bewust bij het uploaden van gevoelige inhoud (zie `ROADMAP.md` voor de geplande overstap naar signed URLs).
- **Uitnodigingen (`uitnodigingen`-tabel):** de tabel is dicht voor iedereen behalve de beheerder van de eigen tenant. `Registreer.tsx` gebruikt `uitnodiging_controleren(token)` — een functie die één token als argument neemt en alleen `true`/`false` teruggeeft, geen rij en geen lijst. Dit was ooit een `select`-policy met voorwaarde `true`, waarmee een niet-ingelogde bezoeker alle tokens van alle tenants kon uitlezen. Zet dat nooit terug open.
- **De rol bij registratie staat vast op `medewerker`.** `handle_new_user()` las die ooit uit de client-metadata, waarmee één registratie volstond om beheerder te worden. Promoveren doet een bestaande beheerder, en dat loopt langs de trigger hierboven.
- **Elke wijziging aan auth, RLS of storage-policies wordt getest** vóórdat deze als afgerond geldt — draai `supabase/tests/rollentest.sql` opnieuw. Dat script bootst een rol na met `set local role authenticated` plus een JWT-claim, precies zoals PostgREST dat doet, en draait elke schrijfpoging terug. Zie `GIT_WORKFLOW.md` → testprocedure.

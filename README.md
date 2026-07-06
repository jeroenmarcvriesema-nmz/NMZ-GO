# NMZ GO — Werkopdrachten App

Interne webapp voor NMZ monteurs. Dagelijks gebruik door ~30 medewerkers.

**Stack:** React 18 · Vite · TypeScript · Tailwind CSS · Supabase · Zustand

---

## Installatie

### Vereisten
- Node.js 18 of hoger
- Een Supabase project

### 1. Dependencies installeren

```bash
npm install
```

### 2. Omgevingsvariabelen instellen

Maak een `.env.local` aan in de projectroot:

```env
VITE_SUPABASE_URL=https://jouw-project.supabase.co
VITE_SUPABASE_ANON_KEY=jouw-anon-key
```

Je vindt deze waarden in Supabase → Project Settings → API.

### 3. Database instellen

Ga naar **Supabase → SQL Editor → New query**.

Kopieer de volledige inhoud van `supabase/migrations/001_initial.sql`
en klik op **Run**.

Controleer daarna de verificatieoutput onderaan:
- Jouw account moet `✅ Beheerder` tonen
- De functie `get_mijn_rol` moet aanwezig zijn met `SECURITY DEFINER`

> **Let op:** pas regel 310 aan als jouw e-mailadres afwijkt:
> ```sql
> where email = 'jeroenmarcvriesema@gmail.com'
> ```

### 4. Storage bucket aanmaken

Ga naar **Supabase → Storage → New bucket**:
- Naam: `werkbon-fotos`
- Public: **aan**

### 5. App starten

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in de browser.

---

## Projectstructuur

```
nmzgo/
├── src/
│   ├── App.tsx                    # Router + AuthInitializer + Guards
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── ui/                    # Button, Card, Badge, Input, Modal, ...
│   │   ├── layout/                # Sidebar, MobileNav, Topbar, PageWrapper
│   │   ├── werkbon/               # WerkbonKaart
│   │   ├── taak/                  # TaakItem (foto upload + afvinken)
│   │   └── dashboard/             # StatCard
│   ├── pages/
│   │   ├── auth/                  # Login, Registreer
│   │   ├── beheerder/             # Dashboard, Werkbonnen, Detail, Medewerkers, Rapporten
│   │   └── medewerker/            # MijnWerkbonnen, WerkbonUitvoeren, Afgerond
│   ├── hooks/                     # useAuth, useWerkbonnen, useTaken, useFotos
│   ├── lib/                       # supabase.ts, utils.ts
│   ├── store/                     # authStore.ts (Zustand)
│   └── types/                     # TypeScript interfaces
└── supabase/
    └── migrations/
        └── 001_initial.sql        # Volledige database setup
```

---

## Auth flow

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

---

## Rollen

| Functie | Beheerder | Medewerker |
|---|---|---|
| Alle werkbonnen zien | ✅ | ❌ |
| Eigen werkbonnen zien | ✅ | ✅ |
| Werkbon aanmaken | ✅ | ❌ |
| Taken afvinken | ✅ | ✅ (eigen) |
| Foto's uploaden | ✅ | ✅ (eigen) |
| Medewerkers beheren | ✅ | ❌ |
| Dashboard | ✅ | ❌ |

---

## Bekende aandachtspunten

- **E-mailbevestiging:** Supabase stuurt standaard een bevestigingsmail bij registratie. Voor intern gebruik kun je dit uitschakelen via Supabase → Authentication → Settings → "Enable email confirmations" uitzetten.
- **Foto storage:** De bucket `werkbon-fotos` moet public zijn voor directe URL's. Voor extra beveiliging kan dit later worden omgezet naar signed URLs.
- **PDF export:** Rapporten → PDF export is nog niet geïmplementeerd in de MVP.

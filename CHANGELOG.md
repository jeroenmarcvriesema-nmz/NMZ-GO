# NMZ GO — Changelog

## v1.0.0 — MVP Release

### Auth fixes
- **[CRITICAL FIX]** `AuthInitializer` component toegevoegd in `App.tsx` root die auth eenmalig initialiseert. Voorheen riep elke Guard component `useAuth()` aan met eigen `onAuthStateChange` listener → race condition → infinite loading state.
- **[FIX]** `useAuth` hook vereenvoudigd naar pure store-reader zonder eigen `useEffect`. Voorkomt meervoudige listeners.
- **[FIX]** Login navigeert naar `/` (RootRedirect) in plaats van direct naar `/dashboard`. RootRedirect stuurt op basis van rol door na het laden van het profiel.
- **[FIX]** Automatisch profiel aanmaken bij `PGRST116` fout (profiel bestaat niet in database maar gebruiker wel in auth).
- **[FIX]** Foutscherm toegevoegd als profiel laden mislukt — geen oneindige loading state meer.

### Database / RLS fixes
- **[CRITICAL FIX]** `42P17 infinite recursion` opgelost. Oude policies deden `EXISTS (SELECT 1 FROM profiles ...)` binnen een policy op `profiles` → zelfreferentie → recursie.
- **[FIX]** `SECURITY DEFINER` functie `get_mijn_rol()` geïntroduceerd. Draait als postgres-eigenaar buiten RLS-context. Alle policies gebruiken deze functie voor rolcheck.
- **[FIX]** `FOR ALL` policy op `werkbon_medewerkers` opgesplitst in aparte `INSERT`/`DELETE` policies met correcte `WITH CHECK`.
- **[FIX]** `uitnodigingen_update` had `or true` (iedereen kon updaten) → beperkt tot beheerder of ingelogde gebruiker.
- **[FIX]** Indexen toegevoegd op veelgebruikte kolommen (status, datum, werkbon_id, medewerker_id).
- **[FIX]** Alle bestaande (recursieve) policies worden verwijderd voor opnieuw aanmaken.
- **[FIX]** Idempotente migratie — veilig meerdere keren uitvoerbaar.

### Code kwaliteit
- **[CLEANUP]** Alle tijdelijke debug `console.log` statements verwijderd uit productie build (51 statements in App.tsx, authStore.ts, Login.tsx).
- **[CLEANUP]** `RouteLogger` debug component verwijderd.
- **[CLEANUP]** Debug UI banner verwijderd van loginpagina.
- **[CLEANUP]** `useLocation` import verwijderd (was alleen voor debug).
- **[CLEANUP]** `versie debug-2` commentaar verwijderd.

### Bevestigd werkend
- ✅ Login met Supabase Auth
- ✅ Sessie herstel bij pagina refresh
- ✅ Logout
- ✅ Beheerder → dashboard
- ✅ Medewerker → mijn werkbonnen
- ✅ RLS: medewerker ziet alleen eigen werkbonnen
- ✅ RLS: beheerder ziet alles
- ✅ Geen infinite recursion
- ✅ Geen infinite loading state

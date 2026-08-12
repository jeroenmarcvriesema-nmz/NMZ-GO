import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Toaster } from '@/components/ui/Toaster'
import { Foutvanger } from '@/components/layout/Foutvanger'
import { magWerkBeheren, magGebruikersBeheren, isEigenaar, startPad } from '@/lib/rollen'

// Elk scherm apart inladen.
//
// Alles zat in één bestand van een halve megabyte. Op kantoorwifi merk
// je dat niet; op 4G voor een deur in Rotterdam wel, en dat is precies
// waar deze app geopend wordt. Nu haalt een zwamsaneerder alleen het
// scherm op dat hij nodig heeft — hij krijgt de planning van kantoor,
// de projectenpagina en het medewerkersbeheer niet meer mee.
//
// De inlogschermen blijven bewust gewoon geïmporteerd: dat is het
// eerste wat iedereen ziet, en daar een extra netwerkrondje voor doen
// maakt juist het traagste moment trager.
import Login from '@/pages/auth/Login'
import Registreer from '@/pages/auth/Registreer'
import WachtwoordVergeten from '@/pages/auth/WachtwoordVergeten'
import WachtwoordHerstellen from '@/pages/auth/WachtwoordHerstellen'

const Dashboard        = lazy(() => import('@/pages/beheerder/Dashboard'))
const Projecten        = lazy(() => import('@/pages/beheerder/Projecten'))
const Planning         = lazy(() => import('@/pages/beheerder/Planning'))
const Werkbonnen       = lazy(() => import('@/pages/beheerder/Werkbonnen'))
const WerkbonNieuw     = lazy(() => import('@/pages/beheerder/WerkbonNieuw'))
const WerkbonDetail    = lazy(() => import('@/pages/beheerder/WerkbonDetail'))
const Medewerkers      = lazy(() => import('@/pages/beheerder/Medewerkers'))
const Storingen        = lazy(() => import('@/pages/beheerder/Storingen'))
const PersoonDetail    = lazy(() => import('@/pages/beheerder/PersoonDetail'))
const Rapporten        = lazy(() => import('@/pages/beheerder/Rapporten'))
const Archief          = lazy(() => import('@/pages/beheerder/Archief'))
const Uitloop          = lazy(() => import('@/pages/beheerder/Uitloop'))
const MijnWerkbonnen   = lazy(() => import('@/pages/medewerker/MijnWerkbonnen'))
const MijnWeek         = lazy(() => import('@/pages/medewerker/MijnWeek'))
const MijnBonnen       = lazy(() => import('@/pages/medewerker/MijnBonnen'))
const WerkbonUitvoeren = lazy(() => import('@/pages/medewerker/WerkbonUitvoeren'))
const Afgerond         = lazy(() => import('@/pages/medewerker/Afgerond'))

function AuthInitializer() {
  const { fetchProfile, setLoading, setProfile } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { console.error('[Auth] Sessie fout:', error.message); setLoading(false); return }
      if (session?.user) { fetchProfile(session.user.id) } else { setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Een herstellink levert een sessie op met precies één doel: een
      // nieuw wachtwoord zetten. Landt zo'n link op de voorpagina — wat
      // gebeurt bij een link zonder bestemming, zoals die uit het
      // Supabase-dashboard — dan zou de gebruiker gewoon binnengelaten
      // worden zonder ooit een wachtwoord te kiezen. Stuur hem daarom
      // altijd naar het herstelscherm, waar de link ook binnenkomt.
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/wachtwoord-herstellen', { replace: true })
        return
      }

      if (event === 'SIGNED_IN' && session?.user) {
        fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setProfile(null); setLoading(false)
      } else if (!session && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION' && event !== 'USER_UPDATED') {
        setProfile(null); setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}

function ThemeInitializer() {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return null
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, error } = useAuthStore()
  if (loading) return <PageLoader />
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-2 dark:bg-surface-dark">
        <div className="bg-white dark:bg-surface-dark-2 rounded-lg shadow-lg max-w-sm w-full">
          <ErrorState
            titel="Kan niet laden"
            melding={error}
            onOpnieuw={() => window.location.reload()}
          />
          <div className="text-center pb-7 -mt-4">
            <button
              onClick={() => supabase.auth.signOut().then(() => (window.location.href = '/login'))}
              className="text-sm text-gray-400 dark:text-white/40 underline hover:text-gray-600 dark:hover:text-white/70 transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (!profile) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Twee niveaus, gelijk aan de bevoegdheden in de database (migratie 008).
// Deze guards bepalen wat je te zíen krijgt; de policies bepalen wat je
// mág. Dat is bewust dubbel: een guard is gemak, geen beveiliging.
//
// De lijsten zelf staan in lib/rollen.ts, samen met het slot per route.
// Ze stonden hier én in useAuth.ts en liepen uit de pas — het gevolg was
// een menuknop die je terugstuurde naar het dashboard.

/** Werkbonnen, projecten, planning, rapporten — alles rond het werk. */
function KantoorGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (!magWerkBeheren(profile.rol)) return <Navigate to="/mijn-werkbonnen" replace />
  return <>{children}</>
}

/**
 * De storingen van de app zelf — alleen de eigenaar.
 *
 * Het strakste slot dat er is. De tegenhanger in de database is
 * `fouten_select_eigenaar` (migratie 030); zonder die policy zou deze
 * guard niets betekenen, want de tabel is rechtstreeks te bevragen.
 */
function EigenaarGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (!isEigenaar(profile.rol)) return <Navigate to={startPad(profile.rol)} replace />
  return <>{children}</>
}

/** Medewerkers, uitnodigingen, wachtwoorden — strenger. */
function GebruikersbeheerGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (!magGebruikersBeheren(profile.rol)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={startPad(profile.rol)} replace />
}

export default function App() {
  return (
    // Het vangnet staat buiten de router: valt er iets om tijdens het
    // navigeren zelf, dan is er nog steeds een scherm met een uitweg.
    <Foutvanger plek="app">
      <BrowserRouter>
        <AuthInitializer />
        <ThemeInitializer />
        <Toaster />
        {/* Elk scherm komt apart binnen; tot het er is staat de gewone
            laadindicator, dezelfde als bij het ophalen van gegevens. */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"      element={<Login />} />
            <Route path="/registreer" element={<Registreer />} />
            <Route path="/wachtwoord-vergeten"    element={<WachtwoordVergeten />} />
            <Route path="/wachtwoord-herstellen"  element={<WachtwoordHerstellen />} />
            <Route path="/"           element={<RootRedirect />} />

            <Route path="/dashboard"        element={<KantoorGuard><Dashboard /></KantoorGuard>} />
            <Route path="/projecten"        element={<KantoorGuard><Projecten /></KantoorGuard>} />
            <Route path="/planning"         element={<KantoorGuard><Planning /></KantoorGuard>} />
            <Route path="/werkbonnen"       element={<KantoorGuard><Werkbonnen /></KantoorGuard>} />
            <Route path="/werkbonnen/nieuw" element={<KantoorGuard><WerkbonNieuw /></KantoorGuard>} />
            <Route path="/werkbonnen/:id"   element={<KantoorGuard><WerkbonDetail /></KantoorGuard>} />
            <Route path="/medewerkers"      element={<GebruikersbeheerGuard><Medewerkers /></GebruikersbeheerGuard>} />
            <Route path="/medewerkers/:id"  element={<GebruikersbeheerGuard><PersoonDetail /></GebruikersbeheerGuard>} />
            <Route path="/rapporten"        element={<KantoorGuard><Rapporten /></KantoorGuard>} />
            <Route path="/archief"          element={<KantoorGuard><Archief /></KantoorGuard>} />
            <Route path="/uitloop"          element={<KantoorGuard><Uitloop /></KantoorGuard>} />
            <Route path="/storingen"        element={<EigenaarGuard><Storingen /></EigenaarGuard>} />

            <Route path="/mijn-werkbonnen" element={<AuthGuard><MijnWerkbonnen /></AuthGuard>} />
            <Route path="/werkbon/:id"     element={<AuthGuard><WerkbonUitvoeren /></AuthGuard>} />
            <Route path="/mijn-week"       element={<AuthGuard><MijnWeek /></AuthGuard>} />
            <Route path="/mijn-bonnen"     element={<AuthGuard><MijnBonnen /></AuthGuard>} />
            <Route path="/afgerond"        element={<AuthGuard><Afgerond /></AuthGuard>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Foutvanger>
  )
}
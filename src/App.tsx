import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Toaster } from '@/components/ui/Toaster'
import type { Rol } from '@/types'

import Login            from '@/pages/auth/Login'
import Registreer       from '@/pages/auth/Registreer'
import WachtwoordVergeten   from '@/pages/auth/WachtwoordVergeten'
import WachtwoordHerstellen from '@/pages/auth/WachtwoordHerstellen'
import Dashboard        from '@/pages/beheerder/Dashboard'
import Projecten        from '@/pages/beheerder/Projecten'
import ProjectDetail    from '@/pages/beheerder/ProjectDetail'
import Planning         from '@/pages/beheerder/Planning'
import Werkbonnen       from '@/pages/beheerder/Werkbonnen'
import WerkbonNieuw     from '@/pages/beheerder/WerkbonNieuw'
import WerkbonDetail    from '@/pages/beheerder/WerkbonDetail'
import Medewerkers      from '@/pages/beheerder/Medewerkers'
import Rapporten        from '@/pages/beheerder/Rapporten'
import MijnWerkbonnen   from '@/pages/medewerker/MijnWerkbonnen'
import MijnWeek         from '@/pages/medewerker/MijnWeek'
import WerkbonUitvoeren from '@/pages/medewerker/WerkbonUitvoeren'
import Afgerond         from '@/pages/medewerker/Afgerond'

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
const WERKBEHEER: Rol[] = ['eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider']
const GEBRUIKERSBEHEER: Rol[] = ['eigenaar', 'beheerder']

/** Werkbonnen, projecten, planning, rapporten — alles rond het werk. */
function KantoorGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (!WERKBEHEER.includes(profile.rol)) return <Navigate to="/mijn-werkbonnen" replace />
  return <>{children}</>
}

/** Medewerkers, uitnodigingen, wachtwoorden — strenger. */
function GebruikersbeheerGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (!GEBRUIKERSBEHEER.includes(profile.rol)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={WERKBEHEER.includes(profile.rol) ? '/dashboard' : '/mijn-werkbonnen'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInitializer />
      <ThemeInitializer />
      <Toaster />
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/registreer" element={<Registreer />} />
        <Route path="/wachtwoord-vergeten"    element={<WachtwoordVergeten />} />
        <Route path="/wachtwoord-herstellen"  element={<WachtwoordHerstellen />} />
        <Route path="/"           element={<RootRedirect />} />

        <Route path="/dashboard"        element={<KantoorGuard><Dashboard /></KantoorGuard>} />
        <Route path="/projecten"        element={<KantoorGuard><Projecten /></KantoorGuard>} />
        <Route path="/projecten/:id"    element={<KantoorGuard><ProjectDetail /></KantoorGuard>} />
        <Route path="/planning"         element={<KantoorGuard><Planning /></KantoorGuard>} />
        <Route path="/werkbonnen"       element={<KantoorGuard><Werkbonnen /></KantoorGuard>} />
        <Route path="/werkbonnen/nieuw" element={<KantoorGuard><WerkbonNieuw /></KantoorGuard>} />
        <Route path="/werkbonnen/:id"   element={<KantoorGuard><WerkbonDetail /></KantoorGuard>} />
        <Route path="/medewerkers"      element={<GebruikersbeheerGuard><Medewerkers /></GebruikersbeheerGuard>} />
        <Route path="/rapporten"        element={<KantoorGuard><Rapporten /></KantoorGuard>} />

        <Route path="/mijn-werkbonnen" element={<AuthGuard><MijnWerkbonnen /></AuthGuard>} />
        <Route path="/werkbon/:id"     element={<AuthGuard><WerkbonUitvoeren /></AuthGuard>} />
        <Route path="/mijn-week"       element={<AuthGuard><MijnWeek /></AuthGuard>} />
        <Route path="/afgerond"        element={<AuthGuard><Afgerond /></AuthGuard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
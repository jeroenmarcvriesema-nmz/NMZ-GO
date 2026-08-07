import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Toaster } from '@/components/ui/Toaster'

import Login            from '@/pages/auth/Login'
import Registreer       from '@/pages/auth/Registreer'
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
import WerkbonUitvoeren from '@/pages/medewerker/WerkbonUitvoeren'
import Afgerond         from '@/pages/medewerker/Afgerond'

function AuthInitializer() {
  const { fetchProfile, setLoading, setProfile } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { console.error('[Auth] Sessie fout:', error.message); setLoading(false); return }
      if (session?.user) { fetchProfile(session.user.id) } else { setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

function BeheerderGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.rol !== 'beheerder') return <Navigate to="/mijn-werkbonnen" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { profile, loading } = useAuthStore()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.rol === 'beheerder' ? '/dashboard' : '/mijn-werkbonnen'} replace />
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
        <Route path="/"           element={<RootRedirect />} />

        <Route path="/dashboard"        element={<BeheerderGuard><Dashboard /></BeheerderGuard>} />
        <Route path="/projecten"        element={<BeheerderGuard><Projecten /></BeheerderGuard>} />
        <Route path="/projecten/:id"    element={<BeheerderGuard><ProjectDetail /></BeheerderGuard>} />
        <Route path="/planning"         element={<BeheerderGuard><Planning /></BeheerderGuard>} />
        <Route path="/werkbonnen"       element={<BeheerderGuard><Werkbonnen /></BeheerderGuard>} />
        <Route path="/werkbonnen/nieuw" element={<BeheerderGuard><WerkbonNieuw /></BeheerderGuard>} />
        <Route path="/werkbonnen/:id"   element={<BeheerderGuard><WerkbonDetail /></BeheerderGuard>} />
        <Route path="/medewerkers"      element={<BeheerderGuard><Medewerkers /></BeheerderGuard>} />
        <Route path="/rapporten"        element={<BeheerderGuard><Rapporten /></BeheerderGuard>} />

        <Route path="/mijn-werkbonnen" element={<AuthGuard><MijnWerkbonnen /></AuthGuard>} />
        <Route path="/werkbon/:id"     element={<AuthGuard><WerkbonUitvoeren /></AuthGuard>} />
        <Route path="/afgerond"        element={<AuthGuard><Afgerond /></AuthGuard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
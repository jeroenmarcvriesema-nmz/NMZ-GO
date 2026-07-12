import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageLoader } from '@/components/ui/Spinner'

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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, error } = useAuthStore()
  if (loading) return <PageLoader />
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F4F3EF' }}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="font-bold text-lg mb-2">Kan niet laden</h2>
          <p className="text-sm text-gray-500 mb-5">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-brand-yellow text-gray-900 font-semibold px-4 py-2.5 rounded-lg w-full mb-2">Opnieuw proberen</button>
          <button onClick={() => supabase.auth.signOut().then(() => (window.location.href = '/login'))} className="text-sm text-gray-400 underline">Uitloggen</button>
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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconClipboardCheck, IconAlertCircle } from '@tabler/icons-react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('E-mail of wachtwoord onjuist.')
      setLoading(false)
      return
    }

    // AuthInitializer in App.tsx verwerkt het SIGNED_IN event
    // en laadt het profiel. RootRedirect stuurt daarna door.
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(240,180,32,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(188,41,52,0.12),transparent_60%)]" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-brand-yellow flex items-center justify-center mx-auto mb-6 shadow-[0_4px_20px_rgba(240,180,32,0.4)]">
            <IconClipboardCheck className="w-10 h-10 text-gray-900" />
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tight mb-3">NMZ GO</h1>
          <div className="w-12 h-1 bg-brand-yellow rounded mx-auto mb-4" />
          <p className="text-white/50 text-lg">Werkopdrachten &amp; checklists</p>
          <div className="mt-12 space-y-4 text-left max-w-xs">
            {[
              'Werkbonnen direct op je telefoon',
              'Foto verplicht per afgevinkt punt',
              'Live voortgang voor de beheerder',
              'Week-dashboard met schema-bewaking',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-white/70 text-sm font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[420px] bg-white flex items-center justify-center p-8 shadow-[-20px_0_60px_rgba(0,0,0,0.2)]">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-sm bg-brand-yellow flex items-center justify-center">
              <IconClipboardCheck className="w-5 h-5 text-gray-900" />
            </div>
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">NMZ GO</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight mb-1">Inloggen</h2>
          <p className="text-sm text-gray-500 mb-7">Vul je e-mailadres en wachtwoord in</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="E-mailadres"
              type="email"
              placeholder="naam@bedrijf.nl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Wachtwoord"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="flex items-center gap-2 text-sm text-brand-red bg-brand-red-light border border-brand-red rounded-sm p-3">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
              Inloggen
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

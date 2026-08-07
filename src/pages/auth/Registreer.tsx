import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconClipboardCheck, IconAlertCircle, IconLock } from '@tabler/icons-react'

export default function Registreer() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenGeldig, setTokenGeldig] = useState<boolean | null>(null)

  useEffect(() => {
    if (!token) { setTokenGeldig(false); return }
    // Gaat bewust via een functie en niet via de tabel: uitnodigingen
    // staat dicht, zodat tokens niet op te vragen zijn zonder login.
    supabase.rpc('uitnodiging_controleren', { p_token: token })
      .then(({ data, error }) => setTokenGeldig(!error && data === true))
  }, [token])

  const handleRegistreer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== password2) { setError('Wachtwoorden komen niet overeen.'); return }
    if (password.length < 6) { setError('Wachtwoord minimaal 6 tekens.'); return }
    setLoading(true)

    // Het token gaat mee als metadata. De database leest het uit,
    // haalt de tenant uit de uitnodiging en zet die op het profiel —
    // in dezelfde transactie, zodat een token niet twee keer werkt.
    // De rol wordt serverzijde vastgezet en is hier niet te sturen.
    const { error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { naam, uitnodiging_token: token } },
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    navigate('/mijn-werkbonnen')
  }

  if (tokenGeldig === false) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-surface-dark-2 rounded-lg max-w-sm w-full">
        <EmptyState
          icon={<IconLock />}
          titel="Ongeldige uitnodigingslink"
          uitleg="Deze link is verlopen of al gebruikt. Vraag de beheerder om een nieuwe."
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-surface-dark-2 rounded-lg w-full max-w-sm p-8 animate-page-in">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-sm bg-brand-yellow flex items-center justify-center">
            <IconClipboardCheck className="w-5 h-5 text-gray-900" />
          </div>
          <span className="text-xs font-bold text-gray-400 dark:text-white/40 tracking-widest uppercase">NMZ GO</span>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight mb-1 text-gray-900 dark:text-white">Account aanmaken</h2>
        <p className="text-sm text-gray-500 dark:text-white/60 mb-6">Je bent uitgenodigd voor NMZ GO</p>
        <form onSubmit={handleRegistreer} className="space-y-4">
          <Input label="Volledige naam" placeholder="Jan de Vries" value={naam} onChange={(e) => setNaam(e.target.value)} required />
          <Input label="E-mailadres" type="email" placeholder="jan@nmz.nl" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Wachtwoord" type="password" placeholder="Min. 6 tekens" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Herhaal wachtwoord" type="password" placeholder="Herhaal" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
          {error && (
            <div className="flex items-center gap-2 text-sm text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3">
              <IconAlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>Account aanmaken</Button>
        </form>
      </div>
    </div>
  )
}

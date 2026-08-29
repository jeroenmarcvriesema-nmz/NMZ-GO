import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/store/toastStore'
import { IconClipboardCheck, IconAlertCircle, IconLock, IconArrowLeft } from '@tabler/icons-react'

type Fase = 'controleren' | 'klaar_voor_invoer' | 'geen_link'

export default function WachtwoordHerstellen() {
  const navigate = useNavigate()
  const [fase, setFase] = useState<Fase>('controleren')
  const [wachtwoord, setWachtwoord] = useState('')
  const [herhaling, setHerhaling] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabase leest het herstel-token uit de URL en maakt daarmee een
  // tijdelijke sessie aan. Die sessie geeft precies één recht: je eigen
  // wachtwoord wijzigen. Is er geen sessie, dan is de link verlopen,
  // al gebruikt, of nooit geldig geweest.
  useEffect(() => {
    let afgebroken = false

    const controleer = async () => {
      const { data } = await supabase.auth.getSession()
      if (afgebroken) return
      setFase(data.session ? 'klaar_voor_invoer' : 'geen_link')
    }

    // Kort wachten: supabase-js verwerkt de URL asynchroon bij het laden.
    const timer = setTimeout(controleer, 400)
    return () => { afgebroken = true; clearTimeout(timer) }
  }, [])

  const handleOpslaan = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (wachtwoord.length < 6) { setError('Kies een wachtwoord van minimaal 6 tekens.'); return }
    if (wachtwoord !== herhaling) { setError('De twee wachtwoorden zijn niet gelijk.'); return }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: wachtwoord })
    setLoading(false)

    if (updateError) {
      setError('Het wachtwoord kon niet worden opgeslagen. Vraag een nieuwe link aan en probeer het opnieuw.')
      return
    }

    toast.goed('Je nieuwe wachtwoord is opgeslagen')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-surface-dark-2 rounded-lg w-full max-w-sm p-8 animate-page-in">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-sm bg-brand-yellow flex items-center justify-center">
            <IconClipboardCheck className="w-5 h-5 text-gray-900" />
          </div>
          <span className="text-xs font-bold text-tekst-gedempt dark:text-white/55 tracking-widest uppercase">NMZ GO</span>
        </div>

        {fase === 'controleren' && (
          <div className="flex flex-col items-center py-10">
            <Spinner className="w-7 h-7" />
            <p className="text-sm text-tekst-gedempt dark:text-white/55 mt-4">Link controleren…</p>
          </div>
        )}

        {fase === 'geen_link' && (
          <>
            <div className="w-12 h-12 rounded-full bg-brand-red-light dark:bg-brand-red/10 flex items-center justify-center text-brand-red dark:text-red-400 mb-4">
              <IconLock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight mb-1.5 text-gray-900 dark:text-white">Deze link werkt niet meer</h2>
            <p className="text-sm text-gray-500 dark:text-white/60 leading-relaxed">
              Herstellinks zijn maar korte tijd geldig en werken één keer. Vraag een nieuwe aan.
            </p>
            <Link to="/wachtwoord-vergeten" className="block mt-6">
              <Button variant="primary" fullWidth>Nieuwe link aanvragen</Button>
            </Link>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white mt-5 transition-colors">
              <IconArrowLeft className="w-4 h-4" /> Terug naar inloggen
            </Link>
          </>
        )}

        {fase === 'klaar_voor_invoer' && (
          <>
            <h2 className="text-2xl font-extrabold tracking-tight mb-1.5 text-gray-900 dark:text-white">Nieuw wachtwoord</h2>
            <p className="text-sm text-gray-500 dark:text-white/60 mb-7">Kies een wachtwoord waarmee je voortaan inlogt.</p>

            <form onSubmit={handleOpslaan} className="space-y-4">
              <Input
                label="Nieuw wachtwoord"
                type="password"
                placeholder="Min. 6 tekens"
                value={wachtwoord}
                onChange={(e) => setWachtwoord(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Input
                label="Herhaal wachtwoord"
                type="password"
                placeholder="Herhaal"
                value={herhaling}
                onChange={(e) => setHerhaling(e.target.value)}
                required
                autoComplete="new-password"
              />

              {error && (
                <div className="flex items-center gap-2 text-sm text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3">
                  <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
                Wachtwoord opslaan
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
      // Elke fout op één hoop gooien kostte een middag zoeken: een
      // onbevestigd e-mailadres zag er precies zo uit als een verkeerd
      // wachtwoord. Benoem daarom wat er werkelijk aan de hand is.
      const melding = signInError.message.toLowerCase()
      if (melding.includes('not confirmed')) {
        setError('Je e-mailadres is nog niet bevestigd. Kijk in je mailbox — ook in je spam.')
      } else if (melding.includes('invalid login')) {
        setError('E-mail of wachtwoord onjuist.')
      } else {
        setError(`Inloggen lukte niet: ${signInError.message}`)
      }
      setLoading(false)
      return
    }

    // AuthInitializer in App.tsx verwerkt het SIGNED_IN event
    // en laadt het profiel. RootRedirect stuurt daarna door.
    navigate('/')
  }

  return (
    // Dit was het enige scherm in de app dat het thema niet volgde:
    // `bg-gray-900` hard ingesteld, twee radiale verlopen met de
    // merkkleuren als losse rgba-waarden erin, en een schaduw buiten de
    // schaduwschaal. Drie eigen regels tegelijk overtreden, op een
    // overblijfsel uit de tijd dat de zijbalk permanent donker was.
    //
    // Het merkpaneel blijft — dat is wat dit scherm karakter geeft —
    // maar het is nu een vlak dat licht en donker allebei kent: warm
    // steen in licht, diep in donker, met dezelfde gele gloed erover.
    <div className="min-h-screen bg-surface-2 dark:bg-surface-dark flex">
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 relative overflow-hidden bg-surface-3 dark:bg-surface-dark">
        {/* De gloed komt uit de merkkleuren zelf in plaats van uit
            overgeschreven rgba-waarden, zodat hij meebeweegt als het
            palet ooit wijzigt. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,theme(colors.brand.yellow/25%),transparent_60%)] dark:bg-[radial-gradient(circle_at_20%_20%,theme(colors.brand.yellow/15%),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,theme(colors.brand.red/6%),transparent_60%)] dark:bg-[radial-gradient(circle_at_80%_80%,theme(colors.brand.red/12%),transparent_60%)]" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-lg bg-brand-yellow flex items-center justify-center mx-auto mb-6 shadow-md">
            <IconClipboardCheck className="w-10 h-10 text-gray-900" />
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">NMZ GO</h1>
          <div className="w-12 h-1 bg-brand-yellow rounded mx-auto mb-4" />
          <p className="text-gray-600 dark:text-white/60 text-lg">Werkopdrachten &amp; checklists</p>
          <div className="mt-12 space-y-4 text-left max-w-xs">
            {[
              'Werkbonnen direct op je telefoon',
              'Foto verplicht per afgevinkt punt',
              'Live voortgang voor de beheerder',
              'Week-dashboard met schema-bewaking',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-gray-700 dark:text-white/70 text-sm font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Op een telefoon zie je uitsluitend dit paneel, en het stond
          verticaal gecentreerd met het merk als klein chipje ertussen:
          een wit vlak met een formulier erin. Nu staat het merk bovenaan
          en begint het formulier hoger, want het toetsenbord komt toch
          op en duwt alles omhoog. */}
      <div className="w-full lg:w-[420px] bg-white dark:bg-surface-dark-2 flex items-start lg:items-center justify-center px-6 py-12 sm:p-10 shadow-lg animate-page-in">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-sm bg-brand-yellow flex items-center justify-center flex-shrink-0">
              <IconClipboardCheck className="w-5 h-5 text-gray-900" />
            </div>
            <span className="text-xs font-bold text-tekst-gedempt dark:text-white/55 tracking-widest uppercase">NMZ GO</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-1.5 text-gray-900 dark:text-white">Inloggen</h2>
          <p className="text-sm text-gray-500 dark:text-white/60 mb-7">Vul je e-mailadres en wachtwoord in</p>

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
              <div className="flex items-center gap-2 text-sm text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
              Inloggen
            </Button>
          </form>

          <Link
            to="/wachtwoord-vergeten"
            className="block text-sm text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white mt-5 transition-colors"
          >
            Wachtwoord vergeten?
          </Link>
        </div>
      </div>
    </div>
  )
}

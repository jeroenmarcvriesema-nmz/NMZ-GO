import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconClipboardCheck, IconAlertCircle, IconMail, IconArrowLeft } from '@tabler/icons-react'

export default function WachtwoordVergeten() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verstuurd, setVerstuurd] = useState(false)

  const handleVerstuur = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // redirectTo is essentieel: zonder deze regel stuurt Supabase de
    // gebruiker naar de Site URL en komt hij nooit op het scherm waar
    // hij een nieuw wachtwoord kan zetten.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/wachtwoord-herstellen`,
    })

    setLoading(false)

    if (resetError) {
      // Benoem de oorzaak. De twee die in de praktijk voorkomen zijn
      // een niet-toegestane redirect-URL (configuratie) en de
      // verstuurlimiet van Supabase' ingebouwde mailer (geduld of SMTP).
      const melding = resetError.message.toLowerCase()
      if (melding.includes('redirect')) {
        setError('Deze omgeving is nog niet volledig ingesteld: het herstel-adres staat niet in de lijst met toegestane adressen in Supabase. Neem contact op met de beheerder.')
      } else if (melding.includes('rate limit') || melding.includes('too many')) {
        setError('Er zijn te veel aanvragen gedaan. Wacht een uur en probeer het opnieuw.')
      } else {
        setError(`De e-mail kon niet worden verstuurd: ${resetError.message}`)
      }
      return
    }
    setVerstuurd(true)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-surface-dark-2 rounded-lg w-full max-w-sm p-8 animate-page-in">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-sm bg-brand-yellow flex items-center justify-center">
            <IconClipboardCheck className="w-5 h-5 text-gray-900" />
          </div>
          <span className="text-xs font-bold text-gray-400 dark:text-white/40 tracking-widest uppercase">NMZ GO</span>
        </div>

        {verstuurd ? (
          <>
            <div className="w-12 h-12 rounded-full bg-brand-yellow-light dark:bg-brand-yellow/10 flex items-center justify-center text-brand-yellow-dark dark:text-brand-yellow mb-4">
              <IconMail className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight mb-1.5 text-gray-900 dark:text-white">Kijk in je mailbox</h2>
            <p className="text-sm text-gray-500 dark:text-white/60 leading-relaxed">
              Als er een account bestaat op <strong className="text-gray-700 dark:text-white/80">{email}</strong>,
              staat er nu een link in je mail om een nieuw wachtwoord te kiezen. Kijk ook even in je spam.
            </p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white mt-6 transition-colors">
              <IconArrowLeft className="w-4 h-4" /> Terug naar inloggen
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold tracking-tight mb-1.5 text-gray-900 dark:text-white">Wachtwoord vergeten</h2>
            <p className="text-sm text-gray-500 dark:text-white/60 mb-7">
              Vul je e-mailadres in, dan sturen we je een link om een nieuw wachtwoord te kiezen.
            </p>

            <form onSubmit={handleVerstuur} className="space-y-4">
              <Input
                label="E-mailadres"
                type="email"
                placeholder="naam@bedrijf.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              {error && (
                <div className="flex items-center gap-2 text-sm text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3">
                  <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
                Stuur mij een link
              </Button>
            </form>

            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white mt-6 transition-colors">
              <IconArrowLeft className="w-4 h-4" /> Terug naar inloggen
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

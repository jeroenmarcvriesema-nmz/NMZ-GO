import { useState, useEffect } from 'react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toastStore'
import { IconLink, IconCopy, IconKey, IconCheck, IconUsers } from '@tabler/icons-react'

export default function Medewerkers() {
  const { profile } = useAuth()
  const [medewerkers, setMedewerkers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [uitnodigingLink, setUitnodigingLink] = useState<string | null>(null)
  const [linkModal, setLinkModal] = useState(false)
  const [gekopieerd, setGekopieerd] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').order('naam')
      .then(({ data }) => { setMedewerkers((data as Profile[]) || []); setLoading(false) })
  }, [])

  const genereerLink = async () => {
    // crypto.randomUUID is niet te raden; Math.random wel — en dit token
    // geeft toegang tot je tenant.
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('uitnodigingen').insert({
      token, aangemaakt_door: profile?.id,
      verloopt_op: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) {
      toast.fout('De uitnodiging kon niet worden aangemaakt. Probeer het opnieuw.')
      return
    }
    setUitnodigingLink(`${window.location.origin}/registreer?token=${token}`)
    setLinkModal(true)
  }

  const kopieer = async () => {
    if (!uitnodigingLink) return
    await navigator.clipboard.writeText(uitnodigingLink)
    setGekopieerd(true)
    setTimeout(() => setGekopieerd(false), 2000)
  }

  const resetWachtwoord = async (email: string) => {
    // Zonder redirectTo landt de monteur op de voorpagina in plaats van
    // op het scherm waar hij een nieuw wachtwoord kan kiezen.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/wachtwoord-herstellen`,
    })
    if (error) toast.fout('De reset-mail kon niet worden verstuurd. Probeer het opnieuw.')
    else toast.goed(`Reset-mail verstuurd naar ${email}`)
  }

  return (
    <PageWrapper title="Medewerkers" actions={
      <Button variant="primary" onClick={genereerLink}><IconLink className="w-4 h-4" /> Uitnodigingslink</Button>
    }>
      <div className="max-w-2xl">
        <Card>
          <SectionHeading title={`Alle gebruikers (${medewerkers.length})`} />
          {loading ? (
            <div className="text-center py-8 text-gray-400 dark:text-white/40">Laden…</div>
          ) : medewerkers.length === 0 ? (
            <EmptyState
              icon={<IconUsers />}
              titel="Nog geen medewerkers"
              uitleg="Maak een uitnodigingslink aan en stuur die naar je monteurs."
              actie={<Button variant="primary" size="sm" onClick={genereerLink}><IconLink className="w-4 h-4" /> Uitnodigingslink</Button>}
            />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {medewerkers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-colors hover:bg-brand-yellow-light/40 dark:hover:bg-white/5">
                  <Avatar naam={m.naam} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-gray-900 dark:text-white">{m.naam}</div>
                  </div>
                  <Badge variant={m.actief ? 'green' : 'red'}>{m.actief ? 'Actief' : 'Inactief'}</Badge>
                  <Badge variant={m.rol === 'beheerder' ? 'yellow' : 'gray'}>{m.rol}</Badge>
                  <button onClick={() => resetWachtwoord(m.id)} className="p-2 text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 transition-colors" title="Wachtwoord resetten">
                    <IconKey className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={linkModal} onClose={() => setLinkModal(false)} title="Uitnodigingslink">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-sm p-3">
            <IconCheck className="w-4 h-4 flex-shrink-0" /> Link gegenereerd. Geldig 7 dagen.
          </div>
          <input readOnly value={uitnodigingLink || ''}
            className="w-full px-3 py-2.5 text-xs bg-surface-2 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-sm text-gray-600 dark:text-white/60 font-mono" />
          <Button variant="primary" fullWidth onClick={kopieer}>
            {gekopieerd ? <><IconCheck className="w-4 h-4" /> Gekopieerd!</> : <><IconCopy className="w-4 h-4" /> Kopiëren</>}
          </Button>
          <p className="text-xs text-gray-400 dark:text-white/40 text-center">Stuur via WhatsApp of e-mail.</p>
        </div>
      </Modal>
    </PageWrapper>
  )
}

import { useState, useEffect } from 'react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types'
import { IconLink, IconCopy, IconKey, IconCheck } from '@tabler/icons-react'

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
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await supabase.from('uitnodigingen').insert({
      token, aangemaakt_door: profile?.id,
      verloopt_op: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
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
    await supabase.auth.resetPasswordForEmail(email)
    alert(`Reset-mail verstuurd naar ${email}`)
  }

  return (
    <PageWrapper title="Medewerkers" actions={
      <Button variant="primary" onClick={genereerLink}><IconLink className="w-4 h-4" /> Uitnodigingslink</Button>
    }>
      <div className="max-w-2xl">
        <Card>
          <div className="text-sm font-bold mb-4 text-gray-900 dark:text-white">Alle gebruikers ({medewerkers.length})</div>
          {loading ? (
            <div className="text-center py-8 text-gray-400 dark:text-white/40">Laden…</div>
          ) : medewerkers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-white/40">
              <div className="text-4xl mb-3">👥</div>
              <div className="font-medium">Nog geen medewerkers</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {medewerkers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3">
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

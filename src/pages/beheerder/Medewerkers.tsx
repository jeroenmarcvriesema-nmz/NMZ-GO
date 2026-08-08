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
import type { Profile, Rol } from '@/types'

import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { rolLabel, ROL_LABEL } from '@/lib/utils'
import { toast } from '@/store/toastStore'
import { IconLink, IconCopy, IconKey, IconCheck, IconUsers } from '@tabler/icons-react'

// De eigenaarsrol staat er bewust niet bij: die kan alleen een eigenaar
// toekennen, en de database weigert het van iedereen anders. Hem tonen
// zou een keuze suggereren die meestal op een foutmelding uitloopt.
const ROL_OPTIES = (['beheerder', 'uitvoerder', 'werkvoorbereider', 'medewerker'] as const)
  .map((r) => ({ waarde: r, label: ROL_LABEL[r] }))

export default function Medewerkers() {
  const { profile, magGebruikersBeheren } = useAuth()
  const [medewerkers, setMedewerkers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [uitnodigingLink, setUitnodigingLink] = useState<string | null>(null)
  const [linkModal, setLinkModal] = useState(false)
  const [gekopieerd, setGekopieerd] = useState(false)
  const [clickupLabels, setClickupLabels] = useState<string[]>([])

  useEffect(() => {
    supabase.from('profiles').select('*').order('naam')
      .then(({ data }) => { setMedewerkers((data as Profile[]) || []); setLoading(false) })

    // De namenlijst komt uit de instellingen, niet uit ClickUp zelf:
    // de browser heeft geen ClickUp-token en hoort dat ook niet te
    // krijgen. De synchronisatie ververst die lijst.
    supabase.from('clickup_instellingen').select('medewerker_labels').maybeSingle()
      .then(({ data }) => setClickupLabels(data?.medewerker_labels ?? []))
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

  const wijzigRol = async (id: string, rol: Rol) => {
    const vorige = medewerkers
    setMedewerkers((lijst) => lijst.map((m) => (m.id === id ? { ...m, rol } : m)))

    const { data, error } = await supabase
      .from('profiles').update({ rol }).eq('id', id).select('id')

    if (error || !data || data.length === 0) {
      setMedewerkers(vorige)
      toast.fout(error?.message ?? 'De rol kon niet worden gewijzigd.')
      return
    }
    toast.goed('Rol bijgewerkt')
  }

  const koppelClickUp = async (id: string, label: string) => {
    const waarde = label === '' ? null : label
    const vorige = medewerkers
    setMedewerkers((lijst) => lijst.map((m) => (m.id === id ? { ...m, clickup_label: waarde } : m)))

    const { data, error } = await supabase
      .from('profiles').update({ clickup_label: waarde }).eq('id', id).select('id')

    if (error || !data || data.length === 0) {
      setMedewerkers(vorige)
      // Een unieke sleutel: twee mensen kunnen niet dezelfde ClickUp-naam
      // claimen, anders is de toewijzing straks een gok.
      toast.fout(error?.code === '23505'
        ? 'Die ClickUp-naam is al aan iemand anders gekoppeld.'
        : 'De koppeling kon niet worden opgeslagen.')
      return
    }
    toast.goed(waarde ? `Gekoppeld aan ${waarde}` : 'Koppeling verwijderd')
  }

  const resetWachtwoord = async (email: string) => {
    // Zonder redirectTo landt de zwamsaneerder op de voorpagina in plaats van
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
              uitleg="Maak een uitnodigingslink aan en stuur die naar je zwamsaneerders."
              actie={<Button variant="primary" size="sm" onClick={genereerLink}><IconLink className="w-4 h-4" /> Uitnodigingslink</Button>}
            />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {medewerkers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-colors hover:bg-brand-yellow-light/40 dark:hover:bg-white/5">
                  <Avatar naam={m.naam} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-gray-900 dark:text-white">{m.naam}</div>
                    <div className="text-xs text-gray-400 dark:text-white/40 truncate">
                      {m.functie || m.email || '—'}
                    </div>
                  </div>
                  <Badge variant={m.actief ? 'green' : 'red'}>{m.actief ? 'Actief' : 'Inactief'}</Badge>

                  {magGebruikersBeheren && m.id !== profile?.id ? (
                    <Select
                      aria-label={`Rol van ${m.naam}`}
                      className="w-44 py-1.5 text-xs"
                      value={m.rol}
                      onChange={(e) => wijzigRol(m.id, e.target.value as Rol)}
                      opties={ROL_OPTIES}
                    />
                  ) : (
                    <Badge variant={m.rol === 'medewerker' ? 'gray' : 'yellow'}>{rolLabel(m.rol)}</Badge>
                  )}

                  {magGebruikersBeheren && clickupLabels.length > 0 && (
                    <Select
                      aria-label={`ClickUp-naam van ${m.naam}`}
                      className="w-40 py-1.5 text-xs"
                      value={m.clickup_label ?? ''}
                      onChange={(e) => koppelClickUp(m.id, e.target.value)}
                      opties={[
                        { waarde: '', label: 'Geen ClickUp-naam' },
                        ...clickupLabels.map((l) => ({ waarde: l, label: l })),
                      ]}
                    />
                  )}

                  <button
                    onClick={() => m.email && resetWachtwoord(m.email)}
                    disabled={!m.email}
                    className="p-2 text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={m.email ? 'Wachtwoord resetten' : 'Geen e-mailadres bekend'}
                  >
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

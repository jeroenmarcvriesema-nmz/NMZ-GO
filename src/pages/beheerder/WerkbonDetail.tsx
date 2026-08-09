import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { TaakItem } from '@/components/taak/TaakItem'
import { Klusacties } from '@/components/werkbon/Klusacties'
import { Klusinfo } from '@/components/werkbon/Klusinfo'
import { Opleverrapport } from '@/components/werkbon/Opleverrapport'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { useWerkbon } from '@/hooks/useWerkbonnen'
import { useTaken } from '@/hooks/useTaken'
import { berekenVoortgang, formatDatum } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { IconArrowLeft, IconPlus, IconCalendar, IconMapPin, IconUsers, IconFileText, IconAlertCircle } from '@tabler/icons-react'

export default function WerkbonDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { werkbon, loading, refetch } = useWerkbon(id!)
  const { voegToe } = useTaken()
  const [puntModal, setPuntModal] = useState(false)
  const [nieuwPunt, setNieuwPunt] = useState({ titel: '', omschrijving: '' })
  const [opslaan, setOpslaan] = useState(false)
  const [statusFout, setStatusFout] = useState<string | null>(null)

  if (loading) return <PageWrapper title="Werkbon"><div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div></PageWrapper>
  if (!werkbon) return <PageWrapper title="Werkbon"><div className="text-center py-16 text-gray-400 dark:text-white/40">Werkbon niet gevonden.</div></PageWrapper>

  const voortgang = berekenVoortgang(werkbon.taken || [])

  const handlePuntOpslaan = async () => {
    if (!nieuwPunt.titel.trim()) return
    setOpslaan(true)
    await voegToe(werkbon.id, nieuwPunt.titel, nieuwPunt.omschrijving, (werkbon.taken?.length || 0))
    await refetch()
    setNieuwPunt({ titel: '', omschrijving: '' })
    setPuntModal(false)
    setOpslaan(false)
  }

  const handleStatus = async (status: 'open' | 'bezig' | 'voltooid') => {
    setStatusFout(null)
    const { data, error } = await supabase
      .from('werkbonnen')
      .update({ status })
      .eq('id', werkbon.id)
      .select('id')
    if (error || !data || data.length === 0) {
      setStatusFout('De status kon niet worden gewijzigd.')
      return
    }
    await refetch()
  }

  return (
    <PageWrapper title={werkbon.adres} actions={
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => navigate('/werkbonnen')}><IconArrowLeft className="w-4 h-4" /> Terug</Button>
      </div>
    }>
      <div className="max-w-4xl space-y-4">
        <Card accent="yellow">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">{werkbon.adres}</h1>
              <p className="text-sm text-gray-500 dark:text-white/60 mt-0.5">{werkbon.projectnaam}</p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400 dark:text-white/40">
                <span className="flex items-center gap-1"><IconFileText className="w-3.5 h-3.5" />{werkbon.bonnummer}</span>
                <span className="flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" />{formatDatum(werkbon.datum)}</span>
                {werkbon.opdrachtgever && <span className="flex items-center gap-1"><IconMapPin className="w-3.5 h-3.5" />{werkbon.opdrachtgever}</span>}
                {(werkbon.medewerkers || []).length > 0 && (
                  <span className="flex items-center gap-1"><IconUsers className="w-3.5 h-3.5" />{werkbon.medewerkers!.map((m) => m.naam).join(', ')}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <StatusBadge status={werkbon.status} />
              <div className="text-2xl font-extrabold mt-2 text-gray-900 dark:text-white">{voortgang}%</div>
            </div>
          </div>
          <div className="mt-4"><ProgressBar value={voortgang} size="md" variant={voortgang === 100 ? 'green' : 'yellow'} /></div>
          <div className="flex gap-2 mt-4 flex-wrap">
            {(['open','bezig','voltooid'] as const).map((s) => (
              <button key={s} onClick={() => handleStatus(s)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-all ${werkbon.status === s ? 'bg-brand-yellow text-gray-900 border-brand-yellow-dark' : 'bg-white dark:bg-surface-dark-2 text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/30'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {statusFout && (
            <div className="flex items-start gap-2 text-xs text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3 mt-3">
              <IconAlertCircle className="w-4 h-4 flex-shrink-0" />{statusFout}
            </div>
          )}
        </Card>

        {/* Wat kantoor met deze klus kan: stilleggen, hervatten,
            opleveren. Zat al in de database maar had geen knop. */}
        <Klusacties werkbon={werkbon} onKlaar={refetch} />

        {/* Dezelfde kaart die de zwamsaneerder ziet: kluiscode,
            documenten, werkvoorbereiding. Kantoor moet kunnen
            controleren wat de ploeg voor zich krijgt. */}
        <Klusinfo werkbon={werkbon} />

        {/* De drie tekstvelden van het rapport bestonden als kolom sinds
            migratie 002 maar hadden nergens een invoerveld, en
            rapportage_aanvragen() had geen knop. */}
        <Opleverrapport werkbon={werkbon} onKlaar={refetch} />

        <Card>
          <SectionHeading
            title={`Taken (${(werkbon.taken || []).filter((t) => t.voltooid).length}/${(werkbon.taken || []).length})`}
            actions={
              <Button variant="primary" size="sm" onClick={() => setPuntModal(true)}><IconPlus className="w-4 h-4" /> Taak toevoegen</Button>
            }
          />
          {werkbon.taken?.map((taak) => (
            <TaakItem key={taak.id} taak={taak} werkbonId={werkbon.id} readOnly onRefresh={refetch} />
          ))}
          {!werkbon.taken?.length && <p className="text-sm text-gray-400 dark:text-white/40 text-center py-6">Nog geen taken.</p>}
        </Card>
      </div>

      <Modal open={puntModal} onClose={() => setPuntModal(false)} title="Taak toevoegen">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-600 dark:text-white/60">Omschrijving</label>
            <textarea rows={3} placeholder="Bijv. CV-ketel controleren" value={nieuwPunt.titel}
              onChange={(e) => setNieuwPunt((p) => ({ ...p, titel: e.target.value }))}
              className="w-full px-3.5 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none focus:border-brand-yellow resize-y" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-600 dark:text-white/60">Toelichting (optioneel)</label>
            <input type="text" placeholder="Bijv. materiaal in bus" value={nieuwPunt.omschrijving}
              onChange={(e) => setNieuwPunt((p) => ({ ...p, omschrijving: e.target.value }))}
              className="w-full px-3.5 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none focus:border-brand-yellow" />
          </div>
          <Button variant="primary" size="lg" fullWidth loading={opslaan} onClick={handlePuntOpslaan}>
            <IconPlus className="w-4 h-4" /> Toevoegen
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}

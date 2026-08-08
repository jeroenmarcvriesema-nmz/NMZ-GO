import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { TaakItem } from '@/components/taak/TaakItem'
import { Klusinfo } from '@/components/werkbon/Klusinfo'
import { Spinner } from '@/components/ui/Spinner'
import { useWerkbon } from '@/hooks/useWerkbonnen'
import { berekenVoortgang, formatDatum, cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { IconArrowLeft, IconCheck, IconAlertCircle, IconCircleCheck } from '@tabler/icons-react'

export default function WerkbonUitvoeren() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { werkbon, loading, refetch } = useWerkbon(id!)
  const [voltooien, setVoltooien] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  if (loading) return <PageWrapper title="Werkbon"><div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div></PageWrapper>
  if (!werkbon) return <PageWrapper title="Werkbon"><div className="text-center py-16 text-gray-400 dark:text-white/40">Werkbon niet gevonden.</div></PageWrapper>

  const voortgang = berekenVoortgang(werkbon.taken || [])
  const allesAfgevinkt = (werkbon.taken || []).length > 0 && (werkbon.taken || []).every((t) => t.voltooid)

  const voltooiWerkbon = async () => {
    setFout(null)
    setVoltooien(true)
    // `.select()` erbij zodat we zien of er écht een rij is geraakt.
    // Zonder dat geeft een door RLS geblokkeerde update een lege,
    // geldige respons — en zou de monteur "voltooid" zien terwijl er
    // niets is opgeslagen.
    const { data, error } = await supabase
      .from('werkbonnen')
      .update({ status: 'voltooid' })
      .eq('id', werkbon.id)
      .select('id')
    setVoltooien(false)

    // Twee verschillende oorzaken, twee verschillende meldingen.
    // Een fout is techniek (verbinding, server). Nul geraakte rijen
    // betekent dat RLS de update tegenhield — in de praktijk: deze
    // monteur staat niet meer op de werkbon.
    if (error) {
      setFout('Opslaan lukte niet. Controleer je verbinding en probeer het opnieuw.')
      return
    }
    if (!data || data.length === 0) {
      setFout('Je staat niet meer op deze werkbon, dus afronden lukt niet. Vraag de beheerder om je opnieuw in te plannen.')
      return
    }
    navigate('/mijn-werkbonnen')
  }

  return (
    <PageWrapper title={werkbon.adres}>
      <div className="max-w-3xl space-y-4">
        <Card accent="yellow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">{werkbon.adres}</h1>
              <p className="text-sm text-gray-500 dark:text-white/60 mt-0.5">{werkbon.projectnaam}</p>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-1">{formatDatum(werkbon.datum)}</p>
            </div>
            <div className="text-right">
              <div className={cn('text-2xl font-extrabold', voortgang === 100 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white')}>{voortgang}%</div>
              <div className="text-xs text-gray-400 dark:text-white/40">{(werkbon.taken || []).filter((t) => t.voltooid).length}/{(werkbon.taken || []).length} taken</div>
            </div>
          </div>
          <div className="mt-3"><ProgressBar value={voortgang} size="md" variant={voortgang === 100 ? 'green' : 'yellow'} /></div>
        </Card>

        {werkbon.stilgelegd_op && (
          <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 font-bold text-sm text-orange-800 dark:text-orange-300">
              <IconAlertCircle className="w-4 h-4 flex-shrink-0" /> Deze klus ligt stil
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-200/80 mt-1">
              {werkbon.stilleg_reden}
            </div>
          </div>
        )}

        <Klusinfo werkbon={werkbon} />

        {allesAfgevinkt && werkbon.status !== 'voltooid' && (
          <div className="bg-brand-yellow-light dark:bg-brand-yellow/10 border border-brand-yellow rounded-lg p-4">
            <div className="flex items-center gap-2 font-bold text-sm mb-1 text-gray-900 dark:text-white">
              <IconCircleCheck className="w-4 h-4 text-brand-yellow-dark dark:text-brand-yellow" /> Alle taken afgevinkt
            </div>
            <div className="text-xs text-gray-600 dark:text-white/60 mb-3">Rond de werkbon af zodat de beheerder het rapport kan inzien.</div>
            <Button variant="primary" fullWidth loading={voltooien} onClick={voltooiWerkbon}><IconCheck className="w-4 h-4" /> Werkbon voltooien</Button>
            {fout && (
              <div className="flex items-start gap-2 text-xs text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3 mt-3">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0" />{fout}
              </div>
            )}
          </div>
        )}

        {werkbon.status === 'voltooid' && (
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400 font-bold">
              <IconCircleCheck className="w-4 h-4" /> Werkbon voltooid
            </div>
          </div>
        )}

        <Card>
          <SectionHeading title="Taken — maak foto vóór afvinken" />
          {werkbon.taken?.map((taak) => (
            <TaakItem key={taak.id} taak={taak} werkbonId={werkbon.id} readOnly={werkbon.status === 'voltooid'} onRefresh={refetch} />
          ))}
        </Card>

        <Button variant="ghost" onClick={() => navigate('/mijn-werkbonnen')}>
          <IconArrowLeft className="w-4 h-4" /> Terug naar overzicht
        </Button>
      </div>
    </PageWrapper>
  )
}

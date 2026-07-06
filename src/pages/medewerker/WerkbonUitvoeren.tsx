import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { TaakItem } from '@/components/taak/TaakItem'
import { Spinner } from '@/components/ui/Spinner'
import { useWerkbon } from '@/hooks/useWerkbonnen'
import { berekenVoortgang, formatDatum } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'

export default function WerkbonUitvoeren() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { werkbon, loading, refetch } = useWerkbon(id!)

  if (loading) return <PageWrapper title="Werkbon"><div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div></PageWrapper>
  if (!werkbon) return <PageWrapper title="Werkbon"><div className="text-center py-16 text-gray-400">Werkbon niet gevonden.</div></PageWrapper>

  const voortgang = berekenVoortgang(werkbon.taken || [])
  const allesAfgevinkt = (werkbon.taken || []).length > 0 && (werkbon.taken || []).every((t) => t.voltooid)

  const voltooiWerkbon = async () => {
    await supabase.from('werkbonnen').update({ status: 'voltooid' }).eq('id', werkbon.id)
    alert('Werkbon voltooid!')
    navigate('/mijn-werkbonnen')
  }

  return (
    <PageWrapper title={werkbon.adres}>
      <div className="max-w-lg space-y-4">
        <Card accent="yellow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">{werkbon.adres}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{werkbon.projectnaam}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDatum(werkbon.datum)}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold" style={{ color: voortgang === 100 ? '#16a34a' : undefined }}>{voortgang}%</div>
              <div className="text-xs text-gray-400">{(werkbon.taken || []).filter((t) => t.voltooid).length}/{(werkbon.taken || []).length} taken</div>
            </div>
          </div>
          <div className="mt-3"><ProgressBar value={voortgang} size="md" variant={voortgang === 100 ? 'green' : 'yellow'} /></div>
        </Card>

        {allesAfgevinkt && werkbon.status !== 'voltooid' && (
          <div className="bg-brand-yellow-light border border-brand-yellow rounded-lg p-4">
            <div className="font-bold text-sm mb-1">🎉 Alle taken afgevinkt!</div>
            <div className="text-xs text-gray-600 mb-3">Rond de werkbon af zodat de beheerder het rapport kan inzien.</div>
            <Button variant="primary" fullWidth onClick={voltooiWerkbon}><IconCheck className="w-4 h-4" /> Werkbon voltooien</Button>
          </div>
        )}

        {werkbon.status === 'voltooid' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-green-700 font-bold">✅ Werkbon voltooid</div>
          </div>
        )}

        <Card>
          <h2 className="text-sm font-bold mb-4">Taken — maak foto vóór afvinken</h2>
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

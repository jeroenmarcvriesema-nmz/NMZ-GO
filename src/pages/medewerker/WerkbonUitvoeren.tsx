import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Klusuitvoering } from '@/components/werkbon/Klusuitvoering'
import { useWerkbon } from '@/hooks/useWerkbonnen'
import { IconArrowLeft } from '@tabler/icons-react'

/**
 * Eén werkbon uitvoeren, los van de dag van vandaag.
 *
 * Bereikbaar vanuit "Mijn bonnen" en "Mijn week" — dus voor een klus
 * van volgende week of een die je gisteren niet afkreeg. De bon van
 * vandáág staat op het Vandaag-scherm zelf; daar zat vroeger een knop
 * "Werkbon openen" die naar hier sprong en dezelfde bon nog een keer
 * liet zien, maar dan mooier. Die knop is weg: beide schermen tekenen
 * nu hetzelfde blok.
 *
 * Wat hier ontbreekt en op Vandaag wel staat, is de werkdag — starten
 * en stoppen hoort bij de dag, niet bij een bon van volgende week.
 */
export default function WerkbonUitvoeren() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { werkbon, loading, error, refetch } = useWerkbon(id)

  if (loading) return <PageWrapper title="Werkbon"><div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div></PageWrapper>
  if (!werkbon) return <PageWrapper title="Werkbon"><div className="text-center py-16 text-tekst-gedempt dark:text-white/55">Werkbon niet gevonden.</div></PageWrapper>

  return (
    <PageWrapper title={werkbon.adres}>
      <div className="max-w-3xl space-y-4">
        <Klusuitvoering
          werkbon={werkbon}
          ophaalfout={error}
          onRefresh={refetch}
          onVoltooid={() => navigate('/mijn-werkbonnen')}
        />

        <Button variant="ghost" onClick={() => navigate('/mijn-werkbonnen')}>
          <IconArrowLeft className="w-4 h-4" /> Terug naar overzicht
        </Button>
      </div>
    </PageWrapper>
  )
}

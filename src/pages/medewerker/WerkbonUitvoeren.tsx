import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Klusuitvoering } from '@/components/werkbon/Klusuitvoering'
import { useWerkbon } from '@/hooks/useWerkbonnen'
import { useWerkdag } from '@/hooks/useWerkdag'
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
 *
 * Maar de eis geldt hier wél. Dit scherm was namelijk het gat: op
 * Vandaag moet je eerst op start drukken voordat je kunt afvinken, en
 * wie via Mijn bonnen dezelfde bon opende kon het gewoon doen. Eén app
 * die op het ene scherm iets weigert dat op het andere mag is geen
 * controle.
 *
 * De startknop komt er niet bij staan, en dat is opzet. Hier kun je een
 * bon van volgende week openen; een knop die dáár een werkdag start
 * zet je om tien uur 's ochtends geklokt op een adres waar je niet
 * bent, en dat is precies de vervuiling die de urenregistratie en de
 * tegels van kantoor onbruikbaar maakt. Dus wijst de uitleg naar
 * Vandaag, waar de knop hoort en waar hij de goede bon pakt.
 */
export default function WerkbonUitvoeren() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { werkbon, loading, error, refetch } = useWerkbon(id)
  // Alleen lezen: deze hook doet bij het openen één select en verder
  // niets. Start en stop laten we bewust links liggen.
  const { state: werkdag } = useWerkdag(id ?? null)

  if (loading) return <PageWrapper title="Werkbon"><div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div></PageWrapper>
  if (!werkbon) return <PageWrapper title="Werkbon"><div className="text-center py-16 text-tekst-gedempt dark:text-white/55">Werkbon niet gevonden.</div></PageWrapper>

  // Zolang de werkdag nog wordt opgehaald staat de fase op
  // `voor_start`, en dan geldt de eis. Dat is de goede kant om op te
  // vergissen: even te veel uitleg is beter dan een punt dat
  // ongeklokt door de mazen glipt.
  const werkdagNodig = werkdag.fase === 'actief'
    ? undefined
    : {
        fase: werkdag.fase,
        onStart: () => navigate('/mijn-werkbonnen'),
        knop: 'Naar Vandaag',
        uitleg: werkdag.fase === 'gestopt'
          ? 'Je werkdag op deze bon is gestopt. Hervat hem op Vandaag, dan kun je hier verder.'
          : 'Je werkdag start je op Vandaag. Daarna kun je hier afvinken en foto’s toevoegen.',
      }

  return (
    <PageWrapper title={werkbon.adres}>
      <div className="max-w-3xl space-y-4">
        <Klusuitvoering
          werkbon={werkbon}
          ophaalfout={error}
          werkdagNodig={werkdagNodig}
          bijschrift={werkdagNodig
            ? 'Start je werkdag op Vandaag — daarna kun je hier afvinken'
            : 'Maak een foto vóór je afvinkt'}
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

import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { berekenVoortgang, cn } from '@/lib/utils'
import type { Werkbon } from '@/types'
import {
  IconCalendarWeek, IconMapPin, IconListCheck,
  IconChevronRight, IconAlertTriangle, IconKey,
} from '@tabler/icons-react'

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

function iso(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Maandag van de week waar deze datum in valt. */
function maandagVan(d: Date): Date {
  const kopie = new Date(d)
  const dag = (kopie.getDay() + 6) % 7 // maandag = 0
  kopie.setDate(kopie.getDate() - dag)
  kopie.setHours(0, 0, 0, 0)
  return kopie
}

/**
 * Mijn week — welke klussen staan er voor me, en wanneer.
 *
 * Dit scherm bestond niet. Een zwamsaneerder zag alleen de klus van
 * vandaag, terwijl de planning weken vooruit loopt en hij op meerdere
 * bonnen staat. "Wat doe ik donderdag" was niet te beantwoorden zonder
 * het aan kantoor te vragen.
 *
 * Vijf dagen naast elkaar op een breed scherm, onder elkaar op een
 * telefoon. Een klus die meerdere dagen duurt staat op elke dag waarop
 * hij loopt — want dat is de vraag die je stelt: wat doe ik díe dag.
 */
export default function MijnWeek() {
  const { werkbonnen, loading } = useWerkbonnen()
  const navigate = useNavigate()

  const maandag = maandagVan(new Date())
  const dagen = Array.from({ length: 5 }, (_, n) => {
    const d = new Date(maandag)
    d.setDate(maandag.getDate() + n)
    return d
  })

  const vandaag = iso(new Date())

  const opDag = (dag: Date): Werkbon[] => {
    const d = iso(dag)
    return werkbonnen.filter((w) => {
      const start = w.geplande_start ?? w.datum
      const eind = w.geplande_eind ?? start
      return start <= d && eind >= d
    })
  }

  // Klussen die buiten deze week vallen maar wél van mij zijn. Zonder
  // dit lijkt het alsof je niets hebt zodra je week leeg is, terwijl er
  // volgende week gewoon werk staat.
  const buitenDeWeek = werkbonnen.filter((w) => {
    const start = w.geplande_start ?? w.datum
    return start > iso(dagen[4]) && w.status !== 'voltooid'
  })

  if (loading) {
    return (
      <PageWrapper title="Mijn week">
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Mijn week">
      <div className="max-w-6xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {dagen.map((dag) => {
            const d = iso(dag)
            const bonnen = opDag(dag)
            const isVandaag = d === vandaag

            return (
              <div key={d} className="min-w-0">
                <div className={cn(
                  'flex items-baseline gap-2 px-1 pb-2 mb-2 border-b-2',
                  isVandaag ? 'border-brand-yellow' : 'border-gray-100 dark:border-white/10'
                )}>
                  <span className={cn(
                    'text-sm font-bold capitalize',
                    isVandaag ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-white/50'
                  )}>
                    {DAGEN[dag.getDay()]}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-white/40">
                    {dag.getDate()}/{dag.getMonth() + 1}
                  </span>
                  {isVandaag && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-brand-yellow-dark dark:text-brand-yellow">
                      vandaag
                    </span>
                  )}
                </div>

                {bonnen.length === 0 ? (
                  <p className="px-1 py-6 text-xs text-gray-300 dark:text-white/25 text-center">
                    niets gepland
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bonnen.map((w) => <DagKaart key={w.id} werkbon={w} onOpen={() => navigate(`/werkbon/${w.id}`)} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {buitenDeWeek.length > 0 && (
          <Card>
            <SectionHeading title={`Verderop ingepland (${buitenDeWeek.length})`} />
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {buitenDeWeek.map((w) => (
                <button
                  key={w.id}
                  onClick={() => navigate(`/werkbon/${w.id}`)}
                  className="flex items-center gap-3 w-full py-3 text-left hover:bg-brand-yellow-light/40 dark:hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-gray-900 dark:text-white">
                      {w.adres}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-white/40">
                      vanaf {w.geplande_start ?? w.datum} · {(w.taken ?? []).length} punten
                    </div>
                  </div>
                  <IconChevronRight className="w-4 h-4 flex-shrink-0 text-gray-300 dark:text-white/25" />
                </button>
              ))}
            </div>
          </Card>
        )}

        {werkbonnen.length === 0 && (
          <Card>
            <EmptyState
              icon={<IconCalendarWeek />}
              titel="Nog geen klussen"
              uitleg="Zodra je op een klus wordt ingepland verschijnt hij hier. Neem contact op met je uitvoerder als je wél werk verwacht."
            />
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}

function DagKaart({ werkbon, onOpen }: { werkbon: Werkbon; onOpen: () => void }) {
  const taken = werkbon.taken ?? []
  const voortgang = berekenVoortgang(taken)
  const stil = Boolean(werkbon.stilgelegd_op)

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full text-left rounded-lg border bg-white dark:bg-surface-dark-2 p-3 shadow-sm',
        'hover:border-brand-yellow transition-colors duration-150 ease-brand',
        stil
          ? 'border-orange-300 dark:border-orange-500/40'
          : 'border-gray-100 dark:border-white/10'
      )}
    >
      <div className="flex items-start gap-1.5">
        <IconMapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400 dark:text-white/40" />
        <span className="text-sm font-semibold leading-snug text-gray-900 dark:text-white">
          {werkbon.adres}
        </span>
      </div>

      {stil && (
        <div className="flex items-start gap-1.5 mt-2 text-xs text-orange-700 dark:text-orange-300">
          <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-snug">Ligt stil — {werkbon.stilleg_reden}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <Badge variant={voortgang === 100 ? 'green' : voortgang > 0 ? 'yellow' : 'gray'}>
          {voortgang}%
        </Badge>
        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/40">
          <IconListCheck className="w-3.5 h-3.5" />{taken.length}
        </span>
        {/* De kluiscode staat hier bewust bij: dan hoef je de bon niet
            te openen om te weten of je erin komt. */}
        {werkbon.kluiscode && (
          <span className="flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-500 dark:text-white/50">
            <IconKey className="w-3.5 h-3.5" />{werkbon.kluiscode}
          </span>
        )}
      </div>
    </button>
  )
}

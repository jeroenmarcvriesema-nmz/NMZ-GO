import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { berekenVoortgang, formatDatum, cn } from '@/lib/utils'
import { standkleur, KLEURWAS } from '@/lib/klusstand'
import { isoDatum, maandagVerschoven, weekDagen, looptOp, inWeek, duurLabel } from '@/lib/planning'
import { Weekkiezer } from '@/components/layout/Weekkiezer'
import type { Werkbon } from '@/types'
import {
  IconCalendarWeek, IconMapPin, IconListCheck,
  IconChevronRight, IconAlertTriangle, IconKey,
} from '@tabler/icons-react'

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

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

  // Vooruit kijken mag. Starten kan alleen in de week zelf — dat zit
  // in de werkdag en niet hier — maar wéten wat er aankomt hoort geen
  // voorrecht van kantoor te zijn. Wie maandag al ziet dat hij
  // donderdag in Haarlem staat, regelt zijn eigen vervoer.
  const [week, setWeek] = useState(0)

  const maandag = maandagVerschoven(week)
  const dagen = weekDagen(maandag)

  const vandaag = isoDatum()

  // Hoeveel klussen staan er in de week die je bekijkt. Zonder dat
  // getal blader je door lege kolommen zonder te weten of dat klopt.
  const dezeWeek = werkbonnen.filter((w) => inWeek(w, maandag))

  const opDag = (dag: Date): Werkbon[] => {
    const d = isoDatum(dag)
    return werkbonnen.filter((w) => looptOp(w, d))
  }

  // Klussen die buiten deze week vallen maar wél van mij zijn. Zonder
  // dit lijkt het alsof je niets hebt zodra je week leeg is, terwijl er
  // volgende week gewoon werk staat.
  const buitenDeWeek = werkbonnen.filter((w) => {
    const start = w.geplande_start ?? w.datum
    return start > isoDatum(dagen[dagen.length - 1]) && w.status !== 'voltooid'
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
        <Weekkiezer
          week={week}
          onWissel={setWeek}
          telling={`${dezeWeek.length} ${dezeWeek.length === 1 ? 'klus' : 'klussen'}`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {dagen.map((dag) => {
            const d = isoDatum(dag)
            const bonnen = opDag(dag)
            const isVandaag = d === vandaag

            return (
              <div key={d} className="min-w-0">
                {/* flex-wrap en min-w-0: in zes kolommen naast elkaar
                    past "Woensdag 12/8 vandaag" niet op één regel, en
                    zonder dit schoof het woord "vandaag" over de kop van
                    donderdag heen. */}
                <div className={cn(
                  'flex flex-wrap items-baseline gap-x-2 px-1 pb-2 mb-2 border-b-2',
                  isVandaag ? 'border-brand-yellow' : 'border-gray-100 dark:border-white/10'
                )}>
                  <span className={cn(
                    'text-sm font-bold capitalize min-w-0 truncate',
                    isVandaag ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-white/50'
                  )}>
                    {DAGEN[dag.getDay()]}
                  </span>
                  <span className="text-xs text-tekst-gedempt dark:text-white/55">
                    {dag.getDate()}/{dag.getMonth() + 1}
                  </span>
                  {isVandaag && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-yellow-tekst dark:text-brand-yellow">
                      vandaag
                    </span>
                  )}
                </div>

                {bonnen.length === 0 ? (
                  <p className="px-1 py-6 text-xs text-tekst-fijn dark:text-white/40 text-center">
                    niets gepland
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bonnen.map((w) => <DagKaart key={w.id} werkbon={w} dag={d} onOpen={() => navigate(`/werkbon/${w.id}`)} />)}
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
                    <div className="text-xs text-tekst-gedempt dark:text-white/55">
                      vanaf {formatDatum(w.geplande_start ?? w.datum)} · {(w.taken ?? []).length} punten
                    </div>
                  </div>
                  <IconChevronRight className="w-4 h-4 flex-shrink-0 text-tekst-fijn dark:text-white/40" />
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

function DagKaart({ werkbon, dag, onOpen }: { werkbon: Werkbon; dag: string; onOpen: () => void }) {
  const taken = werkbon.taken ?? []
  const voortgang = berekenVoortgang(taken)
  const stil = Boolean(werkbon.stilgelegd_op)
  const k = standkleur(werkbon)

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full text-left rounded-lg border border-l-4 p-3 shadow-sm',
        'hover:border-brand-yellow transition-colors duration-150 ease-brand',
        KLEURWAS ? k.vlak : 'bg-white dark:bg-surface-dark-2',
        KLEURWAS ? k.omlijsting : 'border-gray-100 dark:border-white/10',
        k.rand
      )}
    >
      <div className="flex items-start gap-1.5">
        <IconMapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-tekst-gedempt dark:text-white/55" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug text-gray-900 dark:text-white">
            {werkbon.adres}
          </span>
          {/* Waar in de klus deze dag zit. Zonder dit staan een klus van
              tien dagen en een spoedje van twee er precies hetzelfde
              bij, en is niet te zien welke van de twee die dag af moet. */}
          <span className="block text-xs text-gray-500 dark:text-white/50 mt-0.5">
            {duurLabel(werkbon, dag)}
          </span>
        </span>
      </div>

      {stil && (
        <div className="flex items-start gap-1.5 mt-2 text-xs text-orange-700 dark:text-orange-300">
          <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {/* Zonder "Ligt stil" ervoor: dat staat al als stand
              onder deze regel, en twee keer hetzelfde in een kolom van
              honderdvijftig pixels is zonde van de ruimte. */}
          <span className="leading-snug">{werkbon.stilleg_reden}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <span className={cn('flex items-center gap-1.5 text-xs font-semibold min-w-0', k.tekst)}>
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', k.bol)} />
          <span className="truncate">{k.kort}</span>
        </span>
        <span className="text-xs font-bold tabular-nums text-gray-500 dark:text-white/50">
          {voortgang}%
        </span>
        <span className="flex items-center gap-1 text-xs text-tekst-gedempt dark:text-white/55">
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

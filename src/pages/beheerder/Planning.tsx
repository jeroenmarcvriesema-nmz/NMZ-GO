import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Spinner } from '@/components/ui/Spinner'
import { usePlanning } from '@/hooks/useProjecten'
import { PlanningKaart } from '@/components/werkbon/PlanningKaart'
import { Weekkiezer } from '@/components/layout/Weekkiezer'
import { cn, formatDatumKort } from '@/lib/utils'
import { isoDatum, weekDagen, maandagVerschoven } from '@/lib/planning'
import { IconAlertTriangle } from '@tabler/icons-react'

const DAG_NAMEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag']

export default function Planning() {
  const { planning, loading } = usePlanning()
  const navigate = useNavigate()
  // Vooruit en achteruit bladeren. De planning liep alleen over de
  // huidige week, terwijl er werk staat tot ver in de maand — en na een
  // uitloop wil je juist terugkijken.
  const [week, setWeek] = useState(0)
  const dagen = weekDagen(maandagVerschoven(week))
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)

  // Wat staat er in déze week. Hier stond het totaal over alle weken —
  // dat getal veranderde dus niet als je bladerde, en dat is precies het
  // moment waarop je niet meer weet welke week je bekijkt.
  const vanWeek = isoDatum(dagen[0])
  const totWeek = isoDatum(dagen[4])
  const dezeWeek = planning.filter((p) => p.datum <= totWeek && (p.eind ?? p.datum) >= vanWeek)

  /**
   * Wie staat er op deze dag op meer dan één klus?
   *
   * ClickUp kent alleen een start- en een einddatum, dus een klus van
   * drie weken vult alle dagen ertussen — ook de dagen waarop de ploeg
   * ergens anders is. Dat kunnen we niet weten en niet oplossen.
   *
   * Wat we wél kunnen: het zichtbaar maken. Staat iemand op één dag op
   * twee klussen, dan is dat óf een fout in de planning, óf een klus
   * die feitelijk even stilligt. In beide gevallen wil je het maandag
   * zien en niet donderdag horen.
   */
  const dubbelOpDag = (items: typeof planning): Set<string> => {
    const geteld = new Map<string, number>()
    for (const item of items) {
      for (const naam of item.medewerkers) {
        geteld.set(naam, (geteld.get(naam) ?? 0) + 1)
      }
    }
    return new Set([...geteld].filter(([, n]) => n > 1).map(([naam]) => naam))
  }

  if (loading) {
    return (
      <PageWrapper title="Planning">
        <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Weekplanning">
      <Weekkiezer
        week={week}
        onWissel={setWeek}
        telling={`${dezeWeek.length} ${dezeWeek.length === 1 ? 'klus' : 'klussen'}`}
        className="mb-6"
      />

      {/* Desktop: 5-kolommen grid */}
      <div className="hidden md:grid grid-cols-5 gap-4">
        {dagen.map((dag, i) => {
          const dagStr = isoDatum(dag)
          const isVandaag = dag.getTime() === vandaag.getTime()
          const dagItems = planning.filter((p) => p.datum <= dagStr && (p.eind ?? p.datum) >= dagStr)

          return (
            <div key={i} className="flex flex-col">
              {/* Dag header */}
              <div
                className={cn(
                  'rounded-t-xl px-3 py-2.5 border-b',
                  isVandaag
                    ? 'bg-brand-yellow border-brand-yellow-dark'
                    : 'bg-white dark:bg-surface-dark-2 border-gray-100 dark:border-white/10'
                )}
              >
                <div className={cn('text-sm font-bold', isVandaag ? 'text-gray-900' : 'text-gray-700 dark:text-white/80')}>
                  {DAG_NAMEN[i]}
                </div>
                <div className={cn('text-xs', isVandaag ? 'text-gray-700' : 'text-gray-400 dark:text-white/40')}>
                  {formatDatumKort(dag)}
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 bg-white dark:bg-surface-dark-2 border border-t-0 border-gray-100 dark:border-white/10 rounded-b-xl p-2 space-y-2 min-h-[120px]">
                {(() => {
                  const dubbel = dubbelOpDag(dagItems)
                  return dubbel.size > 0 ? (
                    <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-sm bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/30">
                      <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
                      <span className="text-[11px] leading-snug text-orange-800 dark:text-orange-300">
                        {[...dubbel].join(', ')} op meerdere klussen
                      </span>
                    </div>
                  ) : null
                })()}

                {dagItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-6">
                    <span className="text-xs text-gray-300 dark:text-white/30">Vrij</span>
                  </div>
                ) : (
                  dagItems.map((item) => (
                    <PlanningKaart
                      key={item.id}
                      item={item}
                      onOpen={() => navigate(`/werkbonnen/${item.id}`)}
                      loopIn={item.datum < dagStr}
                      loopUit={(item.eind ?? item.datum) > dagStr}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: gestapeld per dag */}
      <div className="md:hidden space-y-4">
        {dagen.map((dag, i) => {
          const dagStr = isoDatum(dag)
          const isVandaag = dag.getTime() === vandaag.getTime()
          const dagItems = planning.filter((p) => p.datum <= dagStr && (p.eind ?? p.datum) >= dagStr)

          return (
            <div key={i} className="bg-white dark:bg-surface-dark-2 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
              <div className={cn('px-4 py-3 flex items-center justify-between', isVandaag ? 'bg-brand-yellow' : 'bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10')}>
                <div>
                  <span className={cn('text-sm font-bold', isVandaag ? 'text-gray-900' : 'text-gray-700 dark:text-white/80')}>
                    {DAG_NAMEN[i]}
                  </span>
                  <span className={cn('text-xs ml-2', isVandaag ? 'text-gray-700' : 'text-gray-400 dark:text-white/40')}>
                    {formatDatumKort(dag)}
                  </span>
                </div>
                {dagItems.length > 0 && (
                  <span className="text-xs font-bold bg-white/50 dark:bg-white/10 text-gray-700 dark:text-white/80 px-2 py-0.5 rounded-full">
                    {dagItems.length}
                  </span>
                )}
              </div>
              {dagItems.length === 0 ? (
                <div className="px-4 py-5 text-sm text-gray-300 dark:text-white/30 text-center">Niets ingepland</div>
              ) : (
                <div className="p-3 space-y-2">
                  {(() => {
                    const dubbel = dubbelOpDag(dagItems)
                    return dubbel.size > 0 ? (
                      <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-sm bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/30">
                        <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
                        <span className="text-[11px] leading-snug text-orange-800 dark:text-orange-300">
                          {[...dubbel].join(', ')} op meerdere klussen
                        </span>
                      </div>
                    ) : null
                  })()}
                  {dagItems.map((item) => (
                    <PlanningKaart
                      key={item.id}
                      item={item}
                      ruim
                      onOpen={() => navigate(`/werkbonnen/${item.id}`)}
                      loopIn={item.datum < dagStr}
                      loopUit={(item.eind ?? item.datum) > dagStr}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </PageWrapper>
  )
}

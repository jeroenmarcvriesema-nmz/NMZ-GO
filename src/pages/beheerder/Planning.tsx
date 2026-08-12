import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Select'
import { usePlanning } from '@/hooks/useProjecten'
import { PlanningKaart } from '@/components/werkbon/PlanningKaart'
import { Weekkiezer } from '@/components/layout/Weekkiezer'
import { cn, formatDatumKort } from '@/lib/utils'
import { isoDatum, weekDagen, maandagVerschoven } from '@/lib/planning'
import { zoektMee } from '@/lib/zoeken'
import type { PlanningItem } from '@/types'
import { IconAlertTriangle, IconSearch, IconX } from '@tabler/icons-react'

// Zes dagen: zaterdag wordt gebruikt om dingen af te maken en voor
// garantiewerk, en hoort dus gewoon in de planning.
const DAG_NAMEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

export default function Planning() {
  const { planning, loading } = usePlanning()
  const navigate = useNavigate()
  // Vooruit en achteruit bladeren. De planning liep alleen over de
  // huidige week, terwijl er werk staat tot ver in de maand — en na een
  // uitloop wil je juist terugkijken.
  const [week, setWeek] = useState(0)
  // Twee vragen die een planner elke dag stelt en waar bladeren geen
  // antwoord op geeft: "waar staat Mario deze week" en "zit dat adres
  // er al ergens in". Een filter op ploeg en een zoekveld beantwoorden
  // ze allebei zonder de weekindeling los te laten.
  const [ploeg, setPloeg] = useState('alle')
  const [zoek, setZoek] = useState('')
  const dagen = weekDagen(maandagVerschoven(week))
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)

  // Iedereen die deze maand ergens op staat, één keer, op alfabet.
  const ploegen = [...new Set(planning.flatMap((p) => p.medewerkers))].sort((a, b) => a.localeCompare(b))

  const past = (p: PlanningItem) =>
    (ploeg === 'alle' || p.medewerkers.includes(ploeg)) &&
    zoektMee(
      {
        adres: p.adres,
        plaats: p.plaats,
        bonnummer: p.bonnummer,
        kluiscode: p.kluiscode,
        medewerkers: p.medewerkers.map((naam) => ({ naam })),
      },
      zoek
    )

  const zichtbaar = planning.filter(past)
  const filtersAan = ploeg !== 'alle' || zoek.trim() !== ''

  // Wat staat er in déze week. Hier stond het totaal over alle weken —
  // dat getal veranderde dus niet als je bladerde, en dat is precies het
  // moment waarop je niet meer weet welke week je bekijkt.
  const vanWeek = isoDatum(dagen[0])
  const totWeek = isoDatum(dagen[dagen.length - 1])
  const dezeWeek = zichtbaar.filter((p) => p.datum <= totWeek && (p.eind ?? p.datum) >= vanWeek)

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
        className="mb-4"
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Adres, plaats of bonnummer…"
            className="w-full min-h-[44px] pl-9 pr-4 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20"
          />
        </div>

        {/* Alleen tonen als er iemand te kiezen valt. Een lege
            keuzelijst is een knop die niets doet. */}
        {ploegen.length > 0 && (
          <div className="sm:w-56">
            <Select
              name="ploeg"
              value={ploeg}
              onChange={(e) => setPloeg(e.target.value)}
              className="min-h-[44px]"
              opties={[
                { waarde: 'alle', label: 'Hele ploeg' },
                ...ploegen.map((naam) => ({ waarde: naam, label: naam })),
              ]}
            />
          </div>
        )}

        {filtersAan && (
          <button
            onClick={() => { setPloeg('alle'); setZoek('') }}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-sm text-sm font-semibold text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
          >
            <IconX className="w-4 h-4" /> Filter wissen
          </button>
        )}
      </div>

      {/* Zonder deze regel lijkt een lege week een lege week, terwijl er
          een filter aan staat die je twee schermen geleden hebt gezet. */}
      {filtersAan && (
        <p className="text-xs text-gray-400 dark:text-white/40 -mt-2 mb-4">
          Je ziet {dezeWeek.length} van de {planning.filter((p) => p.datum <= totWeek && (p.eind ?? p.datum) >= vanWeek).length} klussen in deze week.
          {ploeg !== 'alle' && ` Alleen waar ${ploeg} op staat.`}
        </p>
      )}

      {/* Desktop: 5-kolommen grid */}
      <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-6 gap-4">
        {dagen.map((dag, i) => {
          const dagStr = isoDatum(dag)
          const isVandaag = dag.getTime() === vandaag.getTime()
          const dagItems = zichtbaar.filter((p) => p.datum <= dagStr && (p.eind ?? p.datum) >= dagStr)

          return (
            <div
              key={i}
              className={cn(
                // Eén omhulsel om kop en inhoud in plaats van twee losse
                // vlakken die tegen elkaar aan liggen: zo is een dag
                // zichtbaar één ding, en kan vandaag als geheel oplichten
                // in plaats van alleen een gele hoed te krijgen.
                'flex flex-col rounded-xl border overflow-hidden shadow-sm',
                isVandaag
                  ? 'border-brand-yellow ring-1 ring-brand-yellow/40'
                  : 'border-gray-100 dark:border-white/10'
              )}
            >
              {/* Dag header */}
              <div
                className={cn(
                  'px-3 py-2.5 border-b',
                  isVandaag
                    ? 'bg-brand-yellow border-brand-yellow-dark'
                    // Stond in hetzelfde wit als de inhoud eronder, en
                    // las daardoor niet als kop.
                    : 'bg-surface-2 dark:bg-surface-dark-3 border-gray-100 dark:border-white/10'
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
              <div className="flex-1 bg-white dark:bg-surface-dark-2 p-2 space-y-2 min-h-[120px]">
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
                    {/* "Vrij" met een filter aan is onwaar: er staat
                        misschien van alles, alleen niet van deze man. */}
                    <span className="text-xs text-gray-300 dark:text-white/30">
                      {filtersAan ? 'Niets in dit filter' : 'Vrij'}
                    </span>
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
          const dagItems = zichtbaar.filter((p) => p.datum <= dagStr && (p.eind ?? p.datum) >= dagStr)

          return (
            <div className={cn(
              'bg-white dark:bg-surface-dark-2 rounded-xl border shadow-sm overflow-hidden',
              isVandaag
                ? 'border-brand-yellow ring-1 ring-brand-yellow/40'
                : 'border-gray-100 dark:border-white/10'
            )} key={i}>
              <div className={cn('px-4 py-3 flex items-center justify-between', isVandaag ? 'bg-brand-yellow' : 'bg-surface-2 dark:bg-surface-dark-3 border-b border-gray-100 dark:border-white/10')}>
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
                <div className="px-4 py-5 text-sm text-gray-300 dark:text-white/30 text-center">
                  {filtersAan ? 'Niets in dit filter' : 'Niets ingepland'}
                </div>
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

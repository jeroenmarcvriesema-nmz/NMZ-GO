import { weekDagen, weeknummer, weekLabel, maandagVerschoven } from '@/lib/planning'
import { cn } from '@/lib/utils'
import { IconChevronLeft, IconChevronRight, IconCalendarWeek } from '@tabler/icons-react'

interface WeekkiezerProps {
  /** 0 = deze week, 1 = volgende week, -1 = vorige. */
  week: number
  onWissel: (week: number) => void
  /** Bijv. "8 klussen" — telt wat er in de getoonde week staat. */
  telling?: string
  className?: string
}

const MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

/** "10 – 14 augustus", of "29 sep – 3 okt" als de week over de maandgrens loopt. */
function periode(van: Date, tot: Date): string {
  if (van.getMonth() === tot.getMonth()) {
    return `${van.getDate()} – ${tot.getDate()} ${MAANDEN[tot.getMonth()]}`
  }
  return `${van.getDate()} ${MAANDEN[van.getMonth()].slice(0, 3)} – ${tot.getDate()} ${MAANDEN[tot.getMonth()].slice(0, 3)}`
}

/**
 * De weekkiezer, één keer gebouwd voor alle schermen die per week
 * kijken: de planning en de werkbonnen van kantoor, en "mijn week" van
 * de zwamsaneerder.
 *
 * Waarom dit één component is: die drie schermen hadden alle drie hun
 * eigen versie, of helemaal geen. Op de planning stond wel een pijltje
 * maar geen weeknummer, dus je kon bladeren zonder te weten waarheen.
 * Dat is precies de vraag die iemand stelt — "welke week zie ik nu?" —
 * en het antwoord hoort op alle drie de schermen hetzelfde te zijn.
 *
 * Het weeknummer staat vooraan omdat er in weeknummers gepland wordt:
 * dat is wat er in ClickUp staat en wat er in de bus wordt gezegd. De
 * datums staan eronder voor wie het even niet paraat heeft.
 */
export function Weekkiezer({ week, onWissel, telling, className }: WeekkiezerProps) {
  const maandag = maandagVerschoven(week)
  const dagen = weekDagen(maandag)
  const nummer = weeknummer(maandag)
  const isNu = week === 0

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onWissel(week - 1)}
          aria-label="Vorige week"
          title="Vorige week"
          className="flex items-center justify-center w-11 h-11 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 text-gray-500 dark:text-white/50 hover:border-brand-yellow hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <IconChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onWissel(week + 1)}
          aria-label="Volgende week"
          title="Volgende week"
          className="flex items-center justify-center w-11 h-11 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 text-gray-500 dark:text-white/50 hover:border-brand-yellow hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          'flex items-center justify-center w-11 h-11 rounded-lg flex-shrink-0',
          isNu
            ? 'bg-brand-yellow text-gray-900'
            : 'bg-surface-2 dark:bg-white/5 text-gray-400 dark:text-white/40'
        )}>
          <IconCalendarWeek className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
              Week {nummer}
            </span>
            <span className={cn(
              'text-xs font-bold uppercase tracking-widest',
              isNu ? 'text-brand-yellow-dark dark:text-brand-yellow' : 'text-gray-400 dark:text-white/40'
            )}>
              {weekLabel(week)}
            </span>
          </div>
          <div className="text-xs text-gray-400 dark:text-white/40">
            {periode(dagen[0], dagen[4])}
            {telling && <> · {telling}</>}
          </div>
        </div>
      </div>

      {!isNu && (
        <button
          onClick={() => onWissel(0)}
          className="min-h-[44px] px-3 rounded-sm text-sm font-semibold text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
        >
          Naar deze week
        </button>
      )}
    </div>
  )
}

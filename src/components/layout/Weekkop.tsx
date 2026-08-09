import { weekDagen, weeknummer, maandagVanWerkweek, isoDatum } from '@/lib/planning'
import { cn } from '@/lib/utils'

const MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

function periode(van: Date, tot: Date): string {
  if (van.getMonth() === tot.getMonth()) {
    return `${van.getDate()} – ${tot.getDate()} ${MAANDEN[tot.getMonth()]}`
  }
  return `${van.getDate()} ${MAANDEN[van.getMonth()].slice(0, 3)} – ${tot.getDate()} ${MAANDEN[tot.getMonth()].slice(0, 3)}`
}

/**
 * De scheidingsregel boven een blok klussen van dezelfde week.
 *
 * Voor de lijsten waar je niet per week bladert maar alles onder elkaar
 * ziet. Zonder dit is een lijst van dertig bonnen een rij adressen
 * zonder tijd erin — je ziet wél dat er werk staat, maar niet wannéér.
 *
 * De week die nu loopt is gemarkeerd. In het weekend is dat de week die
 * maandag begint, want dat is waar je dan naar kijkt.
 */
export function Weekkop({ maandag, nummer }: { maandag: Date; nummer?: number }) {
  const dagen = weekDagen(maandag)
  const nu = isoDatum(maandagVanWerkweek()) === isoDatum(maandag)
  const wk = nummer ?? weeknummer(maandag)

  return (
    <div className="flex items-baseline gap-2.5 pt-2 pb-1">
      <span className={cn(
        'text-sm font-extrabold tracking-tight',
        nu ? 'text-brand-yellow-dark dark:text-brand-yellow' : 'text-gray-900 dark:text-white'
      )}>
        Week {wk}
      </span>
      <span className="text-xs text-gray-400 dark:text-white/40">
        {periode(dagen[0], dagen[4])}
      </span>
      {nu && (
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-yellow-dark dark:text-brand-yellow">
          nu
        </span>
      )}
      <span className="flex-1 h-px bg-gray-100 dark:bg-white/10 ml-1" />
    </div>
  )
}

import { cn } from '@/lib/utils'
import { STANDEN, STANDVOLGORDE, type Klusstand } from '@/lib/klusstand'

export type Standverdeling = Partial<Record<Klusstand, number>>

interface StandbalkProps {
  verdeling: Standverdeling
  /** Namen en aantallen onder de balk. Uit bij een strook van één regel. */
  legenda?: boolean
  /**
   * Legenda als kolommen met rijen in plaats van als losse woorden.
   *
   * Op een kaart met ruimte eronder leest een rij per stand beter dan
   * een zin die doorloopt: de aantallen staan onder elkaar en zijn te
   * vergelijken, en de kaart vult zich in plaats van dat de balk
   * bovenin blijft hangen met wit eronder.
   */
  rijen?: boolean
  dik?: boolean
  className?: string
  /** Wat er staat als alles nul is. */
  leeg?: string
}

/**
 * De werkvoorraad als één balk.
 *
 * Vijf getallen naast elkaar vertellen hoevéél er is, maar niet hoe het
 * eruitziet. Eén balk doet dat wel: je ziet in één oogopslag of de week
 * vooral uit wachtend werk bestaat of vooral uit klussen die lopen, en
 * of dat rode stukje groot of klein is.
 *
 * Geen nieuwe kleuren — dezelfde tabel als de kaarten, de badges en de
 * planning. De volgorde is die van `STANDVOLGORDE`: wat aandacht vraagt
 * staat links, waar je begint met lezen.
 *
 * Standen die op nul staan krijgen geen segment. Een balk met vijf
 * onzichtbare stukjes erin is een balk met een rafelrand.
 */
export function Standbalk({ verdeling, legenda = true, rijen, dik, className, leeg }: StandbalkProps) {
  const delen = (Object.entries(verdeling) as [Klusstand, number][])
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => STANDVOLGORDE[a] - STANDVOLGORDE[b])

  const totaal = delen.reduce((n, [, aantal]) => n + aantal, 0)

  if (totaal === 0) {
    return (
      <div className={className}>
        <div className={cn('w-full rounded-full bg-surface-2 dark:bg-white/5', dik ? 'h-3' : 'h-2')} />
        {leeg && <p className="text-xs text-gray-400 dark:text-white/40 mt-2">{leeg}</p>}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* De segmenten raken elkaar met een haarlijn ertussen, zodat twee
          aangrenzende kleuren niet in elkaar overlopen. */}
      <div className={cn(
        'flex w-full overflow-hidden rounded-full bg-surface-2 dark:bg-white/5 gap-px',
        dik ? 'h-3' : 'h-2',
      )}>
        {delen.map(([stand, aantal]) => (
          <div
            key={stand}
            title={`${aantal}× ${STANDEN[stand].label}`}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', STANDEN[stand].bol)}
            style={{ width: `${(aantal / totaal) * 100}%` }}
          />
        ))}
      </div>

      {legenda && rijen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-4">
          {delen.map(([stand, aantal]) => (
            <div
              key={stand}
              className="flex items-center gap-2.5 py-2 border-b border-gray-50 dark:border-white/5 last:border-0 sm:[&:nth-last-child(2)]:border-0"
            >
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', STANDEN[stand].bol)} />
              <span className="text-sm text-gray-600 dark:text-white/60 truncate flex-1 min-w-0">
                {STANDEN[stand].label}
              </span>
              <span className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                {aantal}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-white/40 tabular-nums w-9 text-right flex-shrink-0">
                {Math.round((aantal / totaal) * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {legenda && !rijen && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {delen.map(([stand, aantal]) => (
            <span key={stand} className="flex items-center gap-1.5 min-w-0">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STANDEN[stand].bol)} />
              <span className="text-xs text-gray-500 dark:text-white/50 truncate">
                {STANDEN[stand].kort}
              </span>
              <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                {aantal}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

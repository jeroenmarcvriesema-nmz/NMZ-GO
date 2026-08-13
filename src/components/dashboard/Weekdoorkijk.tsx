import { cn } from '@/lib/utils'
import { STANDEN, STANDVOLGORDE, type Klusstand } from '@/lib/klusstand'
import type { Weekdag } from '@/hooks/useDashboard'

interface WeekdoorkijkProps {
  dagen: Weekdag[]
  onDag?: () => void
}

/**
 * De komende zes werkdagen als staafjes.
 *
 * Het dashboard vertelde wat er vandaag speelt en hoeveel er in totaal
 * openstaat, maar niet of morgen vol staat of leeg. Dat is precies de
 * vraag waarvoor iemand doorklikte naar de planning — en dan bladeren,
 * tellen en teruggaan.
 *
 * Elke staaf is één dag, opgebouwd uit dezelfde standkleuren als de
 * rest. De hoogte is het aantal klussen ten opzichte van de drukste dag
 * van de week; het gaat om de verhouding tussen de dagen, niet om een
 * absolute schaal die je toch niet afleest.
 */
export function Weekdoorkijk({ dagen, onDag }: WeekdoorkijkProps) {
  if (dagen.length === 0) return null

  const drukste = Math.max(...dagen.map((d) => d.aantal), 1)

  return (
    <div className="flex items-end gap-2 sm:gap-3">
      {dagen.map((dag) => {
        const delen = (Object.entries(dag.verdeling) as [Klusstand, number][])
          .filter(([, n]) => n > 0)
          .sort(([a], [b]) => STANDVOLGORDE[a] - STANDVOLGORDE[b])

        return (
          <button
            key={dag.datum}
            onClick={onDag}
            disabled={!onDag}
            title={`${dag.aantal} ${dag.aantal === 1 ? 'klus' : 'klussen'}`}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors',
              onDag && 'hover:bg-surface-2 dark:hover:bg-white/5 cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/50',
            )}
          >
            <span className="text-[11px] font-bold tabular-nums text-gray-500 dark:text-white/50">
              {dag.aantal || '—'}
            </span>

            {/* Vaste hoogte met de staaf onderaan: zo staan de dagen op
                één lijn en vergelijk je de hoogtes en niet de posities. */}
            <div className="w-full h-24 sm:h-28 flex flex-col justify-end gap-px">
              {dag.aantal === 0 ? (
                <div className="w-full h-1 rounded-full bg-surface-2 dark:bg-white/5" />
              ) : (
                delen.map(([stand, n]) => (
                  <div
                    key={stand}
                    className={cn('w-full first:rounded-t-sm last:rounded-b-sm', STANDEN[stand].bol)}
                    style={{ height: `${Math.max(6, (n / drukste) * 100)}%` }}
                  />
                ))
              )}
            </div>

            <span className={cn(
              'text-[11px] font-semibold capitalize',
              dag.vandaag
                ? 'text-brand-yellow-dark dark:text-brand-yellow'
                : 'text-gray-400 dark:text-white/40',
            )}>
              {dag.vandaag ? 'nu' : dag.naam}
            </span>
          </button>
        )
      })}
    </div>
  )
}

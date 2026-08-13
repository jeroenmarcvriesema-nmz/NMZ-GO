import { cn } from '@/lib/utils'

interface VoortgangsringProps {
  /** 0–100. */
  waarde: number
  /** Wat er in het midden staat. Zonder dit het percentage zelf. */
  label?: string
  onder?: string
  maat?: number
  /** Tailwind-tekstkleur voor de ring, bv. uit `STANDEN[...].tekst`. */
  kleur?: string
  className?: string
}

/**
 * Voortgang als ring in plaats van als balk.
 *
 * Een balk is goed in een rij: hij vergelijkt. Een ring is goed als er
 * één getal is dat er toe doet en dat getal het middelpunt van de kaart
 * mag zijn — zoals "hoe ver ben ik vandaag" op het scherm van de
 * zwamsaneerder, dat hij met een halve blik en een handschoen aan moet
 * kunnen aflezen.
 *
 * `currentColor` voor de voortgang, zodat de kleur van buitenaf met een
 * tekstklasse gezet wordt en dus uit dezelfde tabel komt als de rest.
 * De ring begint bovenaan en loopt met de klok mee, want zo leest
 * iedereen een wijzerplaat.
 */
export function Voortgangsring({
  waarde, label, onder, maat = 96, kleur, className,
}: VoortgangsringProps) {
  const veilig = Math.min(100, Math.max(0, Math.round(waarde)))
  const dikte = Math.max(6, Math.round(maat / 12))
  const straal = (maat - dikte) / 2
  const omtrek = 2 * Math.PI * straal

  return (
    <div className={cn('relative flex-shrink-0', className)} style={{ width: maat, height: maat }}>
      <svg width={maat} height={maat} className={cn('-rotate-90', kleur)} aria-hidden="true">
        <circle
          cx={maat / 2} cy={maat / 2} r={straal}
          fill="none" strokeWidth={dikte}
          className="stroke-surface-2 dark:stroke-white/10"
        />
        <circle
          cx={maat / 2} cy={maat / 2} r={straal}
          fill="none" strokeWidth={dikte} strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={omtrek}
          strokeDashoffset={omtrek - (omtrek * veilig) / 100}
          className="transition-[stroke-dashoffset] duration-500 ease-brand"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
          {label ?? `${veilig}%`}
        </span>
        {onder && (
          <span className="text-[10px] text-gray-400 dark:text-white/40 mt-1 leading-none">{onder}</span>
        )}
      </div>
    </div>
  )
}

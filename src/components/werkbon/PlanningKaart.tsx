import { cn } from '@/lib/utils'
import type { PlanningItem } from '@/types'
import {
  IconUsers, IconListCheck, IconKey, IconPlayerPause,
  IconCircleCheck, IconArrowNarrowRight, IconArrowNarrowLeft,
} from '@tabler/icons-react'

/**
 * De kleur van een klus in de planning.
 *
 * Kleur doet hier werk en is geen versiering: van een afstand zie je aan
 * een kolom of er iets stilligt zonder één woord te lezen. Daarom is er
 * precies één kleur per betekenis en niet meer — vier kleuren die iets
 * zeggen leest sneller dan tien die mooi zijn.
 *
 * Rood is bewust gereserveerd voor stilgelegd. Dat is het enige dat een
 * telefoontje vraagt.
 */
const KLEUREN = {
  niet_gestart: {
    rand: 'border-l-gray-300 dark:border-l-white/25',
    bol: 'bg-gray-300 dark:bg-white/30',
    label: 'Nog niet gestart',
    tekst: 'text-gray-500 dark:text-white/50',
    // Wat nog niet begonnen is blijft neutraal. Anders krijgt een week
    // vol werk dat nog moet starten de meeste kleur van allemaal, en
    // dat is precies verkeerd om.
    vlak: 'bg-white dark:bg-surface-dark-2 border-gray-100 dark:border-white/10',
    balkbed: 'bg-gray-100 dark:bg-white/10',
  },
  actief: {
    rand: 'border-l-blue-500',
    bol: 'bg-blue-500',
    label: 'Bezig',
    tekst: 'text-blue-700 dark:text-blue-400',
    vlak: 'bg-blue-50/70 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    balkbed: 'bg-blue-100 dark:bg-blue-500/20',
  },
  afgerond: {
    rand: 'border-l-green-500',
    bol: 'bg-green-500',
    label: 'Afgerond',
    tekst: 'text-green-700 dark:text-green-400',
    vlak: 'bg-green-50/70 dark:bg-green-500/10 border-green-100 dark:border-green-500/20',
    balkbed: 'bg-green-100 dark:bg-green-500/20',
  },
  stilgelegd: {
    rand: 'border-l-brand-red',
    bol: 'bg-brand-red',
    label: 'Ligt stil',
    tekst: 'text-brand-red dark:text-red-400',
    vlak: 'bg-brand-red-light dark:bg-brand-red/10 border-brand-red/30 dark:border-brand-red/30',
    balkbed: 'bg-brand-red/15 dark:bg-brand-red/20',
  },
} as const

type Kleursleutel = keyof typeof KLEUREN

function sleutel(status: PlanningItem['status']): Kleursleutel {
  if (status === 'stilgelegd') return 'stilgelegd'
  if (status === 'afgerond') return 'afgerond'
  if (status === 'niet_gestart') return 'niet_gestart'
  return 'actief'
}

interface PlanningKaartProps {
  item: PlanningItem
  onOpen: () => void
  /** Deze klus liep gisteren al. */
  loopIn?: boolean
  /** Deze klus loopt morgen door. */
  loopUit?: boolean
  /** Ruimer, voor de gestapelde weergave op een telefoon. */
  ruim?: boolean
}

/**
 * Eén klus in de weekplanning.
 *
 * De vorige kaart zette `projectnaam` vet bovenaan en het adres klein
 * en grijs eronder. Sinds elke klus een losse bon is, is die projectnaam
 * altijd leeg — er stond dus een lege vetgedrukte regel boven een grijs
 * adres. Dat is waarom de blokjes onleesbaar aanvoelden: het enige dat
 * ertoe doet stond in de kleinste letter.
 *
 * Nu staat het adres bovenaan, in de kleur van de status, met een
 * randje aan de linkerkant dat je van een afstand al leest. De pijltjes
 * geven aan of een klus uit de vorige dag doorloopt of morgen verder
 * gaat — bij ons duren klussen vaak een week en dan wil je zien of er
 * die dag iets begint of dat het gewoon doorloopt.
 */
export function PlanningKaart({ item, onOpen, loopIn, loopUit, ruim }: PlanningKaartProps) {
  const k = KLEUREN[sleutel(item.status)]
  const voortgang = item.punten > 0 ? Math.round((item.puntenKlaar / item.punten) * 100) : 0

  return (
    <button
      onClick={onOpen}
      className={cn(
        'group w-full text-left rounded-lg border border-l-[3px] shadow-sm',
        'hover:shadow-md hover:-translate-y-px active:translate-y-0',
        'transition-all duration-150 ease-brand',
        // Het hele vlak in de kleur van de status, niet alleen het
        // randje links. In een week van dertig blokjes zie je zo van een
        // meter afstand welke kolom loopt en welke stilligt, zonder één
        // woord te lezen. Zacht genoeg om de tekst leesbaar te houden —
        // de kleur is de achtergrond, niet de boodschap.
        k.vlak,
        k.rand,
        ruim ? 'p-3.5' : 'p-2.5',
      )}
    >
      <div className="flex items-start gap-1.5">
        {loopIn && (
          <IconArrowNarrowLeft
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-300 dark:text-white/25"
            title="Loopt door van gisteren"
          />
        )}
        <span className={cn(
          'flex-1 min-w-0 font-bold leading-snug text-gray-900 dark:text-white break-words',
          ruim ? 'text-sm' : 'text-[13px]',
        )}>
          {item.adres || 'Zonder adres'}
        </span>
        {loopUit && (
          <IconArrowNarrowRight
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-300 dark:text-white/25"
            title="Loopt morgen door"
          />
        )}
      </div>

      {/* Status als bolletje met woord: het bolletje leest van een
          afstand, het woord is er voor wie kleur niet onderscheidt. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', k.bol)} />
          <span className={cn('text-[11px] font-semibold truncate', k.tekst)}>{k.label}</span>
        </span>

        {item.punten > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/40 tabular-nums">
            <IconListCheck className="w-3 h-3 flex-shrink-0" />
            {item.puntenKlaar}/{item.punten}
          </span>
        )}

        {item.kluiscode && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-white/50">
            <IconKey className="w-3 h-3 flex-shrink-0" />{item.kluiscode}
          </span>
        )}
      </div>

      {item.medewerkers.length > 0 && (
        <div className="flex items-start gap-1 mt-1.5 text-[11px] text-gray-500 dark:text-white/50 min-w-0">
          <IconUsers className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="leading-snug break-words">{item.medewerkers.join(', ')}</span>
        </div>
      )}

      {/* Een dunne balk onderin in plaats van een percentage in cijfers:
          in een kolom van vier klussen wil je scannen, niet rekenen. */}
      {item.punten > 0 && item.status !== 'niet_gestart' && (
        <div className={cn('mt-2 h-1 rounded-full overflow-hidden', k.balkbed)}>
          <div
            className={cn('h-full rounded-full transition-all duration-300', k.bol)}
            style={{ width: `${voortgang}%` }}
          />
        </div>
      )}

      {item.status === 'stilgelegd' && (
        <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-brand-red dark:text-red-400">
          <IconPlayerPause className="w-3 h-3 flex-shrink-0" /> wacht op een besluit
        </div>
      )}

      {item.status === 'afgerond' && (
        <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-green-700 dark:text-green-400">
          <IconCircleCheck className="w-3 h-3 flex-shrink-0" /> klaar
        </div>
      )}
    </button>
  )
}

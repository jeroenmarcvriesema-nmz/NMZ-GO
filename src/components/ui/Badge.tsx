import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'yellow' | 'red' | 'green' | 'gray' | 'blue' | 'violet' | 'orange'
  className?: string
  children: React.ReactNode
}

/**
 * De statusbadge, in volle kleur.
 *
 * Hier stonden zeven varianten in twee verschillende talen naast elkaar:
 * geel en rood waren een vol vlak met contrasterende tekst, maar groen,
 * blauw, violet en oranje waren een bleek vlakje met een randje en
 * donkere letters. Op één kaart stond dus een verzadigde rode badge
 * naast een uitgewassen blauwe, terwijl ze allebei hetzelfde soort ding
 * zeggen. Dat las als "half doorzichtig" — en dat was het ook.
 *
 * Nu draagt elke variant zijn kleur voluit. Dat is ook de taal van
 * ClickUp, waar dezelfde klussen op het andere bord staan: volle
 * statuspillen op een rustige kaart. De kleur zit in de badge, niet in
 * het vlak eronder — een kaart die zelf helemaal blauw is maakt van een
 * weekplanning een kleurenkaart waarop je de adressen niet meer leest.
 *
 * Elke combinatie is nagerekend op leesbaarheid: de donkerste tint van
 * elke kleur waarop witte tekst boven 4,5:1 uitkomt. Daarom green-700
 * en niet green-600 (3,30:1), en orange-700 en niet orange-600 (3,56:1).
 *
 * `gray` blijft bewust zacht: dat is "nog niet gestart", en wat nog niet
 * begonnen is hoort niet de meeste kleur van het scherm te krijgen.
 */
export function Badge({ variant = 'gray', className, children }: BadgeProps) {
  const variants = {
    yellow: 'bg-brand-yellow text-gray-900',
    red:    'bg-brand-red text-white',
    green:  'bg-green-700 text-white',
    blue:   'bg-blue-600 text-white',
    violet: 'bg-violet-600 text-white',
    orange: 'bg-orange-700 text-white',
    gray:   'bg-surface-2 dark:bg-white/10 text-tekst-zwak dark:text-white/70',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-sm', variants[variant], className)}>
      {children}
    </span>
  )
}

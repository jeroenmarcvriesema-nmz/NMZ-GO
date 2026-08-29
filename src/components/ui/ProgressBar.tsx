import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  className?: string
  size?: 'sm' | 'md'
  /**
   * De kleur van de balk.
   *
   * Deze namen zijn met opzet gelijk aan de badge-varianten in
   * `Badge.tsx` en aan het veld `badge` in `lib/klusstand.ts`. Een
   * scherm dat de stand van een klus toont geeft hier dus
   * `standkleur(werkbon).badge` mee, en dan staan de badge en de balk
   * gegarandeerd in dezelfde kleur.
   *
   * Dit component blijft zelf domein-loos (zie `DESIGN_SYSTEM.md`): het
   * kent geen werkbon en geen stand, alleen kleuren. Het vertalen van
   * een klus naar een kleur gebeurt in `lib/klusstand.ts`, waar het
   * hoort.
   */
  variant?: 'yellow' | 'green' | 'red' | 'violet' | 'blue' | 'gray'
}

const bedden = {
  yellow: 'bg-surface-2 dark:bg-white/10',
  green:  'bg-green-100 dark:bg-green-500/20',
  red:    'bg-brand-red/15 dark:bg-brand-red/20',
  violet: 'bg-violet-100 dark:bg-violet-500/20',
  blue:   'bg-blue-100 dark:bg-blue-500/20',
  gray:   'bg-gray-100 dark:bg-white/10',
}

const kleuren = {
  yellow: 'bg-gradient-to-r from-brand-yellow to-brand-yellow-dark',
  green:  'bg-gradient-to-r from-green-500 to-green-600',
  red:    'bg-gradient-to-r from-brand-red to-brand-red-dark',
  violet: 'bg-gradient-to-r from-violet-500 to-violet-600',
  blue:   'bg-gradient-to-r from-blue-500 to-blue-600',
  gray:   'bg-gray-300 dark:bg-white/30',
}

/**
 * Een voortgangsbalk die precies zegt wat de badge ernaast zegt.
 *
 * Hier stond een regel die de balk bij 100% automatisch groen maakte,
 * en vier schermen gaven `variant={voortgang === 100 ? 'green' :
 * 'yellow'}` mee. Het gevolg: een bon met alle punten afgevinkt maar
 * nog niet afgerond kreeg de badge "Klaar om af te ronden" in violet én
 * een groene balk eronder. Dezelfde kaart zei tegelijk "hier moet nog
 * iemand op een knop drukken" en "dit is klaar".
 *
 * Dat was geen toeval maar precies het geval waarvoor de violette
 * variant hieronder ooit is toegevoegd — hij werd alleen nergens
 * gebruikt, omdat de aanroepplekken de stand overschreven met geel of
 * groen. De omslag is er daarom uit: wie een kleur wil, geeft er een
 * mee, en de bron daarvan is `lib/klusstand.ts`.
 *
 * Geel blijft de standaard voor balken die niets met een klusstand te
 * maken hebben (een upload die loopt, een teller) — daar is het merk de
 * juiste kleur en is er geen stand om tegen te spreken.
 */
export function ProgressBar({ value, className, size = 'sm', variant = 'yellow' }: ProgressBarProps) {
  const hoogtes = { sm: 'h-1.5', md: 'h-2.5' }
  return (
    <div className={cn('w-full rounded-full overflow-hidden', bedden[variant], hoogtes[size], className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', kleuren[variant])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

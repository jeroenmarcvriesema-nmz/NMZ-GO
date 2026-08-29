import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'

interface ErrorStateProps {
  titel?: string
  /** Wat er misging, in mensentaal. Geen ruwe servermelding. */
  melding: string
  /** Laat weg wanneer opnieuw proberen niets oplost. */
  onOpnieuw?: () => void
  className?: string
}

/**
 * Tegenhanger van EmptyState: hier is wél iets misgegaan. Rood is
 * daarom functioneel — het is de enige plek in dit scherm waar het
 * merkrood mag staan. Altijd een uitweg tonen als die er is.
 */
export function ErrorState({ titel = 'Er ging iets mis', melding, onOpnieuw, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center px-6 py-14', className)}>
      <div className="w-12 h-12 rounded-full bg-brand-red-light dark:bg-brand-red/10 flex items-center justify-center text-brand-red dark:text-red-400">
        <IconAlertTriangle className="w-6 h-6" />
      </div>
      <div className="mt-4 font-semibold text-gray-700 dark:text-white/80">{titel}</div>
      <p className="mt-1.5 text-sm text-tekst-gedempt dark:text-white/55 max-w-sm leading-relaxed">{melding}</p>
      {onOpnieuw && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onOpnieuw}>
          <IconRefresh className="w-4 h-4" /> Opnieuw proberen
        </Button>
      )}
    </div>
  )
}

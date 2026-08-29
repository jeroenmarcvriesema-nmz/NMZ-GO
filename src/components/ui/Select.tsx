import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { IconChevronDown } from '@tabler/icons-react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  opties: { waarde: string; label: string }[]
}

/**
 * Zelfde visuele taal als `Input`: zichtbaar label, gele focusring,
 * rode rand bij een fout. De eigen pijl vervangt die van de browser,
 * die per besturingssysteem anders oogt.
 *
 * Bewust een echte <select> en geen nagebouwde lijst: op een telefoon
 * krijgt de gebruiker dan de vertrouwde keuzewiel van het toestel,
 * en werkt toetsenbordbediening zonder dat wij iets hoeven te doen.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, opties, className, id, ...props }, ref) => {
    const veldId = id ?? props.name

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={veldId} className="block text-sm font-semibold text-gray-700 dark:text-white/70 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={veldId}
            className={cn(
              'w-full appearance-none rounded-sm border bg-white dark:bg-surface-dark-2',
              'px-3 py-2.5 pr-9 text-sm text-gray-900 dark:text-white',
              'border-gray-200 dark:border-white/10',
              'focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow',
              'transition-all duration-150 ease-brand',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-brand-red focus:ring-brand-red focus:border-brand-red',
              className
            )}
            {...props}
          >
            {opties.map((o) => (
              <option key={o.waarde} value={o.waarde}>{o.label}</option>
            ))}
          </select>
          <IconChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-tekst-gedempt dark:text-white/55 pointer-events-none" />
        </div>
        {error && <p className="mt-1.5 text-xs text-brand-red dark:text-red-400">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

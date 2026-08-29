import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'red'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => {
    // De focusring hoort bij de knop, niet bij de browser.
    //
    // Er stond niets: de standaardring van de browser deed het werk. Die
    // wérkt, maar hij is per browser anders en heeft niets met dit merk
    // te maken — en `PRODUCT_VISION.md` noemt Raycast met zoveel woorden
    // als voorbeeld van toetsenbord-eerst. Dan hoort een knop te laten
    // zien dat hij de focus heeft in de kleur van de app.
    //
    // `focus-visible` en niet `focus`: met de muis klikken hoort geen
    // ring op te leveren, met Tab wel.
    const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-sm transition-all duration-150 ease-brand disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark'
    const variants = {
      primary:   'bg-brand-yellow text-gray-900 border border-brand-yellow-dark hover:bg-brand-yellow-dark shadow-sm',
      secondary: 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-surface-2 dark:hover:bg-white/5',
      danger:    'bg-brand-red-light dark:bg-brand-red/10 text-brand-red dark:text-red-400 border border-brand-red hover:bg-brand-red hover:text-white',
      red:       'bg-brand-red text-white border border-brand-red-dark hover:bg-brand-red-dark',
      ghost:     'bg-transparent text-gray-500 dark:text-white/50 border-transparent hover:bg-surface-2 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white',
    }
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3.5 text-base',
    }
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

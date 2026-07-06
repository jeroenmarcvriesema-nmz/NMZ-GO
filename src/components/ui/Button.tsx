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
    const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer'
    const variants = {
      primary:   'bg-brand-yellow text-gray-900 border border-brand-yellow-dark hover:bg-brand-yellow-dark shadow-sm',
      secondary: 'bg-white text-gray-900 border border-gray-200 hover:bg-surface-2',
      danger:    'bg-brand-red-light text-brand-red border border-brand-red hover:bg-brand-red hover:text-white',
      red:       'bg-brand-red text-white border border-brand-red-dark hover:bg-brand-red-dark',
      ghost:     'bg-transparent text-gray-500 border-transparent hover:bg-surface-2 hover:text-gray-900',
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

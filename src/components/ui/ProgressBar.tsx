import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  className?: string
  size?: 'sm' | 'md'
  variant?: 'yellow' | 'green' | 'red'
}

export function ProgressBar({ value, className, size = 'sm', variant = 'yellow' }: ProgressBarProps) {
  const heights = { sm: 'h-1.5', md: 'h-2.5' }
  const effectiveVariant = variant === 'yellow' && value === 100 ? 'green' : variant
  const colors = {
    yellow: 'bg-gradient-to-r from-brand-yellow to-brand-yellow-dark',
    green:  'bg-gradient-to-r from-green-500 to-green-600',
    red:    'bg-gradient-to-r from-brand-red to-brand-red-dark',
  }
  return (
    <div className={cn('w-full bg-surface-2 rounded-full overflow-hidden', heights[size], className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', colors[effectiveVariant])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

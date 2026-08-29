import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'yellow' | 'red' | 'green' | 'gray' | 'blue' | 'violet' | 'orange'
  className?: string
  children: React.ReactNode
}

export function Badge({ variant = 'gray', className, children }: BadgeProps) {
  const variants = {
    yellow: 'bg-brand-yellow text-gray-900',
    red:    'bg-brand-red text-white',
    green:  'bg-green-100 dark:bg-green-500/10 text-green-800 dark:text-green-400 border border-green-300 dark:border-green-500/30',
    gray:   'bg-brand-yellow-light/40 dark:bg-white/5 text-gray-600 dark:text-white/60 border border-gray-200 dark:border-white/10',
    blue:   'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30',
    violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30',
    orange: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-sm', variants[variant], className)}>
      {children}
    </span>
  )
}

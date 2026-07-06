import { cn } from '@/lib/utils'
import type { WerkbonStatus } from '@/types'

interface BadgeProps {
  variant?: 'yellow' | 'red' | 'green' | 'gray' | 'blue' | 'orange'
  className?: string
  children: React.ReactNode
}

export function Badge({ variant = 'gray', className, children }: BadgeProps) {
  const variants = {
    yellow: 'bg-brand-yellow text-gray-900',
    red:    'bg-brand-red text-white',
    green:  'bg-green-100 text-green-800 border border-green-300',
    gray:   'bg-surface-2 text-gray-600 border border-gray-200',
    blue:   'bg-blue-50 text-blue-800 border border-blue-200',
    orange: 'bg-amber-50 text-amber-800 border border-amber-200',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md', variants[variant], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: WerkbonStatus }) {
  const config: Record<WerkbonStatus, { label: string; variant: BadgeProps['variant'] }> = {
    open:     { label: 'Open',     variant: 'gray' },
    bezig:    { label: 'Bezig',    variant: 'orange' },
    voltooid: { label: 'Voltooid', variant: 'green' },
  }
  const { label, variant } = config[status]
  return <Badge variant={variant}>{label}</Badge>
}

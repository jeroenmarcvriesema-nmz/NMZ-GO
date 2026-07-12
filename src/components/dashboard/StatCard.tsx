import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  variant?: 'default' | 'yellow' | 'red' | 'green' | 'blue'
}

export function StatCard({ label, value, variant = 'default' }: StatCardProps) {
  const topColors = {
    default: 'bg-brand-yellow', yellow: 'bg-brand-yellow',
    red: 'bg-brand-red', green: 'bg-green-500', blue: 'bg-blue-500',
  }
  const valueColors = {
    default: 'text-gray-900 dark:text-white', yellow: 'text-brand-yellow-dark dark:text-brand-yellow',
    red: 'text-brand-red dark:text-red-400', green: 'text-green-700 dark:text-green-400', blue: 'text-blue-700 dark:text-blue-400',
  }
  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-6 relative overflow-hidden transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', topColors[variant])} />
      <div className={cn('text-4xl font-extrabold tracking-tight leading-none', valueColors[variant])}>{value}</div>
      <div className="text-sm text-gray-400 dark:text-white/40 font-medium mt-2">{label}</div>
    </div>
  )
}

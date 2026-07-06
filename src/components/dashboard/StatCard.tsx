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
    default: 'text-gray-900', yellow: 'text-brand-yellow-dark',
    red: 'text-brand-red', green: 'text-green-700', blue: 'text-blue-700',
  }
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-5 relative overflow-hidden">
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', topColors[variant])} />
      <div className={cn('text-3xl font-extrabold tracking-tight leading-none', valueColors[variant])}>{value}</div>
      <div className="text-xs text-gray-400 font-medium mt-1.5">{label}</div>
    </div>
  )
}

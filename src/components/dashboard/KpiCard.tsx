import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: number | string
  icon: ReactNode
  variant?: 'neutral' | 'green' | 'yellow' | 'red' | 'blue'
  sub?: string
}

const variants = {
  neutral: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-gray-100 dark:bg-white/10',
    iconColor: 'text-gray-500 dark:text-white/60',
    value: 'text-gray-900 dark:text-white',
    bar: 'bg-gray-200 dark:bg-white/10',
  },
  green: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-green-50 dark:bg-green-500/10',
    iconColor: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-400',
    bar: 'bg-green-500',
  },
  yellow: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-brand-yellow-light dark:bg-brand-yellow/10',
    iconColor: 'text-brand-yellow-dark dark:text-brand-yellow',
    value: 'text-brand-yellow-dark dark:text-brand-yellow',
    bar: 'bg-brand-yellow',
  },
  red: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-red-50 dark:bg-red-500/10',
    iconColor: 'text-red-600 dark:text-red-400',
    value: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
  },
  blue: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-400',
    bar: 'bg-blue-500',
  },
}

export function KpiCard({ label, value, icon, variant = 'neutral', sub }: KpiCardProps) {
  const v = variants[variant]
  return (
    <div className={cn('rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5 flex flex-col gap-3 relative overflow-hidden', v.bg)}>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', v.iconBg)}>
        <span className={cn('text-[18px]', v.iconColor)}>{icon}</span>
      </div>
      <div>
        <div className={cn('text-3xl font-extrabold tracking-tight leading-none', v.value)}>
          {value}
        </div>
        <div className="text-xs font-medium text-gray-400 dark:text-white/40 mt-1.5">{label}</div>
        {sub && <div className="text-[11px] text-gray-300 dark:text-white/30 mt-0.5">{sub}</div>}
      </div>
      <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', v.bar)} />
    </div>
  )
}

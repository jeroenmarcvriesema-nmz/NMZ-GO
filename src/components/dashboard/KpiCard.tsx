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
    bg: 'bg-white',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    value: 'text-gray-900',
    bar: 'bg-gray-200',
  },
  green: {
    bg: 'bg-white',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    value: 'text-green-700',
    bar: 'bg-green-500',
  },
  yellow: {
    bg: 'bg-white',
    iconBg: 'bg-brand-yellow-light',
    iconColor: 'text-brand-yellow-dark',
    value: 'text-brand-yellow-dark',
    bar: 'bg-brand-yellow',
  },
  red: {
    bg: 'bg-white',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    value: 'text-red-600',
    bar: 'bg-red-500',
  },
  blue: {
    bg: 'bg-white',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    value: 'text-blue-700',
    bar: 'bg-blue-500',
  },
}

export function KpiCard({ label, value, icon, variant = 'neutral', sub }: KpiCardProps) {
  const v = variants[variant]
  return (
    <div className={cn('rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 relative overflow-hidden', v.bg)}>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', v.iconBg)}>
        <span className={cn('text-[18px]', v.iconColor)}>{icon}</span>
      </div>
      <div>
        <div className={cn('text-3xl font-extrabold tracking-tight leading-none', v.value)}>
          {value}
        </div>
        <div className="text-xs font-medium text-gray-400 mt-1.5">{label}</div>
        {sub && <div className="text-[11px] text-gray-300 mt-0.5">{sub}</div>}
      </div>
      <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', v.bar)} />
    </div>
  )
}

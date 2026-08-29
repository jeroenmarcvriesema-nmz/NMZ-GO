import { cn } from '@/lib/utils'
import type { Melding } from '@/hooks/useDashboard'
import {
  IconAlertTriangle, IconClock, IconPhoto, IconCircleCheck,
} from '@tabler/icons-react'

const config = {
  niet_gestart: {
    icon: <IconClock className="w-4 h-4" />,
    accent: 'border-l-amber-500',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Nog niet gestart',
  },
  geen_fotos: {
    icon: <IconPhoto className="w-4 h-4" />,
    accent: 'border-l-blue-500',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: "Geen foto's",
  },
  controle: {
    icon: <IconAlertTriangle className="w-4 h-4" />,
    accent: 'border-l-brand-red dark:border-l-red-500',
    iconColor: 'text-brand-red dark:text-red-400',
    label: 'Actie vereist',
  },
  afgerond: {
    icon: <IconCircleCheck className="w-4 h-4" />,
    accent: 'border-l-green-500',
    iconColor: 'text-green-600 dark:text-green-400',
    label: 'Afgerond',
  },
}

interface MeldingItemProps {
  melding: Melding
}

export function MeldingItem({ melding }: MeldingItemProps) {
  const c = config[melding.type]
  return (
    <div className={cn('flex items-center gap-3 px-5 py-4 rounded-lg bg-white dark:bg-surface-dark-2 border border-l-4 border-gray-100 dark:border-white/10', c.accent)}>
      <span className={cn('flex-shrink-0', c.iconColor)}>{c.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">{melding.project}</div>
        <div className="text-xs text-gray-500 dark:text-white/60">{melding.tekst}</div>
      </div>
      <span className="text-[11px] text-tekst-gedempt dark:text-white/55 font-mono flex-shrink-0">{melding.tijd}</span>
    </div>
  )
}

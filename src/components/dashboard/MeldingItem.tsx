import { cn } from '@/lib/utils'
import type { Melding } from '@/hooks/useDashboard'
import {
  IconAlertTriangle, IconClock, IconPhoto, IconCircleCheck, IconInfoCircle,
} from '@tabler/icons-react'

const config = {
  niet_gestart: {
    icon: <IconClock className="w-4 h-4" />,
    bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Nog niet gestart',
  },
  geen_fotos: {
    icon: <IconPhoto className="w-4 h-4" />,
    bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: "Geen foto's",
  },
  controle: {
    icon: <IconAlertTriangle className="w-4 h-4" />,
    bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Actie vereist',
  },
  afgerond: {
    icon: <IconCircleCheck className="w-4 h-4" />,
    bg: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
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
    <div className={cn('flex items-center gap-3 px-5 py-4 rounded-lg border transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-sm', c.bg)}>
      <span className={cn('flex-shrink-0', c.iconColor)}>{c.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">{melding.project}</div>
        <div className="text-xs text-gray-500 dark:text-white/60">{melding.tekst}</div>
      </div>
      <span className="text-[11px] text-gray-400 dark:text-white/40 font-mono flex-shrink-0">{melding.tijd}</span>
    </div>
  )
}

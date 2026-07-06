import { cn } from '@/lib/utils'
import type { Melding } from '@/hooks/useDashboard'
import {
  IconAlertTriangle, IconClock, IconPhoto, IconCircleCheck, IconInfoCircle,
} from '@tabler/icons-react'

const config = {
  niet_gestart: {
    icon: <IconClock className="w-4 h-4" />,
    bg: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-600',
    label: 'Nog niet gestart',
  },
  geen_fotos: {
    icon: <IconPhoto className="w-4 h-4" />,
    bg: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600',
    label: "Geen foto's",
  },
  controle: {
    icon: <IconAlertTriangle className="w-4 h-4" />,
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
    label: 'Actie vereist',
  },
  afgerond: {
    icon: <IconCircleCheck className="w-4 h-4" />,
    bg: 'bg-green-50 border-green-200',
    iconColor: 'text-green-600',
    label: 'Afgerond',
  },
}

interface MeldingItemProps {
  melding: Melding
}

export function MeldingItem({ melding }: MeldingItemProps) {
  const c = config[melding.type]
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg border', c.bg)}>
      <span className={cn('flex-shrink-0', c.iconColor)}>{c.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{melding.project}</div>
        <div className="text-xs text-gray-500">{melding.tekst}</div>
      </div>
      <span className="text-[11px] text-gray-400 font-mono flex-shrink-0">{melding.tijd}</span>
    </div>
  )
}

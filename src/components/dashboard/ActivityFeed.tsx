import { cn } from '@/lib/utils'
import type { Activiteit } from '@/hooks/useDashboard'
import { IconPlayerPlay, IconPhoto, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react'

const config = {
  start:    { icon: <IconPlayerPlay className="w-3.5 h-3.5" />,    cls: 'bg-blue-100 text-blue-600' },
  fotos:    { icon: <IconPhoto className="w-3.5 h-3.5" />,         cls: 'bg-purple-100 text-purple-600' },
  afgerond: { icon: <IconCircleCheck className="w-3.5 h-3.5" />,   cls: 'bg-green-100 text-green-600' },
  info:     { icon: <IconInfoCircle className="w-3.5 h-3.5" />,    cls: 'bg-gray-100 text-gray-500' },
}

export function ActivityFeed({ activiteit }: { activiteit: Activiteit[] }) {
  return (
    <div className="space-y-0">
      {activiteit.map((a, i) => {
        const c = config[a.type]
        return (
          <div key={a.id} className="flex items-start gap-3 py-2.5 relative">
            {i < activiteit.length - 1 && (
              <div className="absolute left-3.5 top-8 bottom-0 w-px bg-gray-100" />
            )}
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10', c.cls)}>
              {c.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-sm text-gray-700">{a.tekst}</div>
            </div>
            <span className="text-[11px] font-mono text-gray-400 flex-shrink-0 pt-0.5">{a.tijd}</span>
          </div>
        )
      })}
    </div>
  )
}

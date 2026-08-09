import { cn } from '@/lib/utils'
import type { Activiteit } from '@/hooks/useDashboard'
import { IconPlayerPlay, IconPhoto, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react'

const config = {
  start:    { icon: <IconPlayerPlay className="w-3.5 h-3.5" />,    cls: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  fotos:    { icon: <IconPhoto className="w-3.5 h-3.5" />,         cls: 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  afgerond: { icon: <IconCircleCheck className="w-3.5 h-3.5" />,   cls: 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400' },
  info:     { icon: <IconInfoCircle className="w-3.5 h-3.5" />,    cls: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/60' },
}

export function ActivityFeed({ activiteit }: { activiteit: Activiteit[] }) {
  return (
    <div className="space-y-0">
      {activiteit.map((a, i) => {
        const c = config[a.type]
        return (
          <div key={a.id} className="flex items-start gap-3 py-3 relative">
            {i < activiteit.length - 1 && (
              <div className="absolute left-4 top-9 bottom-0 w-px bg-gray-100 dark:bg-white/10" />
            )}
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10', c.cls)}>
              {c.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-sm text-gray-700 dark:text-white/70 break-words">{a.tekst}</div>
            </div>
            <span className="text-[11px] font-mono text-gray-400 dark:text-white/40 flex-shrink-0 pt-0.5">{a.tijd}</span>
          </div>
        )
      })}
    </div>
  )
}

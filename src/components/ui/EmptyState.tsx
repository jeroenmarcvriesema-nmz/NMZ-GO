import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Tabler-icoon, bijv. <IconFolderOpen />. Nooit een emoji. */
  icon: React.ReactNode
  titel: string
  uitleg?: string
  /** Eén duidelijke actie — laat weg als er niets te doen valt. */
  actie?: React.ReactNode
  className?: string
}

/**
 * De lege staat is geen fout: er is simpelweg nog niets. Toon dus een
 * rustig, neutraal vlak — geen rood, geen uitroepteken. Het icoon staat
 * in een zachte cirkel zodat de kaart niet leeg oogt zonder te schreeuwen.
 */
export function EmptyState({ icon, titel, uitleg, actie, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center px-6 py-14', className)}>
      <div className="w-12 h-12 rounded-full bg-surface-2 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/30 [&>svg]:w-6 [&>svg]:h-6">
        {icon}
      </div>
      <div className="mt-4 font-semibold text-gray-700 dark:text-white/80">{titel}</div>
      {uitleg && (
        <p className="mt-1.5 text-sm text-gray-400 dark:text-white/40 max-w-xs leading-relaxed">{uitleg}</p>
      )}
      {actie && <div className="mt-5">{actie}</div>}
    </div>
  )
}

import { cn } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { ToastSoort } from '@/store/toastStore'
import { IconCircleCheck, IconAlertCircle, IconInfoCircle, IconX } from '@tabler/icons-react'

const iconen: Record<ToastSoort, React.ReactNode> = {
  goed: <IconCircleCheck className="w-4 h-4" />,
  fout: <IconAlertCircle className="w-4 h-4" />,
  info: <IconInfoCircle className="w-4 h-4" />,
}

const stijlen: Record<ToastSoort, string> = {
  goed: 'border-green-500/60 text-green-700 dark:text-green-400',
  fout: 'border-brand-red text-brand-red dark:text-red-400',
  info: 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80',
}

/**
 * Eén keer gerenderd, in App.tsx. Onderaan op mobiel (binnen duimbereik,
 * boven de tabbalk), rechtsonder op desktop. Kleur zit alleen in het
 * icoon en de rand — het vlak zelf blijft neutraal, zodat een melding
 * niet met de merkkleur concurreert.
 */
export function Toaster() {
  const { toasts, sluit } = useToastStore()
  if (!toasts.length) return null

  return (
    <div
      className="fixed z-[60] bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80 flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 bg-white dark:bg-surface-dark-2 border rounded-sm shadow-md px-4 py-3 animate-page-in',
            stijlen[t.soort]
          )}
        >
          <span className="flex-shrink-0 mt-0.5">{iconen[t.soort]}</span>
          <span className="text-sm leading-snug flex-1 min-w-0 break-words text-gray-900 dark:text-white">{t.tekst}</span>
          <button
            onClick={() => sluit(t.id)}
            aria-label="Melding sluiten"
            className="flex-shrink-0 text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

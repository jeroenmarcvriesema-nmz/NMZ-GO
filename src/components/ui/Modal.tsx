import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { IconX } from '@tabler/icons-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('bg-white dark:bg-surface-dark-2 rounded-lg shadow-lg w-full overflow-hidden animate-page-in', sizes[size])}
      >
        {/* Theme-reactief, net als de rest van de schil sinds 3.1b —
            de gele bovenrand is het merkaccent, niet een donkere balk.

            min-w-0 en break-words op de kop: een titel als "Karolingen-
            straat 29 te Zaandam stilleggen" duwde de sluitknop anders
            het venster uit. De knop krimpt niet mee (flex-shrink-0),
            dus de kop is de enige die kán wijken. */}
        <div className="border-t-2 border-brand-yellow bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-base font-bold text-gray-900 dark:text-white break-words">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="flex-shrink-0 text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        {/* Was p-7 (28 pixels) op elk formaat. Op een telefoon van 390
            blijft er dan 302 over voor de inhoud, terwijl de kop erboven
            op 24 stond — de twee liepen zichtbaar niet gelijk. Nu
            hetzelfde ritme als de rest van de app: krap op mobiel,
            ruim vanaf tablet. */}
        <div className="p-4 sm:p-7 min-w-0">{children}</div>
      </div>
    </div>
  )
}

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
            de gele bovenrand is het merkaccent, niet een donkere balk. */}
        <div className="border-t-2 border-brand-yellow bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-white/10 px-6 py-4 flex items-center justify-between gap-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  )
}

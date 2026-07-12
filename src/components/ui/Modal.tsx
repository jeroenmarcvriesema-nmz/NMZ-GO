import { useEffect } from 'react'
import { cn } from '@/lib/utils'

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
      <div className={cn('bg-white dark:bg-surface-dark-2 rounded-lg shadow-lg w-full overflow-hidden', sizes[size])}>
        <div className="bg-gray-900 px-6 py-5 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  )
}

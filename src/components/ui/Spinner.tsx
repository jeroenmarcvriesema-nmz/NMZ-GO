import { cn } from '@/lib/utils'
import { IconClipboardCheck } from '@tabler/icons-react'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin h-5 w-5 text-brand-yellow', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  )
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F0EB] dark:bg-surface-dark">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-brand-yellow flex items-center justify-center">
          <IconClipboardCheck className="w-7 h-7 text-gray-900" />
        </div>
        <Spinner className="h-6 w-6" />
      </div>
    </div>
  )
}

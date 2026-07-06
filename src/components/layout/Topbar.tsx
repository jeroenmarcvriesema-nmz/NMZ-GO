import { IconClipboardCheck } from '@tabler/icons-react'

export function Topbar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="bg-white border-b border-gray-100 h-16 flex items-center px-8 sticky top-0 z-40 shadow-sm">
      <div className="text-[17px] font-bold tracking-tight flex-1">{title}</div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </header>
  )
}

export function MobileTopbar({ title }: { title: string }) {
  return (
    <header className="bg-gray-900 sticky top-0 z-40 flex items-center gap-3 px-4 py-3.5">
      <div className="w-8 h-8 rounded-sm bg-brand-yellow flex items-center justify-center">
        <IconClipboardCheck className="w-4 h-4 text-gray-900" />
      </div>
      <span className="text-base font-bold text-white flex-1">{title}</span>
    </header>
  )
}

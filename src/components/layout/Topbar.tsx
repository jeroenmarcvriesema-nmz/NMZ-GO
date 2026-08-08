import { IconClipboardCheck, IconSun, IconMoon } from '@tabler/icons-react'
import { useThemeStore } from '@/store/themeStore'
import { Meldingen } from './Meldingen'

export function Topbar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-white/10 border-t-[3px] border-t-brand-yellow h-14 flex items-center px-8 sticky top-0 z-40 shadow-sm">
      <div className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex-1">{title}</div>
      <div className="flex items-center gap-2">
        {actions}
        <Meldingen />
      </div>
    </header>
  )
}

export function MobileTopbar({ title }: { title: string }) {
  const { theme, toggleTheme } = useThemeStore()
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-white/10 border-t-[3px] border-t-brand-yellow">
      <div className="w-7 h-7 rounded-md bg-brand-yellow flex items-center justify-center flex-shrink-0">
        <IconClipboardCheck className="w-4 h-4 text-gray-900" />
      </div>
      <span className="text-[15px] font-bold text-gray-900 dark:text-white flex-1 truncate">{title}</span>
      <Meldingen />
      <button onClick={toggleTheme} className="text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors" title={theme === 'dark' ? 'Licht thema' : 'Donker thema'}>
        {theme === 'dark' ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
      </button>
    </header>
  )
}

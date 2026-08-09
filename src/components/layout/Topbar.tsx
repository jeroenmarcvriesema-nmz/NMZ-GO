import { IconClipboardCheck, IconSun, IconMoon } from '@tabler/icons-react'
import { useThemeStore } from '@/store/themeStore'
import { Meldingen } from './Meldingen'

export function Topbar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-white/10 border-t-[3px] border-t-brand-yellow h-14 flex items-center gap-4 px-6 lg:px-8 sticky top-0 z-40 shadow-sm">
      <div className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex-1 min-w-0 truncate">{title}</div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <Meldingen />
      </div>
    </header>
  )
}

/**
 * De balk bovenin op een telefoon.
 *
 * Hij liet `actions` vallen. Daardoor waren "Nu synchroniseren", "Taak
 * importeren", "Nieuwe werkbon" en "Exporteren" op een werktelefoon
 * helemaal niet te bereiken — op de laptop stonden ze wél in de balk,
 * dus het viel niet op.
 *
 * Ze staan nu op een eigen regel eronder in plaats van ernaast: naast
 * de titel proppen levert afgeknipte knoppen op, en dat is precies het
 * soort ding dat maakt dat een app goedkoop aanvoelt. De regel schuift
 * opzij als er meer knoppen zijn dan er passen, met de scrollbalk
 * verborgen — zoals een app dat doet.
 */
export function MobileTopbar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const { theme, toggleTheme } = useThemeStore()
  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-white/10 border-t-[3px] border-t-brand-yellow">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-7 h-7 rounded-md bg-brand-yellow flex items-center justify-center flex-shrink-0">
          <IconClipboardCheck className="w-4 h-4 text-gray-900" />
        </div>
        <span className="text-[15px] font-bold text-gray-900 dark:text-white flex-1 min-w-0 truncate">{title}</span>
        <Meldingen />
        <button
          onClick={toggleTheme}
          className="flex-shrink-0 text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors"
          title={theme === 'dark' ? 'Licht thema' : 'Donker thema'}
        >
          {theme === 'dark' ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
        </button>
      </div>

      {actions && (
        <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-verbergen [&>*]:flex-shrink-0 [&_button]:whitespace-nowrap">
          {actions}
        </div>
      )}
    </header>
  )
}

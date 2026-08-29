import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { IconChevronRight } from '@tabler/icons-react'

interface KpiCardProps {
  label: string
  value: number | string
  icon: ReactNode
  variant?: 'neutral' | 'green' | 'yellow' | 'red' | 'blue' | 'violet'
  sub?: string
  /**
   * Maakt de tegel aantikbaar. Weglaten laat hem een tegel.
   *
   * Let op wat dit óók doet: zonder `onClick` verdwijnt het optillen bij
   * hover. Dat zat op élke tegel, ook op de tien die nergens heen gaan —
   * een kaart die meebeweegt onder je muis belooft dat er iets gebeurt
   * als je klikt. Nu doet alleen de tegel die dat waarmaakt het nog.
   */
  onClick?: () => void
  /** Wat er gebeurt bij aantikken, bv. "naar uitloop". */
  actie?: string
}

const variants = {
  neutral: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-brand-yellow-light/60 dark:bg-white/10',
    iconColor: 'text-brand-yellow-dark dark:text-white/60',
    value: 'text-gray-900 dark:text-white',
    bar: 'bg-gray-200 dark:bg-white/10',
  },
  green: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-green-50 dark:bg-green-500/10',
    iconColor: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-400',
    bar: 'bg-green-500',
  },
  yellow: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-brand-yellow-light dark:bg-brand-yellow/10',
    iconColor: 'text-brand-yellow-dark dark:text-brand-yellow',
    value: 'text-brand-yellow-dark dark:text-brand-yellow',
    bar: 'bg-brand-yellow',
  },
  red: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-red-50 dark:bg-red-500/10',
    iconColor: 'text-red-600 dark:text-red-400',
    value: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
  },
  blue: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-400',
    bar: 'bg-blue-500',
  },
  // Hoort bij de stand "klaar om af te ronden" (zie lib/klusstand.ts).
  // Een tegel mag niet in een andere kleur staan dan de badge waar hij
  // naar verwijst.
  violet: {
    bg: 'bg-white dark:bg-surface-dark-2',
    iconBg: 'bg-violet-50 dark:bg-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    value: 'text-violet-700 dark:text-violet-400',
    bar: 'bg-violet-500',
  },
}

export function KpiCard({ label, value, icon, variant = 'neutral', sub, onClick, actie }: KpiCardProps) {
  const v = variants[variant]
  const Vak = onClick ? 'button' : 'div'

  return (
    <Vak
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={cn(
        'min-w-0 rounded-lg border border-gray-100 dark:border-white/10 shadow-sm p-4 sm:p-6',
        'flex flex-col gap-3 relative overflow-hidden transition-all duration-200 ease-brand',
        v.bg,
        onClick && [
          'text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-brand-yellow',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/50',
          'active:translate-y-0',
        ],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn('w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center', v.iconBg)}>
          <span className={cn('text-[19px]', v.iconColor)}>{icon}</span>
        </div>
        {onClick && (
          <IconChevronRight className="w-4 h-4 flex-shrink-0 mt-1 text-tekst-fijn dark:text-white/40" />
        )}
      </div>
      <div className="min-w-0">
        {/* Kleiner op een telefoon, en altijd breekbaar: "12/405" of
            "3 dagen" paste anders niet in een halve schermbreedte. */}
        <div className={cn('text-3xl sm:text-4xl font-extrabold tracking-tight leading-none break-words', v.value)}>
          {value}
        </div>
        <div className="text-xs sm:text-sm font-medium text-tekst-gedempt dark:text-white/55 mt-2 break-words">{label}</div>
        {/* `sub` is een zin en geen decoratie, dus de gedempte tekstkleur
            en niet de fijne. Hij stond op gray-300: 1,47:1 op wit, wat
            neerkomt op onzichtbaar. */}
        {sub && <div className="text-xs text-tekst-gedempt dark:text-white/55 mt-0.5 break-words">{sub}</div>}
        {/* Was `text-brand-yellow-dark`: 2,75:1 op wit. Merkgeel is een
            prima accentkleur maar geen tekstkleur — voor een regel die
            zegt wat er gebeurt als je klikt, telt leesbaarheid. */}
        {actie && (
          <div className="text-xs font-semibold text-tekst-zwak dark:text-brand-yellow mt-1.5 break-words">
            {actie} →
          </div>
        )}
      </div>
      <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', v.bar)} />
    </Vak>
  )
}

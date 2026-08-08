import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { IconCheck, IconChevronDown } from '@tabler/icons-react'

interface DropdownProps {
  waarde: string
  opties: { waarde: string; label: string; toelichting?: string }[]
  onKies: (waarde: string) => void
  label?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

/**
 * Een eigen keuzelijst, omdat de lijst van een `<select>` door het
 * besturingssysteem wordt getekend en dus overal anders — en meestal
 * lelijk — oogt. Dit is de enige plek waar we die tekening overnemen.
 *
 * Op een telefoon blijft de echte `<select>` staan: daar is het
 * systeemwiel met zijn grote raakvlakken beter dan alles wat wij
 * kunnen nabouwen, en dat is precies het toestel waar onze jongens op
 * werken. Vandaar twee varianten in plaats van één.
 */
export function Dropdown({
  waarde, opties, onKies, label, ariaLabel, className, disabled,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const doos = useRef<HTMLDivElement>(null)
  const gekozen = opties.find((o) => o.waarde === waarde)

  // Buiten klikken sluit. Zonder dit blijft de lijst openstaan zodra je
  // ergens anders heen gaat, en dan lijkt hij vast te zitten.
  useEffect(() => {
    if (!open) return
    const buiten = (e: MouseEvent) => {
      if (doos.current && !doos.current.contains(e.target as Node)) setOpen(false)
    }
    const toets = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', buiten)
    document.addEventListener('keydown', toets)
    return () => {
      document.removeEventListener('mousedown', buiten)
      document.removeEventListener('keydown', toets)
    }
  }, [open])

  // Geen w-full hier: die won van de breedte die de aanroeper meegeeft
  // en duwde daarmee alles ernaast weg. De aanroeper bepaalt de breedte,
  // met w-full als vangnet wanneer hij niets zegt.
  return (
    <div className={cn(className ?? 'w-full')}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-white/70 mb-1.5">
          {label}
        </label>
      )}

      {/* ── Telefoon: de vertrouwde systeemkiezer ── */}
      <div className="sm:hidden relative">
        <select
          aria-label={ariaLabel ?? label}
          value={waarde}
          disabled={disabled}
          onChange={(e) => onKies(e.target.value)}
          className="w-full appearance-none min-h-[44px] rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 px-3 pr-9 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow disabled:opacity-50"
        >
          {opties.map((o) => <option key={o.waarde} value={o.waarde}>{o.label}</option>)}
        </select>
        <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
      </div>

      {/* ── Laptop: onze eigen lijst ── */}
      <div ref={doos} className="hidden sm:block relative">
        <button
          type="button"
          aria-label={ariaLabel ?? label}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            'w-full flex items-center gap-2 min-h-[44px] px-3 rounded-sm border text-sm text-left transition-all duration-150 ease-brand',
            'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            open
              ? 'border-brand-yellow ring-2 ring-brand-yellow'
              : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
          )}
        >
          <span className="flex-1 truncate font-medium">{gekozen?.label ?? '—'}</span>
          <IconChevronDown className={cn(
            'w-4 h-4 flex-shrink-0 text-gray-400 dark:text-white/40 transition-transform duration-150',
            open && 'rotate-180'
          )} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-max rounded-lg border border-gray-100 dark:border-white/10 bg-white dark:bg-surface-dark-2 shadow-lg overflow-hidden animate-page-in">
            {opties.map((o) => {
              const actief = o.waarde === waarde
              return (
                <button
                  key={o.waarde}
                  type="button"
                  onClick={() => { onKies(o.waarde); setOpen(false) }}
                  className={cn(
                    'w-full flex items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                    actief
                      ? 'bg-brand-yellow-light dark:bg-brand-yellow/10 text-gray-900 dark:text-white font-semibold'
                      : 'text-gray-700 dark:text-white/70 hover:bg-surface-2 dark:hover:bg-white/5'
                  )}
                >
                  <IconCheck className={cn(
                    'w-4 h-4 flex-shrink-0 mt-0.5',
                    actief ? 'text-brand-yellow-dark dark:text-brand-yellow' : 'opacity-0'
                  )} />
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.toelichting && (
                      <span className="block text-xs text-gray-400 dark:text-white/40 mt-0.5">
                        {o.toelichting}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

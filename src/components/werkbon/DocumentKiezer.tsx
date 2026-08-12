import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { IconFileTypePdf, IconTrash, IconUpload } from '@tabler/icons-react'

interface Props {
  /** Wat er gekozen wordt, bijv. "Werkopdracht". */
  label: string
  /** Regel eronder als er nog niets ligt. */
  hint?: string
  /** De naam van wat er nu ligt, of null als er nog niets is. */
  waarde: string | null
  bezig?: boolean
  onKies: (bestand: File) => void
  onWis?: () => void
}

/**
 * Eén PDF kiezen: de werkopdracht of de werktekening.
 *
 * Hetzelfde blokje op twee plekken — bij het aanmaken van een bon (waar
 * het bestand pas ná het opslaan de opslag in gaat, want vóór die tijd
 * bestaat de bon nog niet) en op een bestaande bon (waar het meteen
 * geüpload wordt). Vandaar dat dit component zelf niets uploadt: het
 * geeft alleen het gekozen bestand door.
 */
export function DocumentKiezer({ label, hint, waarde, bezig, onKies, onWis }: Props) {
  const invoer = useRef<HTMLInputElement>(null)

  const kies = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bestand = e.target.files?.[0]
    // Leegmaken, anders geeft dezelfde PDF nog eens kiezen geen
    // wijziging en gebeurt er niets.
    e.target.value = ''
    if (bestand) onKies(bestand)
  }

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-semibold text-gray-600 dark:text-white/60">{label}</div>

      <div
        className={cn(
          'flex items-center gap-3 min-h-[56px] px-4 py-2.5 rounded-sm border transition-all',
          waarde
            ? 'border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2'
            : 'border-dashed border-gray-300 dark:border-white/15 bg-surface-2 dark:bg-white/5',
          bezig && 'opacity-60',
        )}
      >
        <IconFileTypePdf
          className={cn(
            'w-5 h-5 flex-shrink-0',
            waarde ? 'text-brand-red' : 'text-gray-400 dark:text-white/40',
          )}
        />

        <div className="min-w-0 flex-1">
          {waarde ? (
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{waarde}</div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-white/40">
              {hint ?? 'Nog geen bestand gekozen'}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => invoer.current?.click()}
          disabled={bezig}
          className="flex items-center gap-1.5 min-h-[44px] px-3 text-sm font-semibold text-gray-900 dark:text-white hover:text-brand-yellow-dark dark:hover:text-brand-yellow transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <IconUpload className="w-4 h-4" />
          {bezig ? 'Bezig…' : waarde ? 'Vervangen' : 'PDF kiezen'}
        </button>

        {waarde && onWis && (
          <button
            type="button"
            onClick={onWis}
            disabled={bezig}
            className="p-2 text-gray-300 dark:text-white/30 hover:text-brand-red transition-colors disabled:opacity-50 cursor-pointer"
            title={`${label} verwijderen`}
          >
            <IconTrash className="w-4 h-4" />
          </button>
        )}

        <input
          ref={invoer}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={kies}
          disabled={bezig}
        />
      </div>
    </div>
  )
}

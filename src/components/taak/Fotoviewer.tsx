import { useEffect } from 'react'
import { IconX, IconChevronLeft, IconChevronRight, IconArchive } from '@tabler/icons-react'

interface Props {
  /**
   * `opgeruimd` betekent: het bestand is uit de bucket gehaald nadat
   * ClickUp de foto had (migratie 027). Er valt hier dus niets te
   * tonen, maar dat is iets anders dan een foto die niet laadt.
   */
  fotos: { id: string; url: string | null; opgeruimd?: boolean }[]
  /** Welke foto open staat, of null voor dicht. */
  index: number | null
  /** De tekst van het afvinkpunt, zodat je weet waar je naar kijkt. */
  titel: string
  onSluit: () => void
  onWissel: (index: number) => void
}

/**
 * Een foto op volle grootte, in de app zelf.
 *
 * Hiervoor ging een foto open in een nieuw tabblad met een ondertekende
 * link. Op een laptop kan dat; op een werktelefoon is het een tabwissel
 * waarna je terug moet navigeren naar het punt waar je stond, en soms
 * blokkeert de browser het venster helemaal. Wie op een zolder staat te
 * controleren of de foto scherp is, hoort dat te kunnen zonder de app
 * te verlaten.
 *
 * Bewust geen Modal: die is voor formulieren, met een kop, witruimte en
 * een maximale breedte. Een foto wil het hele scherm en verder niets.
 */
export function Fotoviewer({ fotos, index, titel, onSluit, onWissel }: Props) {
  const open = index !== null && index >= 0 && index < fotos.length

  useEffect(() => {
    if (!open) return
    const toets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSluit()
      if (e.key === 'ArrowRight' && index! < fotos.length - 1) onWissel(index! + 1)
      if (e.key === 'ArrowLeft' && index! > 0) onWissel(index! - 1)
    }
    document.addEventListener('keydown', toets)
    // Achter de viewer meescrollen is verwarrend: je sluit hem en staat
    // ergens anders.
    const vorige = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', toets)
      document.body.style.overflow = vorige
    }
  }, [open, index, fotos.length, onSluit, onWissel])

  if (!open) return null

  const huidige = fotos[index!]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col animate-page-in"
      onClick={(e) => { if (e.target === e.currentTarget) onSluit() }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white/90 truncate">{titel}</div>
          {fotos.length > 1 && (
            <div className="text-xs text-white/50">Foto {index! + 1} van {fotos.length}</div>
          )}
        </div>
        {/* 44 pixels: met een werkhandschoen aan is een klein kruisje
            niet te raken. */}
        <button
          onClick={onSluit}
          aria-label="Sluiten"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors flex-shrink-0"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-4">
        {huidige.url ? (
          <img
            src={huidige.url}
            alt={titel}
            className="max-w-full max-h-full object-contain rounded-sm"
          />
        ) : huidige.opgeruimd ? (
          <div className="text-center px-6">
            <IconArchive className="w-8 h-8 text-white/40 mx-auto mb-3" />
            <p className="text-sm text-white/60">
              Deze foto is opgeruimd en staat als bijlage bij de
              ClickUp-taak. De opname zelf is niet verloren — alleen hier
              niet meer te bekijken.
            </p>
          </div>
        ) : (
          <p className="text-sm text-white/60 text-center px-6">
            Deze foto kon niet worden geladen. Controleer je verbinding en
            probeer het opnieuw.
          </p>
        )}
      </div>

      {fotos.length > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 pb-6 flex-shrink-0">
          <button
            onClick={() => onWissel(index! - 1)}
            disabled={index === 0}
            aria-label="Vorige foto"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 transition-colors"
          >
            <IconChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => onWissel(index! + 1)}
            disabled={index === fotos.length - 1}
            aria-label="Volgende foto"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 transition-colors"
          >
            <IconChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

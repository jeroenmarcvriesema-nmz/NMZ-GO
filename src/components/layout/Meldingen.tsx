import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { IconBell, IconCheck } from '@tabler/icons-react'

interface Melding {
  id: string
  soort: string
  tekst: string
  werkbon_id: string | null
  gelezen_op: string | null
  created_at: string
}

/**
 * De meldingenklok.
 *
 * Overlapmeldingen werden al aangemaakt zodra iemand een klus stillegt,
 * maar er was nergens een plek waar je ze zag. Ze stonden dus wel in de
 * database en bereikten niemand — dat is erger dan geen melding, want
 * het systeem denkt dat het jou heeft gewaarschuwd.
 *
 * Het balletje verdwijnt pas als je hem opent, niet na een paar
 * seconden. Een planningsprobleem los je niet op door ernaar te kijken.
 */
export function Meldingen() {
  const [meldingen, setMeldingen] = useState<Melding[]>([])
  const [open, setOpen] = useState(false)
  const doos = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const ongelezen = meldingen.filter((m) => !m.gelezen_op).length

  const haal = async () => {
    const { data } = await supabase
      .from('meldingen')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    setMeldingen((data as Melding[]) ?? [])
  }

  useEffect(() => {
    haal()
    // Elke twee minuten bijwerken. Een overlapmelding is geen alarm dat
    // binnen seconden moet landen; wie iets stillegt weet het zelf al.
    const klok = setInterval(haal, 120_000)
    return () => clearInterval(klok)
  }, [])

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

  const markeerGelezen = async () => {
    const openIds = meldingen.filter((m) => !m.gelezen_op).map((m) => m.id)
    if (openIds.length === 0) return
    setMeldingen((lijst) => lijst.map((m) => m.gelezen_op ? m : { ...m, gelezen_op: new Date().toISOString() }))
    await supabase.from('meldingen').update({ gelezen_op: new Date().toISOString() }).in('id', openIds)
  }

  return (
    <div ref={doos} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) markeerGelezen() }}
        title="Meldingen"
        aria-label={ongelezen > 0 ? `Meldingen, ${ongelezen} ongelezen` : 'Meldingen'}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg text-tekst-gedempt dark:text-white/55 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
      >
        <IconBell className="w-5 h-5" />
        {ongelezen > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center">
            {ongelezen > 9 ? '9+' : ongelezen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 sm:w-96 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-lg border border-gray-100 dark:border-white/10 bg-white dark:bg-surface-dark-2 shadow-lg">
          <div className="sticky top-0 px-4 py-3 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-surface-dark-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Meldingen</span>
          </div>

          {meldingen.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <IconCheck className="w-6 h-6 mx-auto mb-2 text-tekst-fijn dark:text-white/40" />
              <p className="text-sm text-tekst-gedempt dark:text-white/55">
                Niets bijzonders. Je krijgt hier bericht als een stilgelegde
                klus met een andere klus in de knel komt.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {meldingen.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.werkbon_id) navigate(`/werkbonnen/${m.werkbon_id}`)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors',
                    'hover:bg-surface-2 dark:hover:bg-white/5',
                    !m.gelezen_op && 'bg-brand-yellow-light/40 dark:bg-brand-yellow/5'
                  )}
                >
                  <p className="text-sm leading-snug text-gray-700 dark:text-white/70 break-words">{m.tekst}</p>
                  <p className="text-xs text-tekst-gedempt dark:text-white/55 mt-1">
                    {new Date(m.created_at).toLocaleString('nl-NL', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

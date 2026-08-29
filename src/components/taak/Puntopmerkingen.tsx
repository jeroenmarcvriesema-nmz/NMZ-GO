import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePuntOpmerkingen } from '@/hooks/usePuntOpmerkingen'
import { IconMessage, IconSend, IconTrash } from '@tabler/icons-react'

/**
 * Het gesprekje onder een afvinkpunt.
 *
 * Staat bewust buiten `readOnly`. Dat vlaggetje gaat over afvinken en
 * fotograferen — het werk op de klus — en juist kantoor, dat daar
 * niets mag, moet hier wél iets kwijt kunnen. Het is precies andersom
 * dan bij de rest van dit scherm.
 *
 * Ingeklapt zolang er niets staat. Twintig punten met elk een leeg
 * invoerveld eronder maakt van een werkbon een formulier, en niemand
 * scrolt daar doorheen op zoek naar het vinkje.
 */
export function Puntopmerkingen({ taakId, werkbonId }: { taakId: string; werkbonId: string }) {
  const { profile } = useAuth()
  const { opmerkingen, laden, bezig, plaats, verwijder } = usePuntOpmerkingen(taakId, werkbonId)
  const [open, setOpen] = useState(false)
  const [tekst, setTekst] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  const schrijven = open || opmerkingen.length > 0

  const stuur = async () => {
    setFout(null)
    const melding = await plaats(tekst)
    if (melding) { setFout(melding); return }
    setTekst('')
  }

  const weg = async (id: string) => {
    setFout(null)
    const melding = await verwijder(id)
    if (melding) setFout(melding)
  }

  if (laden && opmerkingen.length === 0 && !open) return null

  return (
    <div className="mt-3 pl-10">
      {!schrijven ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-sm border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:border-brand-yellow hover:text-brand-yellow-dark dark:hover:text-brand-yellow transition-all duration-150 ease-brand"
        >
          <IconMessage className="w-3.5 h-3.5" /> Opmerking plaatsen
        </button>
      ) : (
        <div className="rounded-sm border border-gray-100 dark:border-white/10 bg-surface-2/50 dark:bg-white/5 p-3">
          {opmerkingen.length > 0 && (
            <div className="space-y-2.5 mb-3">
              {opmerkingen.map((o) => {
                const vanMij = o.auteur_id === profile?.id
                return (
                  <div key={o.id} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {o.auteur?.naam ?? 'Onbekend'}
                        </span>
                        <span className="text-[11px] text-tekst-gedempt dark:text-white/55 tabular-nums">
                          {wanneer(o.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-white/70 break-words whitespace-pre-wrap leading-snug mt-0.5">
                        {o.tekst}
                      </div>
                    </div>
                    {/* Alleen je eigen tekst, en de database bewaakt het
                        nog een keer. Wijzigen kan niet: een zin die
                        achteraf iets anders betekent maakt van een
                        dossier een verhaal. */}
                    {vanMij && (
                      <button
                        onClick={() => weg(o.id)}
                        title="Deze opmerking weghalen"
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-sm text-tekst-fijn dark:text-white/40 hover:text-brand-red transition-colors"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              placeholder="Iets doorgeven over dit punt…"
              className="flex-1 min-w-0 rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-tekst-fijn dark:placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow transition-all resize-y"
            />
            <button
              onClick={stuur}
              disabled={bezig || !tekst.trim()}
              className={cn(
                'flex-shrink-0 min-h-[44px] px-3 rounded-sm border font-semibold text-xs flex items-center gap-1.5 transition-all duration-150 ease-brand',
                tekst.trim()
                  ? 'border-brand-yellow bg-brand-yellow text-gray-900'
                  : 'border-gray-200 dark:border-white/10 text-tekst-fijn dark:text-white/40 cursor-not-allowed'
              )}
            >
              <IconSend className="w-3.5 h-3.5" />
              {bezig ? 'Bezig…' : 'Plaats'}
            </button>
          </div>

          {fout && (
            <p className="text-xs text-brand-red dark:text-red-400 mt-2 break-words">{fout}</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * "vandaag 10:14", "gisteren 16:02", of de datum erbij.
 *
 * Een gesprekje onder een punt gaat bijna altijd over vandaag of
 * gisteren; dan is het uur bruikbaarder dan de datum.
 */
function wanneer(iso: string): string {
  const d = new Date(iso)
  const nu = new Date()
  const tijd = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

  const dag = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  const gisteren = new Date(nu)
  gisteren.setDate(gisteren.getDate() - 1)

  if (dag(d) === dag(nu)) return `vandaag ${tijd}`
  if (dag(d) === dag(gisteren)) return `gisteren ${tijd}`
  return `${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${tijd}`
}

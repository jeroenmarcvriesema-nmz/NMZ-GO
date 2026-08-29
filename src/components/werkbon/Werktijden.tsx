import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatTijd, geefUren } from '@/hooks/useWerkdag'
import { formatDatumKort } from '@/lib/utils'
import { IconClock, IconAlertTriangle } from '@tabler/icons-react'

interface Regel {
  id: string
  datum: string
  start_tijd: string
  stop_tijd: string | null
  automatisch_afgesloten: boolean
  medewerker: { naam: string } | null
}

/**
 * De gewerkte tijd op deze klus, per dag en per persoon.
 *
 * De werkdaglogs bestaan sinds migratie 006 en werden door drie
 * schermen gebruikt — het dashboard, een persoonspagina en de eigen
 * prestaties van een zwamsaneerder — maar nergens vanuit de klus zelf.
 * Kantoor kon dus zien dát een bon achterliep, en niet hoeveel uur er
 * in zat of sinds wanneer er iemand stond. Bij een uitloopgesprek of
 * een discussie over meerwerk is dat precies het getal dat je nodig
 * hebt.
 *
 * Alleen voor kantoor. Een zwamsaneerder ziet zijn eigen tijden op het
 * Vandaag-scherm; de uren van zijn maat zijn niet aan hem.
 */
export function Werktijden({ werkbonId }: { werkbonId: string }) {
  const { magWerkBeheren } = useAuth()
  const [regels, setRegels] = useState<Regel[] | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    if (!magWerkBeheren) return
    let levend = true
    supabase
      .from('werkdag_logs')
      .select('id, datum, start_tijd, stop_tijd, automatisch_afgesloten, medewerker:profiles(naam)')
      .eq('werkbon_id', werkbonId)
      .order('datum', { ascending: false })
      .order('start_tijd', { ascending: true })
      .then(({ data, error }) => {
        if (!levend) return
        // Een mislukte ophaalronde bleef hier stil en liet een lege
        // kaart achter — niet te onderscheiden van "er is niet
        // gewerkt", en dat is een heel ander bericht.
        if (error) { setFout(error.message); setRegels([]); return }
        setRegels((data ?? []) as unknown as Regel[])
      })
    return () => { levend = false }
  }, [werkbonId, magWerkBeheren])

  if (!magWerkBeheren) return null

  const totaalMinuten = (regels ?? []).reduce((som, r) => {
    const start = new Date(r.start_tijd)
    const stop = r.stop_tijd ? new Date(r.stop_tijd) : new Date()
    return som + Math.max(0, (stop.getTime() - start.getTime()) / 60000)
  }, 0)
  const totaal = `${Math.floor(totaalMinuten / 60)}:${String(Math.round(totaalMinuten % 60)).padStart(2, '0')}`

  return (
    <Card>
      <SectionHeading
        title="Werktijden"
        actions={regels && regels.length > 0
          ? <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{totaal} uur</span>
          : undefined}
      />

      {regels === null ? (
        <div className="flex justify-center py-6"><Spinner className="w-5 h-5" /></div>
      ) : fout ? (
        <p className="text-sm text-brand-red dark:text-red-400">
          De werktijden konden niet worden opgehaald.
        </p>
      ) : regels.length === 0 ? (
        <p className="text-sm text-tekst-gedempt dark:text-white/55">
          Er is op deze klus nog geen werkdag gestart.
        </p>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-white/5">
          {regels.map((r) => {
            const start = new Date(r.start_tijd)
            const stop = r.stop_tijd ? new Date(r.stop_tijd) : null
            const loopt = !r.stop_tijd

            return (
              <div key={r.id} className="flex items-center gap-3 py-2.5 min-w-0">
                {loopt
                  ? <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                  : <IconClock className="w-3.5 h-3.5 flex-shrink-0 text-tekst-fijn dark:text-white/40" />}

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {r.medewerker?.naam ?? 'Onbekend'}
                  </div>
                  <div className="text-xs text-tekst-gedempt dark:text-white/55">
                    {formatDatumKort(r.datum)}
                    {/* Een dag die door de nachtelijke opruiming is
                        dichtgezet is geen gewerkte tijd maar een
                        vergeten stopknop. Dat hoort erbij te staan,
                        anders staat er een dag van tien uur in de
                        urenlijst die niemand kan verantwoorden. */}
                    {r.automatisch_afgesloten && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-amber-700 dark:text-amber-400">
                        <IconAlertTriangle className="w-3 h-3" /> automatisch afgesloten
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 tabular-nums">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {geefUren(start, stop)} u
                  </div>
                  <div className="text-xs text-tekst-gedempt dark:text-white/55">
                    {formatTijd(start)}–{loopt ? 'nu' : formatTijd(stop)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

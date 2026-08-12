import { useEffect, useState } from 'react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { IconBug, IconChevronDown, IconCircleCheck } from '@tabler/icons-react'

interface Fout {
  id: string
  boodschap: string
  stack: string | null
  pad: string | null
  useragent: string | null
  bron: string
  created_at: string
  melder: { naam: string } | null
}

const BRON_LABEL: Record<string, string> = {
  render: 'scherm liep vast',
  belofte: 'achtergrondfout',
  venster: 'scriptfout',
}

/** Hoever terug we kijken. Ouder dan dit zegt niets meer over vandaag. */
const DAGEN_TERUG = 14

/**
 * Storingen — de crashes van de app zelf.
 *
 * Dit stond als kaart bovenaan het dashboard, boven het werk. Dat is
 * de verkeerde volgorde: het dashboard gaat over klussen, en een
 * uitvoerder die zijn week inplant heeft niets aan een stacktrace. Het
 * is beheer van het gereedschap, geen operationele informatie.
 *
 * Daarom een eigen pagina, en alleen voor de eigenaar. Dat slot zit op
 * drie plekken en alle drie zijn ze nodig:
 *
 *   1. het menu toont de ingang niet (`Sidebar`, `MobileNav`)
 *   2. de route stuurt je weg (`EigenaarGuard` in `App.tsx`)
 *   3. de database geeft niets terug (`fouten_select_eigenaar`,
 *      migratie 030)
 *
 * Alleen de derde is beveiliging. De eerste twee zijn beleefdheid: ze
 * voorkomen dat iemand tegen een dichte deur loopt. Wie de URL intypt
 * krijgt een leeg scherm in plaats van andermans stacktraces, ook als
 * de eerste twee ooit stukgaan.
 *
 * Waarom dit bestaat: een crash op de telefoon van een zwamsaneerder in
 * een kruipruimte bereikte niemand. Hij zag een wit scherm, belde
 * kantoor, en kantoor had niets om op terug te kijken.
 */
export default function Storingen() {
  const [fouten, setFouten] = useState<Fout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const haal = async () => {
    setLoading(true)
    const grens = new Date()
    grens.setDate(grens.getDate() - DAGEN_TERUG)

    const { data, error: fout } = await supabase
      .from('fouten')
      .select('id, boodschap, stack, pad, useragent, bron, created_at, melder:profiles(naam)')
      .gte('created_at', grens.toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    if (fout) {
      setError(fout.message)
      setLoading(false)
      return
    }

    setError(null)
    setFouten(((data ?? []) as any[]).map((f) => ({
      ...f,
      melder: Array.isArray(f.melder) ? f.melder[0] ?? null : f.melder ?? null,
    })))
    setLoading(false)
  }

  useEffect(() => { void haal() }, [])

  return (
    <PageWrapper title="Storingen">
      <div className="max-w-4xl space-y-4">
        <Card>
          <SectionHeading
            title={loading ? 'Storingen' : `Storingen (${fouten.length})`}
            actions={<IconBug className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          />
          <p className="text-xs text-gray-400 dark:text-white/40 -mt-2">
            Crashes van de afgelopen {DAGEN_TERUG} dagen, gemeld door de app zelf
            vanaf het toestel waar het misging. Wie hier staat hoeft niets door te
            geven. Alleen jij ziet deze pagina.
          </p>
        </Card>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
        ) : error ? (
          <Card>
            <ErrorState
              melding="De storingen konden niet worden opgehaald. Controleer je verbinding."
              onOpnieuw={() => void haal()}
            />
          </Card>
        ) : fouten.length === 0 ? (
          <Card>
            {/* Nul storingen is goed nieuws en hoort er ook zo uit te
                zien. Op het dashboard verdween deze kaart dan helemaal;
                op een eigen pagina zou dat een leeg scherm zijn zonder
                uitleg. */}
            <EmptyState
              icon={<IconCircleCheck />}
              titel="Geen storingen"
              uitleg={`De app heeft de afgelopen ${DAGEN_TERUG} dagen niets gemeld. Zodra er ergens een scherm vastloopt verschijnt dat hier vanzelf, met het toestel en de pagina erbij.`}
            />
          </Card>
        ) : (
          <Card className="p-0">
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {fouten.map((f) => (
                <div key={f.id} className="px-4 sm:px-6 py-3">
                  <button
                    onClick={() => setOpen(open === f.id ? null : f.id)}
                    className="flex items-start gap-3 w-full text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                        {f.boodschap}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="red">{BRON_LABEL[f.bron] ?? f.bron}</Badge>
                        <span className="text-xs text-gray-400 dark:text-white/40 break-words">
                          {[
                            f.melder?.naam,
                            f.pad,
                            new Date(f.created_at).toLocaleString('nl-NL', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            }),
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </div>
                    <IconChevronDown className={cn(
                      'w-4 h-4 flex-shrink-0 mt-1 text-gray-300 dark:text-white/25 transition-transform duration-150',
                      open === f.id && 'rotate-180'
                    )} />
                  </button>

                  {open === f.id && (
                    <div className="mt-2 space-y-2">
                      {f.useragent && (
                        <p className="text-xs text-gray-400 dark:text-white/40 break-words">
                          {f.useragent}
                        </p>
                      )}
                      {f.stack && (
                        <pre className="max-h-48 overflow-auto rounded-sm bg-surface-2 dark:bg-white/5 p-3 text-[11px] leading-relaxed text-gray-500 dark:text-white/50 whitespace-pre-wrap break-words">
                          {f.stack}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}

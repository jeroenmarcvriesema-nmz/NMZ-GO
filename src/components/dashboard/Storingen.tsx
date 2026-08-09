import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { IconBug, IconChevronDown } from '@tabler/icons-react'

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

/**
 * Storingen van de afgelopen week.
 *
 * Verschijnt alleen als er iets is. Dat is met opzet: een kaart die
 * altijd "0 storingen" meldt wordt na twee weken niet meer gelezen, en
 * dan is hij er precies niet als het er wel toe doet.
 *
 * Waarom dit bestaat: een crash op de telefoon van een zwamsaneerder in
 * een kruipruimte bereikte niemand. Hij zag een wit scherm, belde
 * kantoor, en kantoor had niets om op terug te kijken.
 */
export function Storingen() {
  const [fouten, setFouten] = useState<Fout[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    const haal = async () => {
      const week = new Date()
      week.setDate(week.getDate() - 7)

      const { data } = await supabase
        .from('fouten')
        .select('id, boodschap, stack, pad, useragent, bron, created_at, melder:profiles(naam)')
        .gte('created_at', week.toISOString())
        .order('created_at', { ascending: false })
        .limit(25)

      setFouten(((data ?? []) as any[]).map((f) => ({
        ...f,
        melder: Array.isArray(f.melder) ? f.melder[0] ?? null : f.melder ?? null,
      })))
    }
    void haal()
  }, [])

  if (fouten.length === 0) return null

  return (
    <div className="mb-10 bg-white dark:bg-surface-dark-2 border border-red-200 dark:border-red-500/30 rounded-xl shadow-sm p-6">
      <SectionHeading
        title={`Storingen deze week (${fouten.length})`}
        actions={<IconBug className="w-4 h-4 text-red-500" />}
      />
      <p className="text-xs text-gray-400 dark:text-white/40 -mt-2 mb-3">
        Gemeld door de app zelf, vanaf het toestel waar het misging. Wie hier
        staat hoeft niets door te geven.
      </p>

      <div className="divide-y divide-gray-50 dark:divide-white/5">
        {fouten.map((f) => (
          <div key={f.id} className="py-3">
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
                  <span className="text-xs text-gray-400 dark:text-white/40">
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
    </div>
  )
}

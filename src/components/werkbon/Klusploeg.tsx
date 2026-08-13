import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/store/toastStore'
import type { Persoon, Werkbon } from '@/types'
import { IconUsers, IconCheck, IconInfoCircle } from '@tabler/icons-react'

/**
 * Wie er op deze klus staat, en dat kunnen wijzigen terwijl hij loopt.
 *
 * Dit ontbrak volledig: de ploeg kwam uit ClickUp en was in NMZ GO
 * nergens aan te raken. Valt er iemand uit, dan moest kantoor het in
 * ClickUp doen en maar hopen dat de ronde het binnen vijf minuten
 * ophaalde — terwijl de uitvoerder juist hier staat.
 *
 * Twee dingen die deze knop mogelijk maken en die het waard zijn om te
 * weten:
 *
 *   1. Wat je hier kiest gaat terug naar ClickUp. Anders zou de
 *      synchronisatieronde het binnen vijf minuten overschrijven met wat
 *      ClickUp nog dacht, en dan is de vraag "wie heeft gelijk" niet meer
 *      te beantwoorden.
 *   2. Iemand zonder ClickUp-label kun je hier wél op de klus zetten,
 *      maar hij komt daar niet in het planbord. Dat zeggen we erbij in
 *      plaats van het stil te laten mislukken.
 */
export function Klusploeg({ werkbon, onKlaar }: { werkbon: Werkbon; onKlaar: () => void }) {
  const { magWerkBeheren } = useAuth()
  const [ploeg, setPloeg] = useState<Persoon[] | null>(null)
  const [gekozen, setGekozen] = useState<string[]>(
    (werkbon.medewerkers ?? []).map((m: any) => m.id),
  )
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    if (!magWerkBeheren) return
    let levend = true
    supabase.from('personen').select('*').eq('actief', true).order('naam')
      .then(({ data }) => { if (levend) setPloeg((data as Persoon[]) ?? []) })
    return () => { levend = false }
  }, [magWerkBeheren])

  if (!magWerkBeheren) return null

  const origineel = (werkbon.medewerkers ?? []).map((m: any) => m.id)
  const gewijzigd =
    gekozen.length !== origineel.length ||
    gekozen.some((id) => !origineel.includes(id))

  const wissel = (id: string) =>
    setGekozen((huidig) =>
      huidig.includes(id) ? huidig.filter((x) => x !== id) : [...huidig, id],
    )

  const bewaar = async () => {
    setBezig(true)
    const { error } = await supabase.rpc('werkbon_ploeg_zetten', {
      p_werkbon: werkbon.id,
      p_personen: gekozen,
    })
    setBezig(false)

    if (error) { toast.fout(error.message || 'De ploeg kon niet worden opgeslagen.'); return }

    const zonderLabel = (ploeg ?? [])
      .filter((p) => gekozen.includes(p.id) && !p.clickup_label)
      .map((p) => p.naam)

    toast.goed(zonderLabel.length > 0
      ? `Ploeg bijgewerkt — ${zonderLabel.join(', ')} staat niet in ClickUp`
      : 'Ploeg bijgewerkt, ClickUp wordt bijgewerkt')
    onKlaar()
  }

  return (
    <Card>
      <SectionHeading title="Ploeg" />

      {ploeg === null ? (
        <div className="flex justify-center py-6"><Spinner className="w-5 h-5" /></div>
      ) : ploeg.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-white/40">
          Er staat nog niemand in het personenregister.
        </p>
      ) : (
        // flex-wrap en niet een raster met vaste kolommen: namen
        // verschillen sterk in lengte ("Sam" naast "Jeffrey Huizenga")
        // en op een telefoon van 390 pixels moet dat gewoon doorlopen.
        <div className="flex flex-wrap gap-2">
          {ploeg.map((p) => {
            const aan = gekozen.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => wissel(p.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[44px]',
                  'text-sm font-semibold transition-colors duration-150 ease-brand',
                  'max-w-full',
                  aan
                    ? 'bg-brand-blue text-white border-brand-blue'
                    : 'bg-white dark:bg-surface-dark-2 text-gray-600 dark:text-white/60 border-gray-200 dark:border-white/10 hover:border-brand-blue',
                )}
              >
                {aan && <IconCheck className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{p.naam}</span>
                {!p.clickup_label && (
                  <span
                    className={cn('text-[10px] font-bold flex-shrink-0',
                      aan ? 'text-white/70' : 'text-brand-yellow-dark dark:text-brand-yellow')}
                    title="Deze persoon heeft geen ClickUp-label en komt daar niet op het planbord"
                  >
                    !
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Button variant="primary" size="sm" className="min-h-[44px]"
          loading={bezig} disabled={!gewijzigd} onClick={bewaar}>
          <IconUsers className="w-4 h-4" /> Ploeg opslaan
        </Button>

        {werkbon.clickup_taak_id && (
          <p className="flex items-start gap-1.5 text-xs text-gray-400 dark:text-white/40 min-w-0">
            <IconInfoCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-words">Wordt ook in ClickUp gezet, onder Medewerkers.</span>
          </p>
        )}
      </div>
    </Card>
  )
}

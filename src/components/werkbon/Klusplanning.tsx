import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/store/toastStore'
import type { Werkbon } from '@/types'
import { IconCalendar, IconInfoCircle } from '@tabler/icons-react'

/**
 * De start- en opleverdatum van een klus wijzigen.
 *
 * Deze twee velden bepalen waar een klus in de weekplanning staat, en
 * ze waren nergens aan te passen: bij een bon uit ClickUp kwamen ze
 * mee, en bij een handmatige bon stonden ze helemaal niet. Een typefout
 * betekende dus de bon opnieuw aanmaken.
 *
 * Bij een klus uit ClickUp wint ClickUp. Dat staat er ook bij — een
 * knop die iets wijzigt wat een halfuur later stilletjes wordt
 * teruggezet, is erger dan geen knop.
 */
export function Klusplanning({ werkbon, onKlaar }: { werkbon: Werkbon; onKlaar: () => void }) {
  const { magWerkBeheren } = useAuth()
  const [start, setStart] = useState(werkbon.geplande_start ?? werkbon.datum)
  const [eind, setEind] = useState(werkbon.geplande_eind ?? '')
  const [bezig, setBezig] = useState(false)

  if (!magWerkBeheren) return null

  const gewijzigd =
    start !== (werkbon.geplande_start ?? werkbon.datum) ||
    eind !== (werkbon.geplande_eind ?? '')

  const bewaar = async () => {
    if (!start) { toast.fout('Een klus heeft een startdatum nodig.'); return }
    if (eind && eind < start) { toast.fout('De opleverdatum ligt vóór de startdatum.'); return }

    setBezig(true)
    // `datum` schuift mee met de start, net als bij een klus uit
    // ClickUp: daar is `datum` ook de dag waarop begonnen wordt.
    const { data, error } = await supabase
      .from('werkbonnen')
      .update({ datum: start, geplande_start: start, geplande_eind: eind || null })
      .eq('id', werkbon.id)
      .select('id')
    setBezig(false)

    if (error || !data || data.length === 0) {
      toast.fout('De planning kon niet worden opgeslagen.')
      return
    }
    toast.goed('Planning bijgewerkt')
    onKlaar()
  }

  return (
    <Card>
      <SectionHeading title="Planning" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Startdatum" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="Opleverdatum" type="date" value={eind} min={start}
          onChange={(e) => setEind(e.target.value)}
          hint="Leeg laten voor een klus van één dag" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <Button variant="primary" size="sm" className="min-h-[44px]"
          loading={bezig} disabled={!gewijzigd} onClick={bewaar}>
          <IconCalendar className="w-4 h-4" /> Planning opslaan
        </Button>

        {werkbon.clickup_taak_id && (
          <p className="flex items-start gap-1.5 text-xs text-gray-400 dark:text-white/40">
            <IconInfoCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Deze klus komt uit ClickUp; daar staan de datums ook. Wijzig je ze
            hier, dan zet de eerstvolgende synchronisatieronde ze terug.
          </p>
        )}
      </div>
    </Card>
  )
}

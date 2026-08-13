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
    // Via de RPC en niet rechtstreeks op de tabel: daar zit de rolcheck,
    // het meeschuiven van `datum` en de wachtrijtaak die ClickUp
    // bijwerkt. Een update op de tabel zou dat laatste overslaan en de
    // twee systemen stilletjes uit elkaar laten lopen.
    const { error } = await supabase.rpc('werkbon_planning_zetten', {
      p_werkbon: werkbon.id,
      p_start: start,
      p_eind: eind || null,
    })
    setBezig(false)

    if (error) {
      toast.fout(error.message || 'De planning kon niet worden opgeslagen.')
      return
    }
    toast.goed(werkbon.clickup_taak_id
      ? 'Planning bijgewerkt, ClickUp wordt bijgewerkt'
      : 'Planning bijgewerkt')
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

        {/* Hier stond dat ClickUp zou winnen en dat de eerstvolgende
            ronde de datums zou terugzetten. Dat gebeurde niet — een bon
            die zijn PDF heeft wordt door de ronde overgeslagen, op de
            status na — en nu de wijziging ook naar ClickUp gaat, klopt
            het helemaal niet meer. Een waarschuwing die niet waar is
            houdt mensen van de knop af. */}
        {werkbon.clickup_taak_id && (
          <p className="flex items-start gap-1.5 text-xs text-gray-400 dark:text-white/40 min-w-0">
            <IconInfoCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-words">
              Wordt ook in ClickUp gezet, als start- en opleverdatum.
            </span>
          </p>
        )}
      </div>
    </Card>
  )
}

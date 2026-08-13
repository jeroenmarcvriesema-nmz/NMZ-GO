import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { toast } from '@/store/toastStore'
import { useAuth } from '@/hooks/useAuth'
import type { Werkbon } from '@/types'
import {
  IconPlayerPause, IconPlayerPlay, IconCircleCheck,
  IconAlertTriangle, IconInfoCircle, IconCalendarRepeat,
} from '@tabler/icons-react'

interface Props {
  werkbon: Werkbon
  onKlaar: () => void
}

/**
 * Stilleggen, hervatten en opleveren — de drie dingen die kantoor met
 * een lopende klus kan doen.
 *
 * Deze functies zaten al in de database, compleet met terugkoppeling
 * naar ClickUp, maar er was geen knop. Daarmee was het onbereikbaar
 * voor iedereen behalve iemand met SQL-toegang.
 *
 * De reden bij stilleggen is verplicht. Dat wordt hier ook afgedwongen,
 * maar het echte slot zit in de database: een aanroep zonder reden komt
 * er sowieso niet doorheen. Dit scherm zegt het alleen eerder, zodat je
 * geen foutmelding krijgt maar een duidelijke vraag.
 */
/**
 * Waarmee een reden begint als de klus opnieuw ingepland moet worden.
 *
 * De database leidt de ClickUp-status af uit de tekst van de reden
 * (`statusUitReden`): staat "opnieuw inplannen" erin, dan gaat de taak
 * naar die status. Dat werkte al, maar je moest het maar net weten en
 * precies zo tikken. De knop zet het er nu zelf voor.
 */
const OPNIEUW = 'Opnieuw inplannen'

export function Klusacties({ werkbon, onKlaar }: Props) {
  const { magWerkBeheren } = useAuth()
  const [modal, setModal] = useState<null | 'stilleggen' | 'opnieuw'>(null)
  const [reden, setReden] = useState('')
  const [bezig, setBezig] = useState(false)
  const [overlap, setOverlap] = useState<any[]>([])

  if (!magWerkBeheren) return null

  const stil = Boolean(werkbon.stilgelegd_op)
  const opgeleverd = Boolean(werkbon.opgeleverd_op)
  // Een klus die opnieuw ingepland moet worden ligt óók stil, maar om
  // een andere reden. Dat verschil hoort op het scherm te staan.
  const wachtOpPlanning = stil && (werkbon.stilleg_reden ?? '').toLowerCase().startsWith(OPNIEUW.toLowerCase())

  const stilleggen = async () => {
    if (reden.trim().length < 3) return
    const volledig = modal === 'opnieuw' ? `${OPNIEUW}: ${reden.trim()}` : reden.trim()

    setBezig(true)
    const { data, error } = await supabase.rpc('werkbon_stilleggen', {
      p_werkbon: werkbon.id,
      p_reden: volledig,
    })
    setBezig(false)

    if (error) {
      toast.fout(error.message || 'Dat lukte niet. Probeer het opnieuw.')
      return
    }

    const opnieuw = modal === 'opnieuw'
    setModal(null)
    setReden('')
    const gevonden = (data as any)?.overlap ?? []
    setOverlap(gevonden)

    toast.goed(gevonden.length > 0
      ? `${opnieuw ? 'Klus gaat opnieuw ingepland worden' : 'Klus stilgelegd'} — let op ${gevonden.length} mogelijke overlap`
      : opnieuw
        ? 'Klus staat op opnieuw inplannen, ClickUp wordt bijgewerkt'
        : 'Klus stilgelegd, ClickUp wordt bijgewerkt')
    onKlaar()
  }

  const hervatten = async () => {
    setBezig(true)
    const { error } = await supabase.rpc('werkbon_hervatten', { p_werkbon: werkbon.id })
    setBezig(false)
    if (error) { toast.fout(error.message || 'Hervatten lukte niet.'); return }
    setOverlap([])
    toast.goed('Klus hervat, ClickUp wordt bijgewerkt')
    onKlaar()
  }

  const opleveren = async () => {
    setBezig(true)
    const { error } = await supabase.rpc('werkbon_opleveren', { p_werkbon: werkbon.id })
    setBezig(false)
    if (error) {
      // De database weigert opleveren zolang de zwamsaneerder de bon
      // niet op voltooid heeft gezet. Dat is geen storing maar de
      // volgorde, dus dat zeggen we ook zo.
      toast.fout(error.message || 'Opleveren lukte niet.')
      return
    }
    toast.goed('Opgeleverd — ClickUp gaat op opgeleverd')
    onKlaar()
  }

  return (
    <>
      <Card>
        {stil && (
          <div className="flex items-start gap-2 mb-4 p-3 rounded-sm bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30">
            <IconAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-orange-800 dark:text-orange-300">
                {wachtOpPlanning ? 'Deze klus moet opnieuw ingepland worden' : 'Deze klus ligt stil'}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-200/80 mt-0.5">
                {werkbon.stilleg_reden}
              </div>
            </div>
          </div>
        )}

        {opgeleverd && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-sm bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
            <IconCircleCheck className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
            <span className="text-sm font-bold text-green-800 dark:text-green-300">
              Opgeleverd en bevestigd
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {stil ? (
            <Button variant="secondary" className="min-h-[44px]" loading={bezig} onClick={hervatten}>
              <IconPlayerPlay className="w-4 h-4" /> Klus hervatten
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                className="min-h-[44px]"
                disabled={opgeleverd}
                onClick={() => setModal('stilleggen')}
              >
                <IconPlayerPause className="w-4 h-4" /> Klus stilleggen
              </Button>

              {/* Eigen knop, want dit is een andere beslissing dan
                  stilleggen: de klus gaat niet verder vandaag én moet
                  een nieuwe plek in de planning krijgen. Tot nu toe
                  kwam je er alleen door precies "opnieuw inplannen" in
                  de reden te typen. */}
              <Button
                variant="secondary"
                className="min-h-[44px]"
                disabled={opgeleverd}
                onClick={() => setModal('opnieuw')}
              >
                <IconCalendarRepeat className="w-4 h-4" /> Opnieuw inplannen
              </Button>
            </>
          )}

          {!opgeleverd && (
            <Button
              variant="primary"
              className="min-h-[44px] sm:ml-auto"
              loading={bezig}
              onClick={opleveren}
            >
              <IconCircleCheck className="w-4 h-4" /> Opleveren
            </Button>
          )}
        </div>

        {!opgeleverd && werkbon.status !== 'voltooid' && (
          <p className="flex items-start gap-1.5 mt-3 text-xs text-gray-400 dark:text-white/40">
            <IconInfoCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Opleveren kan pas als de zwamsaneerder de bon heeft afgerond — dan
            staat vast dat elk punt met fotoplicht een foto heeft.
          </p>
        )}

        {overlap.length > 0 && (
          <div className="mt-4 p-3 rounded-sm bg-brand-yellow-light dark:bg-brand-yellow/10 border border-brand-yellow">
            <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              Mogelijke overlap in de planning
            </div>
            <ul className="text-sm text-gray-700 dark:text-white/70 space-y-1">
              {overlap.map((o, n) => (
                <li key={n}>
                  {o.medewerker} staat op {o.adres}, begint {o.start}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-2">
              De klus erna schuift niet automatisch mee — dat is een keuze die
              een mens moet maken. Jij en de planner hebben hier een melding van.
            </p>
          </div>
        )}
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => { setModal(null); setReden('') }}
        title={modal === 'opnieuw' ? 'Klus opnieuw inplannen' : 'Klus stilleggen'}
      >
        <div className="space-y-4">
          {/* Er stond dat de opleverdatum één dag opschoof. Dat deed de
              database ook, en dat is er sinds migratie 029 uit: hoelang
              een klus stilligt weet niemand op het moment dat je hem
              stillegt. Bij asbest is dat geen dag maar een
              inventarisatie. De planning verschuift dus niet — dat
              blijft een keuze van de planner. */}
          <p className="text-sm text-gray-600 dark:text-white/60">
            {modal === 'opnieuw' ? (
              <>
                {werkbon.adres} gaat naar <em>opnieuw inplannen/later</em> in ClickUp.
                De klus blijft bestaan met al zijn punten en foto's; hij wacht op
                een nieuwe datum van de planner. Zet die datum daarna hieronder
                bij <strong>Planning</strong> en hervat de klus.
              </>
            ) : (
              <>
                {werkbon.adres} gaat op stil. De taak in ClickUp krijgt een passende
                status met je reden erbij. De planning verschuift niet: dat blijft
                een keuze van de planner.
              </>
            )}
          </p>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-white/70 mb-1.5">
              {modal === 'opnieuw' ? 'Waarom moet hij opnieuw ingepland worden?' : 'Waarom ligt de klus stil?'}
            </label>
            <textarea
              value={reden}
              onChange={(e) => setReden(e.target.value)}
              rows={3}
              autoFocus
              placeholder={modal === 'opnieuw'
                ? 'Bijvoorbeeld: bewoner niet thuis, vloer nog niet vrij'
                : 'Bijvoorbeeld: ziekte, geen compleet koppel'}
              className="w-full rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow transition-all"
            />
            {/* Geen keuzelijst: wie een klus stillegt heeft haast. Wel
                deze hint, want één woord stuurt de ClickUp-status. */}
            {modal === 'stilleggen' && (
              <p className="text-xs text-gray-400 dark:text-white/40 mt-1.5">
                Staat er <strong>asbest</strong> in, dan gaat de taak naar de
                asbeststatus. Verder wordt het "on hold". Moet de klus een nieuwe
                datum krijgen, gebruik dan de knop <strong>Opnieuw inplannen</strong>.
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="secondary" onClick={() => { setModal(null); setReden('') }}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              loading={bezig}
              disabled={reden.trim().length < 3}
              onClick={stilleggen}
            >
              {modal === 'opnieuw'
                ? <><IconCalendarRepeat className="w-4 h-4" /> Opnieuw inplannen</>
                : <><IconPlayerPause className="w-4 h-4" /> Stilleggen</>}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

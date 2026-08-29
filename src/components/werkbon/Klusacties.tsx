import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { toast } from '@/store/toastStore'
import { useAuth } from '@/hooks/useAuth'
import type { Werkbon } from '@/types'
import { cn } from '@/lib/utils'
import { vervolgLabel } from '@/lib/vervolgwerk'
import {
  IconPlayerPause, IconPlayerPlay, IconCircleCheck,
  IconAlertTriangle, IconInfoCircle, IconCalendarRepeat,
  IconBiohazard, IconSpray,
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
 * De vier knoppen, en het verschil dat er tussen zit.
 *
 * Ze zagen er alle vier hetzelfde uit en riepen alle vier
 * `werkbon_stilleggen()` aan. Voor de eerste twee klopt dat: het werk
 * ligt stil. Voor de andere twee niet — en dat is precies wat de
 * eigenaar meldde. "Nog spuiten/isoleren" betekent dat het grondwerk
 * klaar is en er nog gespoten of geïsoleerd moet worden; "opnieuw
 * inplannen/later" dat er een nieuwe datum komt. In beide gevallen is
 * er niets stilgelegd, maar zette de knop wél `stilgelegd_op` — en
 * omdat `klusstand()` die kolom als eerste leest, werd de klus in de
 * héle app rood met "Ligt stil": op de planning, op het dashboard, in
 * de containerlijst.
 *
 * Sinds migratie 035 zijn het twee dingen:
 *
 *   ● **stilleggen** (`werkbon_stilleggen`) — het werk staat stil, en
 *     de app hoort dat te laten zien.
 *   ● **vervolgwerk melden** (`werkbon_vervolg_melden`) — de klus loopt
 *     door; er gaat alleen een status naar het bord in ClickUp zodat de
 *     planner ziet wélk werk er nog ligt en wie hij nodig heeft.
 *
 * Bij stilleggen zet de knop nog steeds een vast woord vóór de reden:
 * `statusUitReden` in de verwerker leest dat en kiest de ClickUp-status.
 * Asbest heeft daarom een eigen knop — dat woord precies moeten intypen
 * om de goede status te raken was een onnodig risico op de verkeerde
 * plek. Bij vervolgwerk is dat niet nodig: daar staat de soort in de
 * aanroep zelf.
 */
const SOORTEN = {
  stilleggen: {
    vervolg: null,
    prefix: null as string | null,
    knop: 'Klus stilleggen',
    titel: 'Klus stilleggen',
    vraag: 'Waarom ligt de klus stil?',
    voorbeeld: 'Bijvoorbeeld: ziekte, geen compleet koppel',
    melding: 'Klus stilgelegd, ClickUp wordt bijgewerkt',
  },
  asbest: {
    vervolg: null,
    prefix: 'Asbest',
    knop: 'Asbest',
    titel: 'Asbest gevonden',
    vraag: 'Wat is er aangetroffen, en waar?',
    voorbeeld: 'Bijvoorbeeld: plaatmateriaal onder de vloer bij de meterkast',
    melding: 'Klus op asbest gezet, ClickUp wordt bijgewerkt',
  },
  opnieuw: {
    vervolg: 'opnieuw_inplannen',
    prefix: null,
    knop: 'Opnieuw inplannen',
    titel: 'Opnieuw inplannen/later',
    vraag: 'Waarom moet hij opnieuw ingepland worden?',
    voorbeeld: 'Bijvoorbeeld: bewoner niet thuis, vloer nog niet vrij',
    melding: 'Op het bord gezet als opnieuw inplannen/later',
  },
  spuiten: {
    vervolg: 'spuiten_isoleren',
    prefix: null,
    knop: 'Nog spuiten/isoleren',
    titel: 'Nog spuiten/isoleren',
    vraag: 'Wat moet er nog gebeuren?',
    voorbeeld: 'Bijvoorbeeld: bodem is klaar, isolatie volgt volgende week',
    melding: 'Op het bord gezet als nog spuiten/isoleren',
  },
} as const

type Soort = keyof typeof SOORTEN

const PICTOGRAM: Record<Soort, typeof IconPlayerPause> = {
  stilleggen: IconPlayerPause,
  asbest: IconBiohazard,
  opnieuw: IconCalendarRepeat,
  spuiten: IconSpray,
}

export function Klusacties({ werkbon, onKlaar }: Props) {
  const { magWerkBeheren } = useAuth()
  const [modal, setModal] = useState<null | Soort>(null)
  const [reden, setReden] = useState('')
  const [bezig, setBezig] = useState(false)
  const [overlap, setOverlap] = useState<any[]>([])

  if (!magWerkBeheren) return null

  const stil = Boolean(werkbon.stilgelegd_op)
  const opgeleverd = Boolean(werkbon.opgeleverd_op)
  const vervolg = werkbon.vervolg_soort ?? null

  /**
   * Eén knop, twee bestemmingen.
   *
   * Stilleggen en asbest gaan naar `werkbon_stilleggen` en zetten de
   * klus stil. De andere twee gaan naar `werkbon_vervolg_melden` en
   * raken `stilgelegd_op` niet aan — die zetten alleen een status op
   * het bord in ClickUp.
   */
  const versturen = async () => {
    if (reden.trim().length < 3) return
    const soort = SOORTEN[modal!]

    setBezig(true)
    const { data, error } = soort.vervolg
      ? await supabase.rpc('werkbon_vervolg_melden', {
        p_werkbon: werkbon.id,
        p_soort: soort.vervolg,
        p_reden: reden.trim(),
      })
      : await supabase.rpc('werkbon_stilleggen', {
        p_werkbon: werkbon.id,
        p_reden: soort.prefix ? `${soort.prefix}: ${reden.trim()}` : reden.trim(),
      })
    setBezig(false)

    if (error) {
      toast.fout(error.message || 'Dat lukte niet. Probeer het opnieuw.')
      return
    }

    setModal(null)
    setReden('')
    // Alleen stilleggen zoekt naar overlap: dat is de vraag "wie komt
    // hierdoor ergens anders in de knel". Bij vervolgwerk schuift er
    // niets, dus valt er ook niets in de knel te komen.
    const gevonden = (data as any)?.overlap ?? []
    setOverlap(gevonden)

    // De overlapmelding gaat vóór de bevestiging: dat er iemand in de
    // knel komt is het nieuws, niet dat de knop het deed.
    toast.goed(gevonden.length > 0
      ? `${soort.titel} — let op ${gevonden.length} mogelijke overlap`
      : soort.melding)
    onKlaar()
  }

  const vervolgAfronden = async () => {
    setBezig(true)
    const { error } = await supabase.rpc('werkbon_vervolg_afronden', { p_werkbon: werkbon.id })
    setBezig(false)
    if (error) { toast.fout(error.message || 'Dat lukte niet.'); return }
    toast.goed('Vervolgwerk afgerond, ClickUp wordt bijgewerkt')
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
                Deze klus ligt stil
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-200/80 mt-0.5">
                {werkbon.stilleg_reden}
              </div>
            </div>
          </div>
        )}

        {/* Vervolgwerk, en dus blauw en niet oranje. Er ligt niets stil:
            er moet nog iets gebeuren en het is bekend wát. Dit stond
            hiervoor in dezelfde oranje balk met "Deze klus ligt stil"
            erboven, en dat was gewoon niet waar. */}
        {vervolg && (
          <div className="flex items-start gap-2 mb-4 p-3 rounded-sm bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <IconSpray className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
                {vervolgLabel(vervolg)}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-200/80 mt-0.5 break-words">
                {werkbon.vervolg_reden}
              </div>
              <div className="text-xs text-blue-600/80 dark:text-blue-300/60 mt-1">
                De klus loopt door — dit is de status op het bord in ClickUp
                {werkbon.clickup_status ? `: ${werkbon.clickup_status}` : ''}.
              </div>
              {!opgeleverd && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2.5 min-h-[44px]"
                  loading={bezig}
                  onClick={vervolgAfronden}
                >
                  <IconCircleCheck className="w-4 h-4" /> Vervolgwerk is gedaan
                </Button>
              )}
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
            // Vier knoppen, twee soorten. De eerste twee leggen de klus
            // stil, de laatste twee melden vervolgwerk en laten hem
            // gewoon doorlopen — dat verschil zat er hiervoor niet in,
            // en alle vier zetten `stilgelegd_op`.
            //
            // flex-wrap en niet vier op een rij: op een telefoon van 390
            // pixels passen er twee naast elkaar, en dan liever twee
            // hele knoppen dan vier afgeknepen.
            //
            // Staat er al vervolgwerk op de bon, dan zijn die twee
            // knoppen weg: de melding staat hierboven met een knop om
            // hem af te ronden.
            <div className="flex flex-wrap gap-2">
              {(['stilleggen', 'asbest', ...(vervolg ? [] : ['opnieuw', 'spuiten'])] as Soort[]).map((soort) => {
                const Pictogram = PICTOGRAM[soort]
                return (
                  <Button
                    key={soort}
                    variant="secondary"
                    className={cn(
                      'min-h-[44px] flex-1 sm:flex-none',
                      // Asbest krijgt de kleur die het verdient. Niet
                      // rood — dat is stilgelegd, en asbest ís een vorm
                      // van stilleggen — maar fel oranje, zodat je hem
                      // niet per ongeluk aanraakt en wel meteen vindt.
                      soort === 'asbest' &&
                        'border-orange-400 text-orange-700 hover:bg-orange-50 ' +
                        'dark:border-orange-500/50 dark:text-orange-400 dark:hover:bg-orange-500/10',
                      // De twee vervolgknoppen in blauw: ze doen iets
                      // anders dan de twee ernaast, en dat mag je zien
                      // vóórdat je klikt.
                      SOORTEN[soort].vervolg &&
                        'border-blue-300 text-blue-700 hover:bg-blue-50 ' +
                        'dark:border-blue-500/40 dark:text-blue-400 dark:hover:bg-blue-500/10',
                    )}
                    disabled={opgeleverd}
                    onClick={() => setModal(soort)}
                  >
                    <Pictogram className="w-4 h-4" /> {SOORTEN[soort].knop}
                  </Button>
                )
              })}
            </div>
          )}

          {/* De knop volgt nu de regel die er onder staat.
              Hij zag er volledig bruikbaar uit terwijl de zin eronder
              uitlegt dat opleveren pas kan als de ploeg de bon heeft
              afgerond — dus je drukte, en kreeg een foutmelding als
              antwoord op iets wat de app al wist. De uitleg blijft
              staan; die is nu de reden waarom hij uit staat in plaats
              van de waarschuwing achteraf. */}
          {!opgeleverd && (
            <Button
              variant="primary"
              className="min-h-[44px] sm:ml-auto"
              loading={bezig}
              disabled={werkbon.status !== 'voltooid'}
              title={werkbon.status !== 'voltooid'
                ? 'Kan pas als de zwamsaneerder de bon heeft afgerond'
                : undefined}
              onClick={opleveren}
            >
              <IconCircleCheck className="w-4 h-4" /> Opleveren
            </Button>
          )}
        </div>

        {!opgeleverd && werkbon.status !== 'voltooid' && (
          <p className="flex items-start gap-1.5 mt-3 text-xs text-tekst-gedempt dark:text-white/55">
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
        title={modal ? SOORTEN[modal].titel : ''}
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
                De klus blijft bestaan met al zijn punten en foto's en wordt
                <strong> niet stilgelegd</strong> — hij wacht op een nieuwe datum
                van de planner. Zet die datum hieronder bij <strong>Planning</strong>.
              </>
            ) : modal === 'asbest' ? (
              <>
                {werkbon.adres} gaat naar <em>onhold door asbest</em> in ClickUp.
                Laat de ploeg stoppen en niets meer verstoren. Hoelang dit duurt is
                nu niet te zeggen — er komt een inventarisatie achteraan en mogelijk
                een gecertificeerde saneerder. De planning verschuift dus niet.
              </>
            ) : modal === 'spuiten' ? (
              <>
                {werkbon.adres} gaat naar <em>nog spuiten/isoleren</em> in ClickUp.
                Het grondwerk is klaar, er moet alleen nog gespoten of geïsoleerd
                worden — zo ziet de planner meteen wélk werk er nog ligt en wie
                daarvoor nodig is. De klus wordt <strong>niet stilgelegd</strong>:
                hij loopt door en blijft als lopend werk meetellen.
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
              {modal ? SOORTEN[modal].vraag : ''}
            </label>
            <textarea
              value={reden}
              onChange={(e) => setReden(e.target.value)}
              rows={3}
              autoFocus
              placeholder={modal ? SOORTEN[modal].voorbeeld : ''}
              className="w-full rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-tekst-fijn dark:placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow transition-all"
            />
            {/* Geen keuzelijst: wie een klus stillegt heeft haast. Wel
                deze hint, want één woord stuurt de ClickUp-status. */}
            {/* Alleen bij de vrije variant. Bij de andere drie staat het
                woord al vast en is deze uitleg ruis. */}
            {modal === 'stilleggen' && (
              <p className="text-xs text-tekst-gedempt dark:text-white/55 mt-1.5">
                Deze knop legt de klus écht stil — hij wordt overal als
                stilgelegd geteld. Moet er alleen nog gespoten of geïsoleerd
                worden, of komt er een nieuwe datum? Gebruik dan de blauwe
                knoppen: die zetten wél de status in ClickUp, maar leggen de
                klus niet stil.
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
              onClick={versturen}
            >
              {modal && (() => {
                const Pictogram = PICTOGRAM[modal]
                return <><Pictogram className="w-4 h-4" /> {SOORTEN[modal].knop}</>
              })()}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

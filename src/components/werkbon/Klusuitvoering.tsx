import { useState, type ComponentProps } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Spinner } from '@/components/ui/Spinner'
import { TaakItem } from '@/components/taak/TaakItem'
import { Klusinfo } from '@/components/werkbon/Klusinfo'
import { PuntToevoegen } from '@/components/werkbon/PuntToevoegen'
import { supabase } from '@/lib/supabase'
import { berekenVoortgang, formatDatum, cn } from '@/lib/utils'
import { standkleur } from '@/lib/klusstand'
import { vervolgLabel } from '@/lib/vervolgwerk'
import { IconCheck, IconAlertCircle, IconCircleCheck, IconCalendar, IconListCheck, IconSpray } from '@tabler/icons-react'
import type { Werkbon } from '@/types'

interface Props {
  werkbon: Werkbon
  /** Bovenschriftje op de kop, bv. "Vandaag werk je aan". Weglaten mag. */
  kopje?: string
  /** De punten zijn nog onderweg — dan een spinner in plaats van lege fotovakjes. */
  laden?: boolean
  /** De laatste ophaalronde mislukte; wat je ziet kan verouderd zijn. */
  ophaalfout?: string | null
  /** Lezen mag, afvinken en fotograferen niet (werkdag nog niet gestart, of gestopt). */
  readOnly?: boolean
  /** Waaróm er niet afgevinkt kan worden. Staat naast de kop van de punten. */
  bijschrift?: string
  /**
   * De werkdag moet lopen voordat er afgevinkt of geüpload mag worden.
   *
   * Alleen ingevuld door het Vandaag-scherm: daar staan de start- en
   * stopknoppen. Op `/werkbon/:id` blijft dit leeg — een bon van
   * volgende week heeft geen werkdag om te starten.
   */
  werkdagNodig?: ComponentProps<typeof TaakItem>['werkdagNodig']
  onRefresh: () => void
  /** Na een geslaagde afronding. Vandaag ververst; `/werkbon/:id` gaat terug. */
  onVoltooid?: () => void
  /**
   * Laat het percentage en de balk in de kop weg.
   *
   * Voor Vandaag: daar staat de voortgang al als ring bovenaan het
   * scherm, twee kaarten hoger. Hetzelfde getal twee keer binnen tweehonderd
   * pixels leest niet als bevestiging maar als ruis.
   */
  zonderVoortgang?: boolean
}

/**
 * De uitvoering van één klus: waar het is, hoe ver het staat, wat je
 * moet doen, en de foto's die je daarbij maakt.
 *
 * Dit stond twee keer in de app. Vandaag bouwde de checklist zelf op,
 * `/werkbon/:id` deed hetzelfde werk in een nettere opbouw, en onderaan
 * Vandaag stond een knop die van de een naar de ander sprong. Woorden
 * van de eigenaar: "ik doe werkdag starten, ik kom bij de werkbon, en
 * daarna klik ik op werkbon openen en kom ik bij dezelfde werkbon maar
 * dan werkt het iets mooier." Dat is één scherm, en dit is dat scherm.
 *
 * Wat hier bewust *niet* in zit: de werkdagknoppen en de dagcontext.
 * Die horen bij de dag, niet bij de bon — `/werkbon/:id` toont een bon
 * van volgende week, en daar hoort geen STOP WERKDAG onder.
 */
export function Klusuitvoering({
  werkbon, kopje, laden, ophaalfout, readOnly, bijschrift, werkdagNodig,
  onRefresh, onVoltooid, zonderVoortgang,
}: Props) {
  const [voltooien, setVoltooien] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  const taken = werkbon.taken ?? []
  const voortgang = berekenVoortgang(taken)
  // Dezelfde stand en kleur als op de lijstschermen en de planning.
  const k = standkleur(werkbon)
  const aantalKlaar = taken.filter((t) => t.voltooid).length
  const allesAfgevinkt = taken.length > 0 && aantalKlaar === taken.length

  const voltooiWerkbon = async () => {
    setFout(null)
    setVoltooien(true)
    // `.select()` erbij zodat we zien of er écht een rij is geraakt.
    // Zonder dat geeft een door RLS geblokkeerde update een lege,
    // geldige respons — en zou de monteur "voltooid" zien terwijl er
    // niets is opgeslagen.
    const { data, error } = await supabase
      .from('werkbonnen')
      .update({ status: 'voltooid' })
      .eq('id', werkbon.id)
      .select('id')
    setVoltooien(false)

    // Twee verschillende oorzaken, twee verschillende meldingen.
    // Een fout is techniek (verbinding, server). Nul geraakte rijen
    // betekent dat RLS de update tegenhield — in de praktijk: deze
    // monteur staat niet meer op de werkbon.
    if (error) {
      setFout('Opslaan lukte niet. Controleer je verbinding en probeer het opnieuw.')
      return
    }
    if (!data || data.length === 0) {
      setFout('Je staat niet meer op deze werkbon, dus afronden lukt niet. Vraag de beheerder om je opnieuw in te plannen.')
      return
    }
    onVoltooid?.()
  }

  return (
    <>
      <Card accent="yellow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {kopje && (
              <p className="text-[11px] font-bold text-tekst-gedempt dark:text-white/55 uppercase tracking-widest mb-2">
                {kopje}
              </p>
            )}
            {/* Het adres is de klus. "Zwamsanering" staat op elke bon en
                zegt dus niets — dat stond hier ooit als kop met het
                adres eronder. */}
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight break-words">
              {werkbon.adres}
            </h1>
            <p className="text-sm text-gray-500 dark:text-white/60 mt-0.5">{werkbon.projectnaam}</p>
            <span className={cn('inline-flex items-center gap-1.5 mt-2 text-xs font-semibold', k.tekst)}>
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', k.bol)} />
              {k.label}
            </span>
          </div>
          {!zonderVoortgang && (
            <div className="text-right flex-shrink-0">
              <div className={cn('text-2xl font-extrabold tabular-nums',
                voortgang === 100 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white')}>
                {voortgang}%
              </div>
              <div className="text-xs text-tekst-gedempt dark:text-white/55">{aantalKlaar}/{taken.length} punten</div>
            </div>
          )}
        </div>
        {!zonderVoortgang && (
          <div className="mt-3"><ProgressBar value={voortgang} size="md" variant={k.badge} /></div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-50 dark:border-white/5 text-xs text-tekst-gedempt dark:text-white/55">
          {/* Met "start" ervoor, anders leest een datum uit het verleden
              als een fout in plaats van als de startdatum. */}
          <span className="flex items-center gap-1">
            <IconCalendar className="w-3.5 h-3.5" />
            start {formatDatum(werkbon.geplande_start ?? werkbon.datum)}
          </span>
          {werkbon.geplande_eind && <span>opleveren {formatDatum(werkbon.geplande_eind)}</span>}
          <span className="flex items-center gap-1"><IconListCheck className="w-3.5 h-3.5" />{taken.length} punten</span>
          {werkbon.bonnummer && <span>Bon {werkbon.bonnummer}</span>}
        </div>
      </Card>

      {/* Een mislukte ophaalronde na een foto of een vinkje bleef stil:
          het scherm hield de oude gegevens vast en je zag niet dat er
          iets niet was aangekomen. */}
      {ophaalfout && (
        <div className="flex items-start gap-2 text-xs text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3">
          <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
          Het scherm kon niet worden bijgewerkt. Wat je ziet kan verouderd
          zijn — controleer je verbinding en laad de pagina opnieuw.
        </div>
      )}

      {werkbon.stilgelegd_op && (
        <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 font-bold text-sm text-orange-800 dark:text-orange-300">
            <IconAlertCircle className="w-4 h-4 flex-shrink-0" /> Deze klus ligt stil
          </div>
          <div className="text-sm text-orange-700 dark:text-orange-200/80 mt-1">
            {werkbon.stilleg_reden}
          </div>
        </div>
      )}

      {/* Vervolgwerk is geen stilstand: de klus loopt door, er ligt
          alleen nog werk van een ander soort. Blauw dus, en niet de
          oranje balk hierboven — die zegt "hier kan niemand verder". */}
      {werkbon.vervolg_soort && (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-800 dark:text-blue-300">
            <IconSpray className="w-4 h-4 flex-shrink-0" />
            {vervolgLabel(werkbon.vervolg_soort)}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-200/80 mt-1 break-words">
            {werkbon.vervolg_reden}
          </div>
        </div>
      )}

      {/* Vóór de punten: op dit moment sta je voor de deur en zoek je de
          kluiscode, niet punt één. */}
      <Klusinfo werkbon={werkbon} />

      {/* Afronden staat los van de werkdag. Wie klaar is mag de bon
          dichtdoen, of hij nu net gestopt is of nog bezig — de uren
          staan al vast in de werkdaglog. */}
      {allesAfgevinkt && werkbon.status !== 'voltooid' && (
        <div className="bg-brand-yellow-light dark:bg-brand-yellow/10 border border-brand-yellow rounded-lg p-4">
          <div className="flex items-center gap-2 font-bold text-sm mb-1 text-gray-900 dark:text-white">
            <IconCircleCheck className="w-4 h-4 text-brand-yellow-dark dark:text-brand-yellow" /> Alle punten afgevinkt
          </div>
          <div className="text-xs text-gray-600 dark:text-white/60 mb-3">Rond de werkbon af zodat de beheerder het rapport kan inzien.</div>
          <Button variant="primary" fullWidth loading={voltooien} onClick={voltooiWerkbon}><IconCheck className="w-4 h-4" /> Werkbon voltooien</Button>
          {fout && (
            <div className="flex items-start gap-2 text-xs text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-3 mt-3">
              <IconAlertCircle className="w-4 h-4 flex-shrink-0" />{fout}
            </div>
          )}
        </div>
      )}

      {werkbon.status === 'voltooid' && (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400 font-bold">
            <IconCircleCheck className="w-4 h-4" /> Werkbon voltooid
          </div>
        </div>
      )}

      <Card>
        {/* Het bijschrift stond náást de kop. Op een telefoon van 390
            pixels duwde die zin van tien woorden "Uit te voeren punten"
            over drie regels uiteen. Eronder leest het in één regel. */}
        <SectionHeading title={`Uit te voeren punten (${taken.length})`} className="mb-1.5" />
        <p className="text-xs text-tekst-gedempt dark:text-white/55 mb-4">
          {bijschrift ?? 'Maak een foto vóór je afvinkt'}
        </p>
        {/* Wachten tot de foto's er zijn. Zonder dit tekent hij eerst de
            punten mét een leeg cameravakje en springen de foto's er een
            tel later in — precies het beeld waarvan gemeld is dat het
            eruitziet alsof er niets staat. */}
        {laden ? (
          <div className="flex justify-center py-6"><Spinner className="w-5 h-5" /></div>
        ) : taken.length === 0 ? (
          <p className="text-sm text-tekst-gedempt dark:text-white/55 text-center py-4">Geen punten op deze bon.</p>
        ) : (
          taken.map((taak) => (
            <TaakItem
              key={taak.id}
              taak={taak}
              werkbonId={werkbon.id}
              readOnly={readOnly || werkbon.status === 'voltooid'}
              gesloten={Boolean(werkbon.opgeleverd_op)}
              werkdagNodig={werkdagNodig}
              onRefresh={onRefresh}
            />
          ))
        )}

        {/* Meerwerk dat op de klus zelf wordt afgesproken. Alleen voor
            kantoor, en niet meer als de bon al is afgerond — dan is de
            lijst waar de zwamsaneerder voor getekend heeft gesloten. */}
        {!readOnly && werkbon.status !== 'voltooid' && (
          <PuntToevoegen werkbonId={werkbon.id} onKlaar={onRefresh} />
        )}
      </Card>
    </>
  )
}

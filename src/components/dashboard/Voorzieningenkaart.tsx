import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDatumKort } from '@/lib/utils'
import { omschrijf } from '@/lib/voorzieningen'
import { useVoorzieningen, type VoorzieningRegel } from '@/hooks/useVoorzieningen'
import {
  IconTruck, IconToiletPaper, IconAlertTriangle, IconCheck, IconSquare,
  IconSquareCheck, IconExternalLink,
} from '@tabler/icons-react'

/**
 * Wat er besteld en afgemeld moet worden, per adres.
 *
 * Een container en een dixi komen van een derde partij: ze moeten
 * geleverd zijn vóór dag één en weg zodra ze niet meer nodig zijn.
 * Wát er nodig is staat in de werkvoorbereiding van de opdracht; wat er
 * al gedaan is houdt kantoor hier bij.
 *
 * Drie stapels, in de volgorde waarin ze geld kosten:
 *
 *   1. **Afmelden** — de opleverdatum is voorbij en het ding staat er
 *      nog. Dit is huur die doorloopt, dus het staat bovenaan.
 *   2. **Bestellen** — moet er staan vóór de eerste werkdag. Een
 *      container die op dag één ontbreekt kost een dag werk.
 *   3. **Staat er** — besteld en nog niet afgemeld. Meestal niets aan
 *      te doen, maar hier zit wél de knop om vervroegd af te melden:
 *      een klus die op dag twee van de vijf al leeg is hoeft de
 *      container niet nog drie dagen te houden.
 *
 * Ze sluiten elkaar uit: afvinken verplaatst een regel zichtbaar naar
 * de volgende stapel in plaats van hem twee keer te laten staan.
 *
 * Alleen voor kantoor. De kaart staat op het kantoordashboard en de
 * tabel eronder laat niemand anders binnen.
 */
export function Voorzieningenkaart() {
  const { afmelden, bestellen, staatEr, loading, error, stempel } = useVoorzieningen()
  const navigate = useNavigate()
  const [fout, setFout] = useState<string | null>(null)

  const zet = async (r: VoorzieningRegel, wat: 'besteld' | 'afgemeld', aan: boolean) => {
    setFout(await stempel(r, wat, aan))
  }

  if (loading) {
    return (
      <Card>
        <SectionHeading title="Containers &amp; dixi's" />
        <div className="flex justify-center py-8"><Spinner className="w-5 h-5" /></div>
      </Card>
    )
  }

  const openstaand = afmelden.length + bestellen.length

  return (
    <Card>
      <SectionHeading
        title="Containers &amp; dixi's"
        actions={
          <span className="text-xs text-gray-400 dark:text-white/40">
            {openstaand === 0 ? 'niets openstaand' : `${openstaand} openstaand`}
          </span>
        }
      />

      {(error || fout) && (
        <p className="flex items-start gap-1.5 text-sm text-brand-red dark:text-red-400 mb-3">
          <IconAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{fout ?? 'De lijst kon niet worden opgehaald.'}</span>
        </p>
      )}

      {afmelden.length === 0 && bestellen.length === 0 && staatEr.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-gray-400 dark:text-white/40 py-2">
          <IconCheck className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
          Niets te bestellen of af te melden.
        </p>
      ) : (
        <div className="space-y-5">
          {afmelden.length > 0 && (
            <Blok
              titel="Afmelden"
              uitleg="De opleverdatum is bereikt — laat ophalen, anders loopt de huur door."
              regels={afmelden}
              dringend
              onZet={zet}
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
          )}

          {bestellen.length > 0 && (
            <Blok
              titel="Bestellen"
              uitleg="Moet er staan vóór de eerste werkdag."
              regels={bestellen}
              onZet={zet}
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
          )}

          {staatEr.length > 0 && (
            <Blok
              titel="Staat er"
              uitleg="Besteld en nog niet afgemeld. Eerder klaar? Meld hem gerust vervroegd af."
              regels={staatEr}
              rustig
              onZet={zet}
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
          )}
        </div>
      )}
    </Card>
  )
}

function Blok({ titel, uitleg, regels, dringend, rustig, onZet, onOpen }: {
  titel: string
  uitleg: string
  regels: VoorzieningRegel[]
  dringend?: boolean
  rustig?: boolean
  onZet: (r: VoorzieningRegel, wat: 'besteld' | 'afgemeld', aan: boolean) => void
  onOpen: (id: string) => void
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className={cn(
          'text-sm font-bold',
          dringend ? 'text-amber-700 dark:text-amber-400'
            : rustig ? 'text-gray-500 dark:text-white/50'
              : 'text-gray-900 dark:text-white',
        )}>
          {titel}
        </h3>
        <span className="text-xs text-gray-400 dark:text-white/40 tabular-nums">
          {regels.length}
        </span>
      </div>
      <p className="text-xs text-gray-400 dark:text-white/40 mb-2">{uitleg}</p>

      <div className="divide-y divide-gray-50 dark:divide-white/5">
        {regels.map((r) => (
          <Regel
            key={r.sleutel}
            regel={r}
            dringend={dringend}
            onZet={onZet}
            onOpen={() => onOpen(r.werkbonId)}
          />
        ))}
      </div>
    </div>
  )
}

function Regel({ regel, dringend, onZet, onOpen }: {
  regel: VoorzieningRegel
  dringend?: boolean
  onZet: (r: VoorzieningRegel, wat: 'besteld' | 'afgemeld', aan: boolean) => void
  onOpen: () => void
}) {
  // Het woord dat zegt hoe dringend het is. "Vandaag" en "3 dagen te
  // laat" vragen iets anders van je dan "over 4 dagen", en dat verschil
  // hoort in de tekst te staan en niet alleen in een kleur.
  const wanneer = dringend
    ? regel.dagenNaEind === 0 ? 'vandaag afmelden'
      : `${regel.dagenNaEind} ${regel.dagenNaEind === 1 ? 'dag' : 'dagen'} over de datum`
    : regel.dagenTotStart <= 0 ? 'is al begonnen'
      : regel.dagenTotStart === 1 ? 'begint morgen'
        : `over ${regel.dagenTotStart} dagen`

  const alarm = dringend && regel.dagenNaEind > 0
  const Pictogram = regel.soort === 'container' ? IconTruck : IconToiletPaper

  return (
    <div className="py-2.5 min-w-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <Pictogram className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400 dark:text-white/40" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white break-words">
              {regel.adres || 'Zonder adres'}
            </span>
            <span className="text-xs font-semibold text-gray-500 dark:text-white/50">
              {regel.soort === 'container'
                ? `Container ${omschrijf(regel.wat)}`
                : 'Dixi'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-gray-400 dark:text-white/40">
            <span className={cn('font-semibold', alarm && 'text-amber-700 dark:text-amber-400')}>
              {alarm && <IconAlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
              {wanneer}
            </span>
            <span>
              {formatDatumKort(regel.start)}
              {regel.eind !== regel.start && ` – ${formatDatumKort(regel.eind)}`}
            </span>
            {/* Een stilgelegde klus staat er bewust bij: juist dán blijft
                er een container voor de deur staan waar niemand meer aan
                denkt. */}
            {regel.stilgelegd && (
              <span className="font-semibold text-brand-red dark:text-red-400">klus ligt stil</span>
            )}
          </div>
        </div>

        <button
          onClick={onOpen}
          aria-label="Werkbon openen"
          className="flex-shrink-0 p-1 text-gray-300 dark:text-white/25 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <IconExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* De twee stempels. Allebei altijd beschikbaar: afmelden mag ook
          vóór de opleverdatum, en een container kan buiten de app om
          zijn geregeld — dan is "besteld" niet iets wat je hier eerst
          moet invullen om verder te komen. */}
      <div className="flex flex-wrap gap-2 mt-2 ml-6">
        <Stempel
          aan={Boolean(regel.besteldOp)}
          label="Besteld"
          kleur="blue"
          onKlik={() => onZet(regel, 'besteld', !regel.besteldOp)}
        />
        <Stempel
          aan={Boolean(regel.afgemeldOp)}
          label="Afgemeld"
          kleur="green"
          onKlik={() => onZet(regel, 'afgemeld', !regel.afgemeldOp)}
        />
      </div>
    </div>
  )
}

/**
 * Eén vinkje.
 *
 * Aan- én uitzetbaar: iemand tikt de verkeerde regel aan, en dan is een
 * vinkje dat er niet meer af kan erger dan geen vinkje. De 44 pixels
 * hoogte zijn er omdat dit ook op een telefoon met handschoenen aan
 * raak moet zijn.
 */
function Stempel({ aan, label, kleur, onKlik }: {
  aan: boolean
  label: string
  kleur: 'blue' | 'green'
  onKlik: () => void
}) {
  return (
    <button
      onClick={onKlik}
      aria-pressed={aan}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full border',
        'text-xs font-semibold transition-colors duration-150 ease-brand',
        aan
          ? kleur === 'blue'
            ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-400'
            : 'border-green-300 bg-green-50 text-green-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-400'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-white/10 dark:bg-surface-dark-2 dark:text-white/50',
      )}
    >
      {aan
        ? <IconSquareCheck className="w-3.5 h-3.5 flex-shrink-0" />
        : <IconSquare className="w-3.5 h-3.5 flex-shrink-0" />}
      {label}
    </button>
  )
}

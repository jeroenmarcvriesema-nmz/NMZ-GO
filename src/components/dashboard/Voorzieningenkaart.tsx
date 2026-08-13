import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDatumKort } from '@/lib/utils'
import { omschrijf } from '@/lib/voorzieningen'
import { useVoorzieningen, type VoorzieningRegel } from '@/hooks/useVoorzieningen'
import {
  IconTruck, IconToiletPaper, IconChevronRight, IconAlertTriangle, IconCheck,
} from '@tabler/icons-react'

/**
 * Wat er besteld en afgemeld moet worden, per adres.
 *
 * Een container en een dixi komen van een derde partij: ze moeten
 * geleverd zijn vóór dag één en weg ná de opleverdatum. Beide staan in
 * de werkvoorbereiding van de opdracht, en stonden daarmee alleen in
 * een lap tekst die je per bon moest openslaan.
 *
 * Twee blokken, in de volgorde waarin ze geld kosten:
 *
 *   1. **Afmelden.** Een container die blijft staan kost huur per dag.
 *      Dit is het blok dat vandaag iets van je vraagt, dus het staat
 *      bovenaan — ook al is het meestal het kortste.
 *   2. **Bestellen.** Wat er de komende dagen moet staan. Een container
 *      die op dag één niet staat, kost een dag werk.
 *
 * "Niet vermeld" komt hier niet in. De lijst zou zich vullen met
 * klussen waarvan we het simpelweg niet weten, en dan is een volle
 * lijst geen signaal meer. Wat er staat, staat er omdat het in de
 * opdracht staat.
 */
export function Voorzieningenkaart() {
  const { afmelden, bestellen, loading, error } = useVoorzieningen()
  const navigate = useNavigate()

  if (loading) {
    return (
      <Card>
        <SectionHeading title="Containers & dixi's" />
        <div className="flex justify-center py-8"><Spinner className="w-5 h-5" /></div>
      </Card>
    )
  }

  const niets = afmelden.length === 0 && bestellen.length === 0

  return (
    <Card>
      <SectionHeading
        title="Containers &amp; dixi's"
        actions={
          <span className="text-xs text-gray-400 dark:text-white/40">
            uit de werkvoorbereiding
          </span>
        }
      />

      {error ? (
        <p className="text-sm text-brand-red dark:text-red-400">
          De lijst kon niet worden opgehaald.
        </p>
      ) : niets ? (
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
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
          )}

          {bestellen.length > 0 && (
            <Blok
              titel="Bestellen"
              uitleg="Moet er staan vóór de eerste werkdag."
              regels={bestellen}
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
          )}
        </div>
      )}
    </Card>
  )
}

function Blok({ titel, uitleg, regels, dringend, onOpen }: {
  titel: string
  uitleg: string
  regels: VoorzieningRegel[]
  dringend?: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className={cn(
          'text-sm font-bold',
          dringend ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white',
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
          <Regel key={r.id} regel={r} dringend={dringend} onOpen={() => onOpen(r.id)} />
        ))}
      </div>
    </div>
  )
}

function Regel({ regel, dringend, onOpen }: {
  regel: VoorzieningRegel
  dringend?: boolean
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

  return (
    <button
      onClick={onOpen}
      className="flex items-start gap-2.5 w-full py-2.5 text-left rounded-lg hover:bg-brand-yellow-light/30 dark:hover:bg-white/5 transition-colors min-w-0"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900 dark:text-white break-words">
          {regel.adres || 'Zonder adres'}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          {regel.container.nodig === 'ja' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-white/70">
              <IconTruck className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-white/40" />
              Container {omschrijf(regel.container)}
            </span>
          )}
          {regel.dixi.nodig === 'ja' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-white/70">
              <IconToiletPaper className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-white/40" />
              Dixi
            </span>
          )}
          {/* Een stilgelegde klus staat er bewust bij: juist dán blijft
              er een container voor de deur staan waar niemand meer aan
              denkt. */}
          {regel.stilgelegd && (
            <span className="text-xs font-semibold text-brand-red dark:text-red-400">
              klus ligt stil
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-gray-400 dark:text-white/40">
          <span className={cn(
            'font-semibold',
            alarm && 'text-amber-700 dark:text-amber-400',
          )}>
            {alarm && <IconAlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
            {wanneer}
          </span>
          <span>
            {formatDatumKort(regel.start)}
            {regel.eind !== regel.start && ` – ${formatDatumKort(regel.eind)}`}
          </span>
          {regel.bonnummer && <span>Bon {regel.bonnummer}</span>}
        </div>
      </div>

      <IconChevronRight className="w-4 h-4 flex-shrink-0 mt-1 text-gray-300 dark:text-white/25" />
    </button>
  )
}

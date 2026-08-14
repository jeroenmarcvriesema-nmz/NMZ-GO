import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { useVoorzieningen, type VoorzieningRegel } from '@/hooks/useVoorzieningen'
import { bestelstand, URGENTIES, type Stapel } from '@/lib/bestelstand'
import { omschrijf } from '@/lib/voorzieningen'
import { cn, formatDatumKort } from '@/lib/utils'
import {
  IconTruck, IconToiletPaper, IconAlertTriangle, IconCircleCheck,
  IconPackage, IconExternalLink, IconCheck, IconPlayerPause, IconTruckReturn,
} from '@tabler/icons-react'

/**
 * Containers & dixi's — wat er besteld en afgemeld moet worden.
 *
 * Dit stond als kaart op het dashboard, halverwege de pagina, en dat
 * klopte niet op twee manieren. Het was te ver weg — je moest ernaartoe
 * scrollen langs alles waar het niet over ging — en tegelijk te
 * gedrongen: drie stapels met elk een handjevol regels in één kaart
 * proppen levert een lijst op waar niets uitspringt. Nu staan er twee
 * tegels op het dashboard die het getal laten zien, en zit de lijst
 * zelf hier, met de ruimte om per regel te tonen wat het is, wanneer
 * het moet en wat er al gebeurd is.
 *
 * Drie stapels, in de volgorde waarin ze geld kosten:
 *
 *   1. **Afmelden** — de opleverdatum is voorbij en het ding staat er
 *      nog. Huur die doorloopt.
 *   2. **Bestellen** — moet er staan vóór de eerste werkdag. Een
 *      container die op dag één ontbreekt kost een dag werk.
 *   3. **Staat er** — besteld en nog niet afgemeld. Meestal niets aan
 *      te doen, behalve vervroegd afmelden als de klus eerder leeg is.
 *
 * Ze sluiten elkaar uit: afvinken verplaatst een regel zichtbaar naar
 * de volgende stapel.
 */
export default function Voorzieningen() {
  const { afmelden, bestellen, staatEr, loading, error, stempel } = useVoorzieningen()
  const navigate = useNavigate()
  const [fout, setFout] = useState<string | null>(null)

  if (loading) {
    return (
      <PageWrapper title="Containers &amp; dixi's">
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper title="Containers &amp; dixi's">
        <Card>
          <ErrorState
            melding="De lijst kon niet worden opgehaald. Controleer je verbinding."
            onOpnieuw={() => window.location.reload()}
          />
        </Card>
      </PageWrapper>
    )
  }

  const zet = async (r: VoorzieningRegel, wat: 'besteld' | 'afgemeld', aan: boolean) => {
    setFout(await stempel(r, wat, aan))
  }

  // Het scherpste getal per tegel: niet "er zijn er drie" maar "de
  // ergste staat er acht dagen te lang".
  const ergsteTeLaat = afmelden[0]?.dagenNaEind ?? 0
  const eerstvolgende = bestellen[0]

  const alles = afmelden.length + bestellen.length + staatEr.length

  return (
    <PageWrapper title="Containers &amp; dixi's">
      <div className="max-w-5xl space-y-6">
        {/* Twee naast elkaar op een telefoon, net als op het dashboard.
            Onder elkaar kostten drie tegels het halve scherm voordat de
            lijst begon. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <KpiCard
            label="Af te melden"
            value={afmelden.length}
            icon={<IconAlertTriangle />}
            variant={afmelden.length > 0 ? 'red' : 'neutral'}
            sub={afmelden.length > 0
              ? ergsteTeLaat > 0
                ? `langste ${ergsteTeLaat} ${ergsteTeLaat === 1 ? 'dag' : 'dagen'} over de datum`
                : 'vandaag aan de beurt'
              : 'niets staat te lang'}
          />
          <KpiCard
            label="Te bestellen"
            value={bestellen.length}
            icon={<IconPackage />}
            variant={bestellen.length > 0 ? 'blue' : 'neutral'}
            sub={eerstvolgende
              ? `eerste: ${bestelstand(eerstvolgende, 'bestellen').tekst}`
              : 'alles is besteld'}
          />
          <KpiCard
            label="Staat er"
            value={staatEr.length}
            icon={<IconTruck />}
            variant="neutral"
            sub="besteld en nog niet afgemeld"
          />
        </div>

        {fout && (
          <div className="flex items-start gap-2 text-sm text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-lg p-3">
            <IconAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{fout}</span>
          </div>
        )}

        {alles === 0 ? (
          <Card>
            <EmptyState
              icon={<IconCircleCheck />}
              titel="Niets te bestellen of af te melden"
              uitleg="Zodra een werkopdracht om een container of een dixi vraagt, verschijnt hij hier — met de datum waarop hij er moet staan."
            />
          </Card>
        ) : (
          <>
            <Stapelkaart
              stapel="afmelden"
              titel="Afmelden"
              uitleg="De opleverdatum is bereikt. Laten ophalen, anders loopt de huur door."
              regels={afmelden}
              onZet={zet}
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
            <Stapelkaart
              stapel="bestellen"
              titel="Bestellen"
              uitleg="Moet er staan vóór de eerste werkdag."
              regels={bestellen}
              onZet={zet}
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
            <Stapelkaart
              stapel="staat_er"
              titel="Staat er"
              uitleg="Besteld en nog niet afgemeld. Klus eerder klaar? Meld hem gerust vervroegd af."
              regels={staatEr}
              onZet={zet}
              onOpen={(id) => navigate(`/werkbonnen/${id}`)}
            />
          </>
        )}
      </div>
    </PageWrapper>
  )
}

/**
 * De kop van een stapel krijgt de kleur van zijn zwaarste regel.
 *
 * Zo zie je aan de kaart al of er iets te laat is, zonder de regels te
 * lezen. Een lege stapel tekent zichzelf niet: een kopje met daaronder
 * "geen" is drie regels ruimte voor niets.
 */
function Stapelkaart({ stapel, titel, uitleg, regels, onZet, onOpen }: {
  stapel: Stapel
  titel: string
  uitleg: string
  regels: VoorzieningRegel[]
  onZet: (r: VoorzieningRegel, wat: 'besteld' | 'afgemeld', aan: boolean) => void
  onOpen: (id: string) => void
}) {
  if (regels.length === 0) return null

  const zwaarste = URGENTIES[bestelstand(regels[0], stapel).urgentie]

  // Een gewone div en geen <Card>: die brengt zijn eigen `p-6` mee, en
  // `cn` is clsx zonder tailwind-merge — `p-0` ernaast laat de uitkomst
  // afhangen van de volgorde in de stylesheet. De gekleurde kop moet
  // tot aan de rand lopen, dus hier zetten we de opmaak zelf.
  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm overflow-hidden">
      <div className={cn('flex items-center gap-3 px-4 sm:px-6 py-4', zwaarste.chip)}>
        <span className={cn(
          'inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-extrabold tabular-nums flex-shrink-0',
          'bg-white/70 dark:bg-black/20', zwaarste.tekst,
        )}>
          {regels.length}
        </span>
        <div className="min-w-0">
          <h2 className={cn('text-base font-extrabold tracking-tight leading-none', zwaarste.tekst)}>
            {titel}
          </h2>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1 break-words">{uitleg}</p>
        </div>
      </div>

      <div className="divide-y divide-gray-50 dark:divide-white/5">
        {regels.map((r) => (
          <Regel
            key={r.sleutel}
            regel={r}
            stapel={stapel}
            onZet={onZet}
            onOpen={() => onOpen(r.werkbonId)}
          />
        ))}
      </div>
    </div>
  )
}

function Regel({ regel, stapel, onZet, onOpen }: {
  regel: VoorzieningRegel
  stapel: Stapel
  onZet: (r: VoorzieningRegel, wat: 'besteld' | 'afgemeld', aan: boolean) => void
  onOpen: () => void
}) {
  const stand = bestelstand(regel, stapel)
  const kleur = URGENTIES[stand.urgentie]
  const Pictogram = regel.soort === 'container' ? IconTruck : IconToiletPaper
  const wat = regel.soort === 'container' ? `Container ${omschrijf(regel.wat)}` : 'Dixi'

  return (
    <div className="flex items-stretch">
      {/* Het streepje links draagt de dringendheid over de hele regel.
          Kleur alleen op een chipje verdwijnt tussen de tekst zodra er
          vijf regels onder elkaar staan. */}
      <div className={cn('w-1 flex-shrink-0', kleur.rand)} aria-hidden="true" />

      <div className="flex-1 min-w-0 px-3 sm:px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            kleur.vak, kleur.tekst,
          )}>
            <Pictogram className="w-[18px] h-[18px]" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white break-words leading-snug">
              {regel.adres || 'Zonder adres'}
            </div>

            {/* Wát het is en wannéér het moet, allebei als chip. Dit
                stond als twee grijze zinnetjes van elf pixels onder
                elkaar; op een telefoon las dat als één grijze vlek. */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
                kleur.chip, kleur.tekst,
              )}>
                {stand.urgentie === 'te_laat' && <IconAlertTriangle className="w-3 h-3 flex-shrink-0" />}
                {stand.tekst}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-2 dark:bg-white/10 text-gray-600 dark:text-white/60">
                {wat}
              </span>
              {/* Een stilgelegde klus staat er bewust bij: juist dán
                  blijft er een container voor de deur staan waar
                  niemand meer aan denkt. */}
              {regel.stilgelegd && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400">
                  <IconPlayerPause className="w-3 h-3 flex-shrink-0" /> klus ligt stil
                </span>
              )}
            </div>

            <div className="text-xs text-gray-400 dark:text-white/40 mt-1.5">
              {formatDatumKort(regel.start)}
              {regel.eind !== regel.start && ` – ${formatDatumKort(regel.eind)}`}
              {regel.bonnummer && ` · bon ${regel.bonnummer}`}
            </div>
          </div>

          <button
            onClick={onOpen}
            aria-label="Werkbon openen"
            title="Werkbon openen"
            className="flex-shrink-0 p-2 -m-1 rounded-lg text-gray-300 dark:text-white/25 hover:text-gray-900 dark:hover:text-white hover:bg-surface-2 dark:hover:bg-white/10 transition-colors"
          >
            <IconExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* De twee stempels. Allebei altijd beschikbaar: afmelden mag
            ook vóór de opleverdatum, en een container kan buiten de app
            om zijn geregeld — dan is "besteld" niet iets wat je hier
            eerst moet invullen om verder te komen. */}
        <div className="flex flex-wrap gap-2 mt-3 ml-12">
          <Stempel
            aan={Boolean(regel.besteldOp)}
            uit="Bestellen"
            aanTekst="Besteld"
            icoon={<IconPackage className="w-4 h-4 flex-shrink-0" />}
            kleur="blue"
            onKlik={() => onZet(regel, 'besteld', !regel.besteldOp)}
          />
          <Stempel
            aan={Boolean(regel.afgemeldOp)}
            uit="Afmelden"
            aanTekst="Afgemeld"
            icoon={<IconTruckReturn className="w-4 h-4 flex-shrink-0" />}
            kleur="green"
            onKlik={() => onZet(regel, 'afgemeld', !regel.afgemeldOp)}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Eén stempel: een knop die zegt wat er te doen is, en daarna wat er
 * gedaan is.
 *
 * Hier stonden twee grijze vakjes met "Besteld" en "Afgemeld" erin, in
 * dezelfde grijstint als de tekst eromheen. Wat er nog moest gebeuren
 * en wat al gedaan was verschilde alleen in een vinkje van veertien
 * pixels. Nu draagt de knop in beide standen kleur, en verandert het
 * woord mee: vóór het stempelen staat er de handeling ("Bestellen"),
 * daarna de stand ("Besteld").
 *
 * Aan- én uitzetbaar: iemand tikt de verkeerde regel aan, en een vinkje
 * dat er niet meer af kan is erger dan geen vinkje. De 44 pixels hoogte
 * zijn er omdat dit ook op een telefoon met handschoenen aan raak moet
 * zijn.
 */
function Stempel({ aan, uit, aanTekst, icoon, kleur, onKlik }: {
  aan: boolean
  /** Het woord als het nog moet gebeuren — een werkwoord. */
  uit: string
  /** Het woord als het gedaan is. */
  aanTekst: string
  /** Het pictogram vóór het stempelen. Daarna is het altijd een vinkje. */
  icoon: React.ReactNode
  kleur: 'blue' | 'green'
  onKlik: () => void
}) {
  const stijl = {
    blue: {
      aan: 'border-blue-500 bg-blue-500 text-white dark:border-blue-500 dark:bg-blue-500/90',
      uit: 'border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20',
    },
    green: {
      aan: 'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500/90',
      uit: 'border-green-200 bg-green-50/60 text-green-700 hover:bg-green-100 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20',
    },
  }[kleur]

  return (
    <button
      onClick={onKlik}
      aria-pressed={aan}
      title={aan ? `${aanTekst} — tik om terug te draaien` : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-lg border',
        'text-xs font-bold transition-colors duration-150 ease-brand',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/50',
        aan ? stijl.aan : stijl.uit,
      )}
    >
      {aan ? <IconCheck className="w-4 h-4 flex-shrink-0" /> : icoon}
      {aan ? aanTekst : uit}
    </button>
  )
}

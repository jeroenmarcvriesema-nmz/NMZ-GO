import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { groepeerKlussen, type Klusgroep } from '@/lib/klusgroepen'
import { STANDEN, KLEURWAS, type Klusstand } from '@/lib/klusstand'
import { zoektMee } from '@/lib/zoeken'
import { cn, formatDatumKort } from '@/lib/utils'
import {
  IconPlus, IconSearch, IconMapPin, IconCalendar, IconUsers,
  IconListCheck, IconChevronRight, IconChevronDown, IconFolderOpen, IconBuilding,
} from '@tabler/icons-react'

/**
 * Precies dezelfde standen en woorden als op Alle werkbonnen.
 *
 * Hier stond een eigen lijstje met "Loopt" waar de rest van de app
 * "Bezig" zegt, en zonder "Klaar om af te ronden". Een status mag op de
 * projectenpagina niet anders heten dan op de werkbonnen.
 *
 * Afgerond vangt ook het opgeleverde werk: wie hier filtert zoekt wat
 * klaar is, en of kantoor het al heeft opgeleverd is een andere vraag.
 */
const STANDFILTERS: { label: string; value: Klusstand | 'alle' }[] = [
  { label: 'Alle',                     value: 'alle' },
  { label: STANDEN.niet_gestart.kort,  value: 'niet_gestart' },
  { label: STANDEN.bezig.label,        value: 'bezig' },
  { label: STANDEN.af_te_ronden.kort,  value: 'af_te_ronden' },
  { label: STANDEN.afgerond.label,     value: 'afgerond' },
  { label: STANDEN.stilgelegd.label,   value: 'stilgelegd' },
]

/**
 * Projecten en losse klussen.
 *
 * Deze pagina las de tabel `projecten`. Die is leeg en blijft leeg: uit
 * ClickUp komt één taak als één werkbon en nooit als project. Het scherm
 * toonde daarom altijd dezelfde lege staat, en zoeken vond nooit iets —
 * de reden dat het zoekveld "niet werkte" was dat er niets in de lijst
 * stond om te vinden.
 *
 * Nu komt de lijst uit de werkbonnen zelf. Bonnen die hetzelfde
 * opdrachtnummer dragen — het nummer dat kantoor met de hand invult bij
 * een groot project, bijvoorbeeld C515 — staan onder één kaart. Al het
 * andere is een losse klus met een adres, en dat is bij ons de
 * meerderheid.
 */
export default function Projecten() {
  const navigate = useNavigate()
  const { werkbonnen, loading, error, refetch } = useWerkbonnen()
  const [standFilter, setStandFilter] = useState<Klusstand | 'alle'>('alle')
  const [zoek, setZoek] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const groepen = groepeerKlussen(werkbonnen)

  // Een groep telt mee zodra één bon eruit past. Zoek je op een adres
  // dat halverwege een project zit, dan hoort dat project te verschijnen
  // en niet weg te vallen omdat de eerste bon een ander adres heeft.
  const gefilterd = groepen.filter((g) => {
    const sOk = standFilter === 'alle'
      || g.status === standFilter
      || (standFilter === 'afgerond' && g.status === 'opgeleverd')
    const zOk = zoek.trim() === '' || g.bonnen.some((b) => zoektMee(b, zoek))
    return sOk && zOk
  })

  const filtersAan = standFilter !== 'alle' || zoek.trim() !== ''

  return (
    <PageWrapper
      title="Projecten"
      actions={
        <Button variant="primary" onClick={() => navigate('/werkbonnen/nieuw')}>
          <IconPlus className="w-4 h-4" /> Nieuwe klus
        </Button>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 sm:max-w-md">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tekst-gedempt dark:text-white/55" />
          <input
            type="text"
            placeholder="Adres, plaats, postcode, opdrachtnummer of naam…"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            className="w-full min-h-[44px] pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none placeholder:text-tekst-fijn dark:placeholder:text-white/45 focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20"
          />
        </div>
        <div className="flex gap-1 bg-surface-2 dark:bg-white/5 p-1 rounded-sm flex-wrap">
          {STANDFILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStandFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap',
                standFilter === f.value
                  ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="w-8 h-8" />
        </div>
      ) : error ? (
        <ErrorState
          melding="De klussen konden niet worden geladen. Controleer je verbinding."
          onOpnieuw={refetch}
        />
      ) : gefilterd.length === 0 ? (
        <EmptyState
          icon={<IconFolderOpen />}
          titel={filtersAan ? 'Niets gevonden' : 'Nog geen klussen'}
          uitleg={
            filtersAan
              ? 'Probeer alleen de straatnaam, of de plaats. Zoeken kijkt ook in postcode, bonnummer, opdrachtnummer en de namen van de ploeg.'
              : 'Zodra de synchronisatie met ClickUp gelopen heeft staan de klussen hier.'
          }
          actie={
            filtersAan
              ? <Button variant="ghost" size="sm" onClick={() => { setStandFilter('alle'); setZoek('') }}>Filters wissen</Button>
              : <Button variant="primary" size="sm" onClick={() => navigate('/werkbonnen')}>Naar werkbonnen</Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {gefilterd.map((groep) => (
            <Groepkaart
              key={groep.sleutel}
              groep={groep}
              open={open === groep.sleutel}
              onKlap={() => setOpen(open === groep.sleutel ? null : groep.sleutel)}
              onOpenBon={(id) => navigate(`/werkbonnen/${id}`)}
            />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}

interface GroepkaartProps {
  groep: Klusgroep
  open: boolean
  onKlap: () => void
  onOpenBon: (id: string) => void
}

/**
 * Eén kaart: een project met meerdere bonnen, of één losse klus.
 *
 * Een losse klus gaat bij aantikken meteen naar de werkbon — daar staat
 * alles. Een project klapt open, want daar is de vraag eerst "welke
 * adressen zitten hierin" en pas daarna "welke bon moet ik hebben".
 */
function Groepkaart({ groep, open, onKlap, onOpenBon }: GroepkaartProps) {
  const isProject = groep.soort === 'project'
  const voortgang = groep.punten > 0 ? Math.round((groep.puntenKlaar / groep.punten) * 100) : 0
  const k = STANDEN[groep.status]

  // Bij een losse klus is de kop het adres, en daar staat de plaats
  // meestal al in ("Stuyvesantstraat 72 te Den Haag"). Hem eronder
  // herhalen is ruimte kwijt zonder iets te vertellen.
  const plaatsen = groep.plaatsen.filter((p) => !groep.naam.includes(p))

  return (
    <div className={cn(
      // Dezelfde kleurwas als de werkbonkaarten en de planning, met
      // dezelfde schakelaar: KLEURWAS uit betekent overal tegelijk een
      // witte kaart met alleen een gekleurde rand.
      'border border-l-4 rounded-lg shadow-sm overflow-hidden transition-shadow hover:shadow-md',
      KLEURWAS ? k.vlak : 'bg-white dark:bg-surface-dark-2',
      KLEURWAS ? k.omlijsting : 'border-gray-100 dark:border-white/10',
      k.rand,
    )}>
      <button
        onClick={() => (isProject ? onKlap() : onOpenBon(groep.bonnen[0].id))}
        className="w-full text-left p-5 group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isProject && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface-2 dark:bg-white/10 text-gray-500 dark:text-white/50 flex-shrink-0">
                  <IconBuilding className="w-3 h-3" /> Project
                </span>
              )}
              {/* break-words en niet truncate: een adres afkappen op een
                  telefoon maakt twee klussen in dezelfde straat
                  onderscheidloos. */}
              <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug break-words group-hover:text-brand-yellow-dark dark:group-hover:text-brand-yellow transition-colors">
                {groep.naam}
              </h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/60 mt-0.5 break-words">
              {groep.opdrachtgever || (isProject ? `${groep.bonnen.length} klussen` : 'Losse klus')}
            </p>
          </div>
          <span className={cn(
            'inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-lg border flex-shrink-0',
            k.vlak, k.omlijsting, k.tekst,
          )}>
            {k.kort}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-tekst-gedempt dark:text-white/55 mt-3">
          {plaatsen.length > 0 && (
            <span className="flex items-center gap-1 min-w-0">
              <IconMapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="break-words">{plaatsen.join(', ')}</span>
            </span>
          )}
          {groep.van && (
            <span className="flex items-center gap-1">
              <IconCalendar className="w-3.5 h-3.5 flex-shrink-0" />
              {groep.van === groep.tot
                ? formatDatumKort(groep.van)
                : <>{formatDatumKort(groep.van)} &ndash; {formatDatumKort(groep.tot)}</>}
            </span>
          )}
        </div>

        {groep.punten > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-tekst-gedempt dark:text-white/55 mb-1.5">
              <span>{groep.puntenKlaar} van {groep.punten} punten</span>
              <span className="font-semibold text-gray-700 dark:text-white/70">{voortgang}%</span>
            </div>
            <ProgressBar
              value={voortgang}
              // De balk volgt de stand van de kaart. Zonder de
              // violette variant sloeg hij op honderd procent om naar
              // groen, terwijl de kaart "klaar om af te ronden" zegt.
              variant={groep.status === 'afgerond' || groep.status === 'opgeleverd' ? 'green'
                : groep.status === 'stilgelegd' ? 'red'
                : groep.status === 'af_te_ronden' ? 'violet' : 'yellow'}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tekst-gedempt dark:text-white/55 min-w-0">
            <span className="flex items-center gap-1">
              <IconListCheck className="w-3.5 h-3.5 flex-shrink-0" />
              {groep.bonnen.length} {groep.bonnen.length === 1 ? 'bon' : 'bonnen'}
            </span>
            {groep.medewerkers.length > 0 && (
              <span className="flex items-center gap-1 min-w-0">
                <IconUsers className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="break-words">{groep.medewerkers.join(', ')}</span>
              </span>
            )}
          </div>
          {isProject ? (
            <IconChevronDown className={cn('w-4 h-4 flex-shrink-0 text-tekst-fijn dark:text-white/40 transition-transform', open && 'rotate-180')} />
          ) : (
            <IconChevronRight className="w-4 h-4 flex-shrink-0 text-tekst-fijn dark:text-white/40 group-hover:text-brand-yellow transition-colors" />
          )}
        </div>
      </button>

      {isProject && open && (
        <div className="border-t border-gray-100 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/10">
          {groep.bonnen.map((bon) => (
            <button
              key={bon.id}
              onClick={() => onOpenBon(bon.id)}
              className="w-full flex items-center justify-between gap-3 text-left px-5 py-3 min-h-[44px] hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white break-words">{bon.adres}</div>
                <div className="text-xs text-tekst-gedempt dark:text-white/55">
                  {[bon.plaats, bon.bonnummer].filter(Boolean).join(' · ')}
                </div>
              </div>
              <IconChevronRight className="w-4 h-4 flex-shrink-0 text-tekst-fijn dark:text-white/40" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

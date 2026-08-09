import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { WerkbonKaart } from '@/components/werkbon/WerkbonKaart'
import { Weekkiezer } from '@/components/layout/Weekkiezer'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { EmptyState } from '@/components/ui/EmptyState'
import { Synchronisatie } from '@/components/werkbon/Synchronisatie'
import { ErrorState } from '@/components/ui/ErrorState'
import { inWeek, maandagVerschoven, groepeerPerWeek } from '@/lib/planning'
import { zoektMee } from '@/lib/zoeken'
import { Weekkop } from '@/components/layout/Weekkop'
import { cn } from '@/lib/utils'
import { IconPlus, IconSearch, IconClipboardList, IconCalendarWeek, IconList } from '@tabler/icons-react'
import type { WerkbonStatus } from '@/types'

const statusFilters: { label: string; value: WerkbonStatus | 'alle' }[] = [
  { label: 'Alle', value: 'alle' }, { label: 'Open', value: 'open' },
  { label: 'Bezig', value: 'bezig' }, { label: 'Voltooid', value: 'voltooid' },
]

export default function Werkbonnen() {
  const navigate = useNavigate()
  const { werkbonnen, loading, error, refetch } = useWerkbonnen()
  const [statusFilter, setStatusFilter] = useState<WerkbonStatus | 'alle'>('alle')
  const [zoek, setZoek] = useState('')

  // Per week kijken, of alles op een rij.
  //
  // Deze pagina toonde altijd álle bonnen door elkaar. Bij dertig gaat
  // dat nog; bij honderd is "wat staat er volgende week" niet meer te
  // beantwoorden zonder scrollen en rekenen. Twee standen dus: per week
  // om te plannen, en de volledige lijst om te zoeken — want zoeken op
  // een adres van vorige maand moet ook kunnen.
  const [perWeek, setPerWeek] = useState(true)
  const [week, setWeek] = useState(0)
  const maandag = maandagVerschoven(week)

  // Zoeken slaat het weekfilter over. Wie een adres intypt is niet meer
  // met een week bezig maar met één specifieke klus, en die kan overal
  // staan. Hem niet vinden omdat hij twee weken terug ligt is precies
  // wat je niet wil.
  const zoekt = zoek.trim().length > 0
  const inHuidigeWeek = perWeek && !zoekt

  const gefilterd = werkbonnen.filter((w) => {
    const sOk = statusFilter === 'alle' || w.status === statusFilter
    const wOk = !inHuidigeWeek || inWeek(w, maandag)
    return sOk && wOk
  }).filter((w) => zoektMee(w, zoek))

  const inDeWeek = werkbonnen.filter((w) => inWeek(w, maandag)).length

  return (
    <PageWrapper title="Werkbonnen" actions={
      <div className="flex flex-wrap items-center gap-2">
        {/* Kantoor kon tot nu toe alleen wachten op de hartslag, en werk
            buiten "deze week"/"volgende week" kwam helemaal niet binnen. */}
        <Synchronisatie onKlaar={refetch} />
        <Button variant="primary" onClick={() => navigate('/werkbonnen/nieuw')}>
          <IconPlus className="w-4 h-4" /> Nieuwe werkbon
        </Button>
      </div>
    }>
      <div className="space-y-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          {perWeek && (
            <Weekkiezer
              week={week}
              onWissel={setWeek}
              telling={`${inDeWeek} ${inDeWeek === 1 ? 'klus' : 'klussen'}`}
            />
          )}

          <div className="flex gap-1.5 bg-surface-2 dark:bg-white/5 p-1 rounded-sm sm:ml-auto">
            <button
              onClick={() => setPerWeek(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all',
                perWeek
                  ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
              )}
            >
              <IconCalendarWeek className="w-3.5 h-3.5" /> Per week
            </button>
            <button
              onClick={() => setPerWeek(false)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all',
                !perWeek
                  ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
              )}
            >
              <IconList className="w-3.5 h-3.5" /> Alles
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
            <input
              type="text"
              placeholder="Adres, plaats, postcode, bonnummer, opdrachtgever of naam…"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-brand-yellow"
            />
          </div>
          <div className="flex gap-1.5 bg-surface-2 dark:bg-white/5 p-1 rounded-sm">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-semibold transition-all',
                  statusFilter === f.value
                    ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {perWeek && zoekt && (
          <p className="text-xs text-gray-400 dark:text-white/40">
            Zolang je zoekt kijken we door alle weken heen — anders mis je een
            klus omdat hij toevallig vorige maand stond.
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : error ? (
        <ErrorState
          melding="De werkbonnen konden niet worden geladen. Controleer je verbinding."
          onOpnieuw={refetch}
        />
      ) : gefilterd.length === 0 ? (
        <EmptyState
          icon={<IconClipboardList />}
          titel={inHuidigeWeek ? 'Deze week staat er niets' : 'Geen werkbonnen gevonden'}
          uitleg={
            inHuidigeWeek
              ? 'Blader naar een andere week, of zet hierboven "Alles" aan om de hele lijst te zien.'
              : zoekt || statusFilter !== 'alle'
                ? 'Pas je zoekterm of filter aan om meer resultaten te zien.'
                : 'Maak je eerste werkbon aan om te beginnen.'
          }
          actie={
            inHuidigeWeek
              ? <Button variant="secondary" size="sm" onClick={() => setPerWeek(false)}><IconList className="w-4 h-4" /> Alles tonen</Button>
              : !zoekt && statusFilter === 'alle'
                ? <Button variant="primary" size="sm" onClick={() => navigate('/werkbonnen/nieuw')}><IconPlus className="w-4 h-4" /> Nieuwe werkbon</Button>
                : undefined
          }
        />
      ) : inHuidigeWeek ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gefilterd.map((w) => <WerkbonKaart key={w.id} werkbon={w} />)}
        </div>
      ) : (
        /* Volledige lijst: per week gegroepeerd met een kop erboven.
           Zonder die koppen is dit een rij adressen zonder tijd erin —
           je ziet wél dat er werk staat, maar niet wannéér. */
        <div className="space-y-6">
          {groepeerPerWeek(gefilterd).map((blok) => (
            <div key={blok.maandag.toISOString()}>
              <Weekkop maandag={blok.maandag} nummer={blok.nummer} aantal={blok.items.length} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                {blok.items.map(({ bon, begintHier }) => (
                  <WerkbonKaart key={bon.id} werkbon={bon} looptDoor={!begintHier} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}

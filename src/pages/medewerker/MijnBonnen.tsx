import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { berekenVoortgang, formatDatum, cn } from '@/lib/utils'
import { standkleur, KLEURWAS } from '@/lib/klusstand'
import { groepeerPerWeek } from '@/lib/planning'
import { zoektMee } from '@/lib/zoeken'
import { Weekkop } from '@/components/layout/Weekkop'
import type { Werkbon } from '@/types'
import {
  IconClipboardList, IconMapPin, IconListCheck, IconKey,
  IconChevronRight, IconAlertTriangle, IconPhoto, IconSearch,
} from '@tabler/icons-react'

type Filter = 'alles' | 'loopt' | 'afgerond'

const FILTERS: { waarde: Filter; label: string }[] = [
  { waarde: 'alles', label: 'Alles' },
  { waarde: 'loopt', label: 'Loopt nog' },
  { waarde: 'afgerond', label: 'Afgerond' },
]

/**
 * Alles wat op mijn naam staat, ook het werk van weken terug.
 *
 * "Afgerond" toonde alleen voltooide bonnen, en Vandaag alleen die van
 * nu. Daartussen zat een gat: de bon van gisteren die nog niet af is,
 * of die van volgende week. Die waren nergens te vinden.
 *
 * Zoeken op adres zit erbij omdat dat de manier is waarop iemand een
 * klus onthoudt — niet op bonnummer of datum, maar op de straat.
 */
export default function MijnBonnen() {
  const { werkbonnen, loading } = useWerkbonnen()
  const [filter, setFilter] = useState<Filter>('alles')
  const [zoek, setZoek] = useState('')
  const navigate = useNavigate()

  const term = zoek.trim()
  const gefilterd = werkbonnen.filter((w) => {
    const afgerond = w.status === 'voltooid' || Boolean(w.opgeleverd_op)
    if (filter === 'loopt' && afgerond) return false
    if (filter === 'afgerond' && !afgerond) return false
    return zoektMee(w, zoek)
  })

  return (
    <PageWrapper title="Mijn bonnen">
      <div className="max-w-4xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op adres, plaats of bonnummer"
              className="w-full min-h-[44px] pl-9 pr-3 rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow transition-all"
            />
          </div>

          {/* Knoppen en geen keuzelijst: drie opties passen naast elkaar
              en zijn dan één tik in plaats van twee. */}
          <div className="flex gap-1 p-1 rounded-sm bg-surface-2 dark:bg-white/5">
            {FILTERS.map((f) => (
              <button
                key={f.waarde}
                onClick={() => setFilter(f.waarde)}
                className={cn(
                  'flex-1 sm:flex-none min-h-[36px] px-4 rounded-sm text-sm font-semibold transition-colors',
                  filter === f.waarde
                    ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
        ) : gefilterd.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconClipboardList />}
              titel={term ? 'Niets gevonden' : 'Nog geen werkbonnen'}
              uitleg={term
                ? `Geen bon met "${zoek}" erin. Probeer een deel van de straatnaam.`
                : 'Zodra je op een klus wordt ingepland verschijnt hij hier.'}
            />
          </Card>
        ) : (
          /* Per week gegroepeerd, nieuwste bovenaan. Een lijst van
             twintig adressen onder elkaar zegt niets over wanneer je
             ergens moet zijn; met de weekkop erboven wel. */
          <div className="space-y-5">
            {groepeerPerWeek(gefilterd).map((blok) => (
              <div key={blok.maandag.toISOString()}>
                <Weekkop maandag={blok.maandag} nummer={blok.nummer} aantal={blok.items.length} />
                <div className="space-y-3 mt-3">
                  {blok.items.map(({ bon, begintHier }) => (
                    <BonRegel key={bon.id} werkbon={bon} looptDoor={!begintHier}
                              onOpen={() => navigate(`/werkbon/${bon.id}`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

function BonRegel({ werkbon, onOpen, looptDoor }: { werkbon: Werkbon; onOpen: () => void; looptDoor?: boolean }) {
  const taken = werkbon.taken ?? []
  const voortgang = berekenVoortgang(taken)
  const fotos = taken.flatMap((t) => t.fotos ?? []).length
  const stil = Boolean(werkbon.stilgelegd_op)
  // Dezelfde stand en dezelfde kleuren als op de planning en de
  // werkbonkaart. Stond hier op geel voor alles wat niet af of stil
  // was — dus ook voor een bon waar nog geen vinger naar was omgekeken.
  const k = standkleur(werkbon)

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full text-left rounded-lg border border-l-4 p-4 sm:p-5 shadow-sm',
        'hover:border-brand-yellow transition-colors duration-150 ease-brand',
        KLEURWAS ? k.vlak : 'bg-white dark:bg-surface-dark-2',
        KLEURWAS ? k.omlijsting : 'border-gray-100 dark:border-white/10',
        k.rand
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5">
            <IconMapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400 dark:text-white/40" />
            <span className="font-bold leading-snug text-gray-900 dark:text-white">
              {werkbon.adres}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 ml-5.5 text-xs text-gray-400 dark:text-white/40">
            {looptDoor && (
              <span className="font-semibold text-gray-500 dark:text-white/50">loopt door</span>
            )}
            {werkbon.bonnummer && <span>Bon {werkbon.bonnummer}</span>}
            <span>start {formatDatum(werkbon.geplande_start ?? werkbon.datum)}</span>
            {werkbon.kluiscode && (
              <span className="flex items-center gap-1 font-semibold text-gray-500 dark:text-white/50">
                <IconKey className="w-3.5 h-3.5" />{werkbon.kluiscode}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={k.badge}>{k.label}</Badge>
          <IconChevronRight className="w-4 h-4 text-gray-300 dark:text-white/25" />
        </div>
      </div>

      {stil && (
        <div className="flex items-start gap-1.5 mt-3 text-xs text-orange-700 dark:text-orange-300">
          <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-snug">{werkbon.stilleg_reden}</span>
        </div>
      )}

      <div className="mt-3">
        <ProgressBar value={voortgang} size="sm" variant={voortgang === 100 ? 'green' : 'yellow'} />
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-white/40">
          <span className="flex items-center gap-1">
            <IconListCheck className="w-3.5 h-3.5" />
            {taken.filter((t) => t.voltooid).length}/{taken.length} punten
          </span>
          <span className="flex items-center gap-1">
            <IconPhoto className="w-3.5 h-3.5" />{fotos} foto's
          </span>
        </div>
      </div>
    </button>
  )
}

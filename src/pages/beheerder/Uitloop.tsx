import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { useUitloop, type UitloopBon } from '@/hooks/useUitloop'
import { formatDatum, cn } from '@/lib/utils'
import {
  IconMapPin, IconAlertTriangle, IconChevronRight, IconCircleCheck,
  IconPlayerPause, IconClockExclamation, IconHistory, IconUsers,
} from '@tabler/icons-react'

/**
 * Uitloop — wat loopt er achter, en waarom.
 *
 * Dit was een blinde vlek. De app wist alles wat nodig is om de vraag
 * te beantwoorden — geplande einddatum, stilleggingen met reden, hoeveel
 * punten er af zijn — maar er was geen scherm dat hem stelde. Uitloop
 * bleek daardoor pas als iemand belde.
 *
 * Drie blokken, in de volgorde waarin je erop handelt: wat staat er
 * over de tijd heen, wat ligt bewust stil, en wat is het patroon
 * daarachter.
 */
export default function Uitloop() {
  const { bonnen, stilgelegd, historie, loading, error, herlaad } = useUitloop()
  const navigate = useNavigate()

  const ergste = bonnen.length > 0 ? bonnen[0].dagen : 0

  if (loading) {
    return (
      <PageWrapper title="Uitloop">
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper title="Uitloop">
        <Card>
          <ErrorState
            melding="De uitloop kon niet berekend worden. Controleer je verbinding."
            onOpnieuw={herlaad}
          />
        </Card>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Uitloop">
      <div className="max-w-5xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Loopt uit"
            value={bonnen.length}
            icon={<IconClockExclamation />}
            variant={bonnen.length > 0 ? 'red' : 'neutral'}
          />
          <KpiCard
            label="Ligt stil"
            value={stilgelegd.length}
            icon={<IconPlayerPause />}
            variant={stilgelegd.length > 0 ? 'yellow' : 'neutral'}
          />
          <KpiCard
            label="Langste uitloop"
            value={ergste > 0 ? `${ergste} ${ergste === 1 ? 'dag' : 'dagen'}` : '—'}
            icon={<IconAlertTriangle />}
            variant={ergste >= 5 ? 'red' : 'neutral'}
          />
        </div>

        <Card>
          <SectionHeading title={`Over de planning heen (${bonnen.length})`} />
          {bonnen.length === 0 ? (
            <EmptyState
              icon={<IconCircleCheck />}
              titel="Alles binnen de planning"
              uitleg="Geen enkele lopende klus staat over zijn einddatum heen. Dat is de bedoeling, en het blijft hier zichtbaar zodra dat verandert."
            />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {bonnen.map((b) => (
                <Regel key={b.id} bon={b} onOpen={() => navigate(`/werkbonnen/${b.id}`)} />
              ))}
            </div>
          )}
        </Card>

        {stilgelegd.length > 0 && (
          <Card>
            <SectionHeading title={`Ligt stil (${stilgelegd.length})`} />
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {stilgelegd.map((b) => (
                <Regel key={b.id} bon={b} onOpen={() => navigate(`/werkbonnen/${b.id}`)} stil />
              ))}
            </div>
          </Card>
        )}

        {historie.length > 0 && (
          <Card>
            <SectionHeading
              title="Waarom er is stilgelegd"
              actions={<IconHistory className="w-4 h-4 text-gray-400 dark:text-white/40" />}
            />
            <p className="text-xs text-gray-400 dark:text-white/40 -mt-2 mb-3">
              De laatste {historie.length}. Eén keer asbest is pech; vier keer in een
              maand zegt iets over de voorbereiding.
            </p>
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {historie.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/werkbonnen/${h.werkbon_id}`)}
                  className="flex items-start gap-3 w-full py-3 text-left hover:bg-brand-yellow-light/30 dark:hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <IconPlayerPause className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 dark:text-white/70 leading-snug">
                      {h.reden ?? 'Geen reden vastgelegd'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5 truncate">
                      {h.adres ?? 'onbekend adres'} · {formatDatum(h.created_at)}
                    </div>
                  </div>
                  <IconChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-300 dark:text-white/25" />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}

function Regel({ bon, onOpen, stil }: { bon: UitloopBon; onOpen: () => void; stil?: boolean }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-start gap-3 w-full py-3 text-left hover:bg-brand-yellow-light/30 dark:hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
    >
      <IconMapPin className="w-4 h-4 flex-shrink-0 mt-1 text-gray-400 dark:text-white/40" />

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
          {bon.adres}
        </div>
        <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
          {[bon.plaats, `gepland tot ${formatDatum(bon.geplande_eind ?? bon.datum)}`]
            .filter(Boolean).join(' · ')}
        </div>

        {stil && bon.stilleg_reden && (
          <div className="flex items-start gap-1.5 mt-1.5 text-xs text-amber-700 dark:text-amber-300">
            <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{bon.stilleg_reden}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {!stil && (
            <Badge variant={bon.dagen >= 5 ? 'red' : 'orange'}>
              {bon.dagen} {bon.dagen === 1 ? 'dag' : 'dagen'} over
            </Badge>
          )}
          <span className={cn(
            'text-xs',
            bon.puntenKlaar === bon.punten && bon.punten > 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-400 dark:text-white/40'
          )}>
            {bon.puntenKlaar}/{bon.punten} punten
          </span>
          {bon.medewerkers.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/40 min-w-0">
              <IconUsers className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{bon.medewerkers.map((m) => m.naam).join(', ')}</span>
            </span>
          )}
        </div>
      </div>

      <IconChevronRight className="w-4 h-4 flex-shrink-0 mt-1 text-gray-300 dark:text-white/25" />
    </button>
  )
}

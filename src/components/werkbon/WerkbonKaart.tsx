import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { berekenVoortgang, formatDatumKort } from '@/lib/utils'
import type { Werkbon } from '@/types'
import {
  IconCalendar, IconUsers, IconListCheck, IconPhoto,
  IconKey, IconAlertTriangle, IconFileText, IconMap2,
} from '@tabler/icons-react'

interface WerkbonKaartProps {
  werkbon: Werkbon
  linkPrefix?: string
}

/**
 * De kaart waarop je een werkbon herkent in een lijst.
 *
 * Hij toonde datum, ploeg en voortgang. Sinds de klussen uit ClickUp
 * komen is er meer dat je in één oogopslag wilt zien: of de klus
 * stilligt en waarom, of de kluiscode bekend is, en of de tekening
 * erbij zit. Dat laatste is bij ons geen detail — ontbreekt hij, dan
 * is dat iets voor de werkvoorbereider en niet iets wat een
 * zwamsaneerder om half acht moet ontdekken.
 */
export function WerkbonKaart({ werkbon, linkPrefix = '/werkbonnen' }: WerkbonKaartProps) {
  const navigate = useNavigate()
  const taken = werkbon.taken || []
  const voortgang = berekenVoortgang(taken)
  const voltooide = taken.filter((t) => t.voltooid).length
  const fotos = taken.flatMap((t) => t.fotos ?? []).length
  const stil = Boolean(werkbon.stilgelegd_op)

  return (
    <Card
      accent={stil ? 'red' : werkbon.opgeleverd_op ? 'green' : 'yellow'}
      onClick={() => navigate(`${linkPrefix}/${werkbon.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
            {werkbon.adres}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-500 dark:text-white/60 mt-0.5">
            <span>{werkbon.projectnaam}</span>
            {werkbon.bonnummer && (
              <span className="text-gray-400 dark:text-white/40">· Bon {werkbon.bonnummer}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {werkbon.opgeleverd_op
            ? <Badge variant="green">Opgeleverd</Badge>
            : <StatusBadge status={werkbon.status} />}
          {stil && <Badge variant="red">Ligt stil</Badge>}
        </div>
      </div>

      {stil && werkbon.stilleg_reden && (
        <div className="flex items-start gap-1.5 mb-3 text-xs text-orange-700 dark:text-orange-300">
          <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-snug">{werkbon.stilleg_reden}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-white/40 mb-3">
        <span className="flex items-center gap-1">
          <IconCalendar className="w-3.5 h-3.5" />
          {formatDatumKort(werkbon.geplande_start ?? werkbon.datum)}
          {werkbon.geplande_eind && ` – ${formatDatumKort(werkbon.geplande_eind)}`}
        </span>

        {(werkbon.medewerkers || []).length > 0 && (
          <span className="flex items-center gap-1">
            <IconUsers className="w-3.5 h-3.5" />
            {werkbon.medewerkers!.map((m) => m.naam).join(', ')}
          </span>
        )}

        <span className="flex items-center gap-1">
          <IconListCheck className="w-3.5 h-3.5" />{voltooide}/{taken.length} punten
        </span>

        {fotos > 0 && (
          <span className="flex items-center gap-1"><IconPhoto className="w-3.5 h-3.5" />{fotos}</span>
        )}

        {werkbon.kluiscode && (
          <span className="flex items-center gap-1 font-semibold text-gray-500 dark:text-white/50">
            <IconKey className="w-3.5 h-3.5" />{werkbon.kluiscode}
          </span>
        )}

        {/* Alleen tonen wat er ís. Een ontbrekende tekening als rood
            kruis neerzetten zou onrust geven bij de vele klussen waar
            er terecht geen is. */}
        {werkbon.opdracht_pad && (
          <span className="flex items-center gap-1"><IconFileText className="w-3.5 h-3.5" />opdracht</span>
        )}
        {werkbon.tekening_pad && (
          <span className="flex items-center gap-1"><IconMap2 className="w-3.5 h-3.5" />tekening</span>
        )}
      </div>

      <ProgressBar value={voortgang} variant={voortgang === 100 ? 'green' : 'yellow'} />
      <div className="text-[11px] text-gray-400 dark:text-white/40 font-semibold mt-1">
        {voortgang}% voltooid
      </div>
    </Card>
  )
}

import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { berekenVoortgang, formatDatumKort, cn } from '@/lib/utils'
import { standkleur, KLEURWAS } from '@/lib/klusstand'
import { weeknummer } from '@/lib/planning'
import type { Werkbon } from '@/types'
import {
  IconCalendar, IconUsers, IconListCheck, IconPhoto,
  IconKey, IconAlertTriangle, IconFileText, IconMap2,
} from '@tabler/icons-react'

/** "wk 33" of "wk 32–34" als de klus over meerdere weken loopt. */
function weekBereik(w: Werkbon): string {
  const start = weeknummer(new Date(w.geplande_start ?? w.datum))
  const eind = weeknummer(new Date(w.geplande_eind ?? w.geplande_start ?? w.datum))
  return start === eind ? `wk ${start}` : `wk ${start}–${eind}`
}

interface WerkbonKaartProps {
  werkbon: Werkbon
  linkPrefix?: string
  /** Deze klus begon in een eerdere week en loopt hier alleen door. */
  looptDoor?: boolean
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
export function WerkbonKaart({ werkbon, linkPrefix = '/werkbonnen', looptDoor }: WerkbonKaartProps) {
  const navigate = useNavigate()
  const taken = werkbon.taken || []
  const voortgang = berekenVoortgang(taken)
  const voltooide = taken.filter((t) => t.voltooid).length
  const fotos = taken.flatMap((t) => t.fotos ?? []).length
  const stil = Boolean(werkbon.stilgelegd_op)

  // De rand was geel voor open, bezig én afgerond — dus voor bijna elke
  // bon — en zei daarmee niets. Nu draagt hij de stand van de klus, in
  // dezelfde kleuren als de weekplanning.
  const k = standkleur(werkbon)

  return (
    <Card
      vlak={KLEURWAS ? cn(k.vlak, k.omlijsting) : undefined}
      className={cn('border-l-4', k.rand)}
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
          <Badge variant={k.badge}>{k.label}</Badge>
        </div>
      </div>

      {stil && werkbon.stilleg_reden && (
        <div className="flex items-start gap-1.5 mb-3 text-xs text-orange-700 dark:text-orange-300">
          <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-snug">{werkbon.stilleg_reden}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-white/40 mb-3">
        {/* Het weeknummer erbij. In een lijst met dertig bonnen zeggen
            twee losse datums weinig; "wk 33" is waar in gepland wordt en
            wat er in ClickUp staat. Loopt een klus over meer weken, dan
            staat de reeks er — dat is precies het geval waarin je je
            anders vergist. */}
        <span className="flex items-center gap-1">
          <IconCalendar className="w-3.5 h-3.5" />
          <span className="font-semibold text-gray-500 dark:text-white/50">{weekBereik(werkbon)}</span>
          {looptDoor && <span className="font-semibold text-gray-500 dark:text-white/50">loopt door</span>}
          <span>
            {formatDatumKort(werkbon.geplande_start ?? werkbon.datum)}
            {werkbon.geplande_eind && ` – ${formatDatumKort(werkbon.geplande_eind)}`}
          </span>
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

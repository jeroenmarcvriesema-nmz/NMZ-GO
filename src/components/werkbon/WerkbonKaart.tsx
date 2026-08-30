import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { berekenVoortgang, formatDatumKort, cn } from '@/lib/utils'
import { standkleur, looptUit, isAsbest, KLEURWAS, UITLOOP, ASBEST } from '@/lib/klusstand'
import { weeknummer } from '@/lib/planning'
import { vervolgLabel } from '@/lib/vervolgwerk'
import type { Werkbon } from '@/types'
import {
  IconCalendar, IconUsers, IconListCheck, IconPhoto,
  IconKey, IconAlertTriangle, IconFileText, IconMap2, IconSpray,
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

  // Over de opleverdatum heen. Dat stond alleen op de Uitloop-pagina van
  // kantoor, terwijl het hier — in de lijst waar iedereen elke dag in
  // kijkt — net zo goed te zien hoort te zijn. De rand draagt het; de
  // badge houdt de stand, want "Bezig" blijft waar.
  const laat = looptUit(werkbon)

  // Asbest gaat voor: dat is de zwaarste reden en de enige met een
  // eigen procedure. Een asbestklus die ook te laat is blijft in de
  // eerste plaats een asbestklus.
  const asbest = isAsbest(werkbon.stilleg_reden)
  const accent = asbest ? ASBEST : laat ? UITLOOP : null

  return (
    <Card
      vlak={KLEURWAS ? cn(k.vlak, k.omlijsting) : undefined}
      className={cn('border-l-[6px]', accent ? accent.rand : k.rand)}
      onClick={() => navigate(`${linkPrefix}/${werkbon.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-base font-bold tracking-tight text-gray-900 dark:text-white break-words">
            {werkbon.adres}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-500 dark:text-white/60 mt-0.5">
            <span>{werkbon.projectnaam}</span>
            {werkbon.bonnummer && (
              <span className="text-tekst-gedempt dark:text-white/55">· Bon {werkbon.bonnummer}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant={asbest ? ASBEST.badge : k.badge}>
            {asbest ? 'Asbest' : k.label}
          </Badge>
          {laat && <Badge variant={UITLOOP.badge}>Loopt uit</Badge>}
        </div>
      </div>

      {stil && werkbon.stilleg_reden && (
        <div className="flex items-start gap-1.5 mb-3 min-w-0 text-xs text-orange-700 dark:text-orange-300">
          <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="min-w-0 leading-snug break-words">{werkbon.stilleg_reden}</span>
        </div>
      )}

      {/* Vervolgwerk in het blauw en niet in het oranje: deze klus ligt
          niet stil, er ligt alleen nog werk van een ander soort. Hij
          hield hiervoor de badge "Ligt stil" en een rood kaartje —
          precies wat er niet klopte. Nu draagt hij zijn echte stand en
          staat hier wát er nog moet gebeuren. */}
      {werkbon.vervolg_soort && (
        <div className="flex items-start gap-1.5 mb-3 text-xs text-blue-700 dark:text-blue-300">
          <IconSpray className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-snug">
            <span className="font-semibold">{vervolgLabel(werkbon.vervolg_soort)}</span>
            {werkbon.vervolg_reden ? ` — ${werkbon.vervolg_reden}` : ''}
          </span>
        </div>
      )}

      {/* Elk brokje krijgt `min-w-0` en elk pictogram `flex-shrink-0`.
          Zonder dat eerste krimpt een flex-item niet onder zijn inhoud
          (`min-width` staat standaard op `auto`), en dan steekt de regel
          buiten de kaart in plaats van af te breken. Dat gebeurde hier:
          de datumregel — weeknummer, "loopt door" en twee datums achter
          elkaar — paste op een telefoon niet meer en liep het kader uit.
          Bij de ploeg gold hetzelfde zodra er drie namen op een klus
          stonden. De andere kaarten in de app deden dit al goed; deze
          was blijven staan. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-tekst-gedempt dark:text-white/55 mb-3">
        {/* Het weeknummer erbij. In een lijst met dertig bonnen zeggen
            twee losse datums weinig; "wk 33" is waar in gepland wordt en
            wat er in ClickUp staat. Loopt een klus over meer weken, dan
            staat de reeks er — dat is precies het geval waarin je je
            anders vergist.

            Mag zelf ook afbreken: op een smal scherm is dit het langste
            brokje van de rij, en dan hoort de datum onder het weeknummer
            te komen in plaats van naast de kaartrand. */}
        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
          <IconCalendar className="w-3.5 h-3.5 flex-shrink-0" />
          {/* "wk 33–34" hoort bij elkaar. Zonder dit brak hij op het
              streepje af en stond er "wk / 33– / 34" onder elkaar. */}
          <span className="whitespace-nowrap font-semibold text-gray-500 dark:text-white/50">
            {weekBereik(werkbon)}
          </span>
          {looptDoor && <span className="font-semibold text-gray-500 dark:text-white/50">loopt door</span>}
          <span className="whitespace-nowrap">
            {formatDatumKort(werkbon.geplande_start ?? werkbon.datum)}
            {werkbon.geplande_eind && ` – ${formatDatumKort(werkbon.geplande_eind)}`}
          </span>
        </span>

        {(werkbon.medewerkers || []).length > 0 && (
          <span className="flex items-start gap-1 min-w-0">
            <IconUsers className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="min-w-0 leading-snug break-words">
              {werkbon.medewerkers!.map((m) => m.naam).join(', ')}
            </span>
          </span>
        )}

        <span className="flex items-center gap-1 min-w-0">
          <IconListCheck className="w-3.5 h-3.5 flex-shrink-0" />{voltooide}/{taken.length} punten
        </span>

        {fotos > 0 && (
          <span className="flex items-center gap-1 min-w-0">
            <IconPhoto className="w-3.5 h-3.5 flex-shrink-0" />{fotos}
          </span>
        )}

        {werkbon.kluiscode && (
          <span className="flex items-center gap-1 min-w-0 font-semibold text-gray-500 dark:text-white/50">
            <IconKey className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="break-all">{werkbon.kluiscode}</span>
          </span>
        )}

        {/* Alleen tonen wat er ís. Een ontbrekende tekening als rood
            kruis neerzetten zou onrust geven bij de vele klussen waar
            er terecht geen is. */}
        {werkbon.opdracht_pad && (
          <span className="flex items-center gap-1 min-w-0">
            <IconFileText className="w-3.5 h-3.5 flex-shrink-0" />opdracht
          </span>
        )}
        {werkbon.tekening_pad && (
          <span className="flex items-center gap-1 min-w-0">
            <IconMap2 className="w-3.5 h-3.5 flex-shrink-0" />tekening
          </span>
        )}
      </div>

      {/* De balk draagt de stand, net als de badge erboven. Hier stond
          geel, en groen zodra alles was afgevinkt — dus een bon die nog
          afgerond moest worden kreeg een violette badge met een groene
          balk eronder. */}
      <ProgressBar value={voortgang} variant={k.badge} />
      <div className="text-[11px] text-tekst-gedempt dark:text-white/55 font-semibold mt-1">
        {voortgang}% voltooid
      </div>
    </Card>
  )
}

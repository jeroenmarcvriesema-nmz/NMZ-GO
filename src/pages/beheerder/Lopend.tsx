import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, formatDatumKort } from '@/lib/utils'
import { formatTijd, geefUren } from '@/hooks/useWerkdag'
import { useLopend, type LopendeKlus } from '@/hooks/useLopend'
import { Klusactiviteit } from '@/components/werkbon/Klusactiviteit'
import {
  STANDEN, STANDVOLGORDE, UITLOOP, ASBEST, looptUit, isAsbest,
} from '@/lib/klusstand'
import { vervolgLabel } from '@/lib/vervolgwerk'
import {
  IconUsers, IconKey, IconPhoto, IconListCheck, IconCheck, IconCamera,
  IconClockExclamation, IconBiohazard, IconChevronRight, IconRefresh,
  IconExternalLink, IconPlayerPause, IconSpray,
} from '@tabler/icons-react'

/**
 * Alles wat vandaag loopt, op één scherm, uitgeklapt.
 *
 * Het dashboard zegt hoevéél er loopt en de werkbonnenlijst zegt wélke
 * klussen er zijn. Voor "wat gebeurt er nu op de vloer" moest je elke
 * bon los openslaan: bij acht lopende klussen is dat acht keer klikken
 * en terug, en dan ben je de eerste alweer kwijt.
 *
 * Hier staat het onder elkaar: per klus de ploeg, de werktijden van
 * vandaag, en de punten met hun titel — welke af zijn, welke nog een
 * foto missen. Doorklikken naar de bon kan nog steeds, maar hoeft niet
 * meer om de vraag te beantwoorden.
 *
 * De punten staan standaard ingeklapt. Acht klussen van twintig punten
 * is honderdzestig regels, en dan is "overzicht" precies wat je kwijt
 * bent. De kop van elke klus draagt het antwoord; de punten zijn het
 * naslagwerk eronder.
 */
export default function Lopend() {
  const { klussen, loading, error, refetch } = useLopend()
  const navigate = useNavigate()
  const [open, setOpen] = useState<Set<string>>(new Set())

  const klap = (id: string) =>
    setOpen((h) => {
      const n = new Set(h)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // Dezelfde volgorde als overal: wat aandacht vraagt bovenaan, en
  // binnen dezelfde stand het adres zodat de lijst niet verspringt.
  const gesorteerd = [...klussen].sort((a, b) => {
    const verschil = STANDVOLGORDE[a.stand] - STANDVOLGORDE[b.stand]
    return verschil !== 0 ? verschil : a.adres.localeCompare(b.adres)
  })

  const bezig = gesorteerd.filter((k) => k.looptNu).length

  if (loading) {
    return (
      <PageWrapper title="Lopende klussen">
        <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title="Lopende klussen"
      actions={
        <Button variant="ghost" size="sm" onClick={refetch}>
          <IconRefresh className="w-4 h-4" /> Verversen
        </Button>
      }
    >
      {error && (
        <Card className="mb-4">
          <p className="text-sm text-brand-red dark:text-red-400">
            De lijst kon niet worden opgehaald: {error}
          </p>
        </Card>
      )}

      <p className="text-sm text-gray-500 dark:text-white/50 mb-5">
        {gesorteerd.length} {gesorteerd.length === 1 ? 'klus loopt' : 'klussen lopen'} vandaag
        {bezig > 0 && <> · <span className="font-semibold text-green-700 dark:text-green-400">
          op {bezig} {bezig === 1 ? 'klus' : 'klussen'} staat nu iemand
        </span></>}
      </p>

      {gesorteerd.length === 0 ? (
        <EmptyState
          icon={<IconListCheck />}
          titel="Er loopt vandaag niets"
          uitleg="Zodra een klus vandaag gepland staat en nog niet is opgeleverd, verschijnt hij hier."
        />
      ) : (
        <div className="space-y-3">
          {gesorteerd.map((k) => (
            <Klusblok
              key={k.id}
              klus={k}
              open={open.has(k.id)}
              onKlap={() => klap(k.id)}
              onOpen={() => navigate(`/werkbonnen/${k.id}`)}
            />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}

function Klusblok({ klus, open, onKlap, onOpen }: {
  klus: LopendeKlus
  open: boolean
  onKlap: () => void
  onOpen: () => void
}) {
  const k = STANDEN[klus.stand]
  const asbest = isAsbest(klus.stillegReden)
  const laat = looptUit({
    status: klus.stand === 'afgerond' ? 'voltooid' : 'open',
    stilgelegd_op: klus.stand === 'stilgelegd' ? 'ja' : null,
    geplande_eind: klus.eind,
  })
  const accent = asbest ? ASBEST : laat ? UITLOOP : null

  const klaar = klus.punten.filter((p) => p.voltooid).length
  const zonderFoto = klus.punten.filter((p) => p.fotoVereist && p.aantalFotos === 0).length
  const voortgang = klus.punten.length > 0 ? Math.round((klaar / klus.punten.length) * 100) : 0

  return (
    <Card
      vlak={cn(asbest ? ASBEST.vlak : k.vlak, asbest ? ASBEST.omlijsting : k.omlijsting)}
      className={cn('border-l-4', accent ? accent.rand : k.rand)}
    >
      {/* ── Kop: het antwoord, zonder uitklappen ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-bold text-gray-900 dark:text-white break-words">
              {klus.adres}
            </span>
            {klus.bonnummer && (
              <span className="text-xs text-tekst-gedempt dark:text-white/55">Bon {klus.bonnummer}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
            <Badge variant={asbest ? ASBEST.badge : k.badge}>
              {asbest ? 'Asbest' : k.label}
            </Badge>
            {laat && (
              <span className={cn('flex items-center gap-1 text-[11px] font-bold', UITLOOP.tekst)}>
                <IconClockExclamation className="w-3 h-3 flex-shrink-0" /> loopt uit
              </span>
            )}
            {asbest && (
              <span className={cn('flex items-center gap-1 text-[11px] font-bold', ASBEST.tekst)}>
                <IconBiohazard className="w-3 h-3 flex-shrink-0" /> asbest
              </span>
            )}
            <span className="text-[11px] text-tekst-gedempt dark:text-white/55">
              {formatDatumKort(klus.start)}
              {klus.eind !== klus.start && ` – ${formatDatumKort(klus.eind)}`}
            </span>
          </div>
        </div>

        <button
          onClick={onOpen}
          aria-label="Werkbon openen"
          className="flex-shrink-0 min-h-[44px] px-2 text-tekst-gedempt dark:text-white/55 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <IconExternalLink className="w-4 h-4" />
        </button>
      </div>

      {klus.stillegReden && (
        <div className={cn(
          'flex items-start gap-1.5 mt-2 text-xs',
          asbest ? ASBEST.tekst : 'text-brand-red dark:text-red-400',
        )}>
          <IconPlayerPause className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="break-words">{klus.stillegReden}</span>
        </div>
      )}

      {/* Vervolgwerk. Blauw en niet rood: deze klus loopt door, er ligt
          alleen nog werk van een ander soort. Hij stond hier eerder als
          stilgelegd tussen — met een rood pauzeteken erbij. */}
      {klus.vervolgSoort && (
        <div className="flex items-start gap-1.5 mt-2 text-xs text-blue-700 dark:text-blue-300">
          <IconSpray className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="break-words">
            <span className="font-semibold">{vervolgLabel(klus.vervolgSoort)}</span>
            {klus.vervolgReden ? ` — ${klus.vervolgReden}` : ''}
          </span>
        </div>
      )}

      {/* ── De feiten van vandaag ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500 dark:text-white/50">
        {klus.ploeg.length > 0 && (
          <span className="flex items-start gap-1 min-w-0">
            <IconUsers className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-words">{klus.ploeg.join(', ')}</span>
          </span>
        )}
        {klus.kluiscode && (
          <span className="flex items-center gap-1 font-semibold">
            <IconKey className="w-3.5 h-3.5 flex-shrink-0" />{klus.kluiscode}
          </span>
        )}
        <span className="flex items-center gap-1 tabular-nums">
          <IconListCheck className="w-3.5 h-3.5 flex-shrink-0" />{klaar}/{klus.punten.length}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <IconPhoto className="w-3.5 h-3.5 flex-shrink-0" />{klus.aantalFotos}
        </span>
        {/* Het getal dat zegt of deze bon vanavond dicht kan. Punten met
            fotoplicht zonder foto houden het afronden tegen, en dat wil
            je nú weten en niet als de ploeg al thuis is. */}
        {zonderFoto > 0 && (
          <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
            <IconCamera className="w-3.5 h-3.5 flex-shrink-0" />
            {zonderFoto} zonder foto
          </span>
        )}
      </div>

      {/* ── De werkdag ── */}
      {klus.werkdagen.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
          {klus.werkdagen.map((d, n) => (
            <span key={n} className="flex items-center gap-1.5 tabular-nums">
              {d.stop
                ? <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/25 flex-shrink-0" />
                : <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />}
              <span className="font-semibold text-gray-700 dark:text-white/70">{d.naam}</span>
              <span className="text-gray-500 dark:text-white/50">
                {formatTijd(new Date(d.start))}–{d.stop ? formatTijd(new Date(d.stop)) : 'nu'}
                {' · '}{geefUren(new Date(d.start), d.stop ? new Date(d.stop) : null)} u
              </span>
            </span>
          ))}
        </div>
      )}

      <div className={cn('mt-3 h-1.5 rounded-full overflow-hidden', k.balkbed)}>
        <div
          className={cn('h-full rounded-full transition-all duration-300', k.bol)}
          style={{ width: `${voortgang}%` }}
        />
      </div>

      {/* ── De punten, ingeklapt ── */}
      {klus.punten.length > 0 && (
        <>
          <button
            onClick={onKlap}
            className="flex items-center gap-1.5 mt-3 min-h-[44px] text-xs font-semibold text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <IconChevronRight className={cn('w-4 h-4 transition-transform', open && 'rotate-90')} />
            {open ? 'Verbergen' : `Activiteit en ${klus.punten.length} punten`}
          </button>

          {open && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 mt-2">
              <div className="min-w-0">
                {/* Het verloop, niet de toestand. De bon zelf laat zien
                    wélke punten af zijn; hier staat wannéér, in welke
                    volgorde, en of er halverwege iets is gewijzigd. */}
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-tekst-gedempt dark:text-white/55 mb-1.5">
                  Activiteit
                </h4>
                <Klusactiviteit werkbonId={klus.id} />
              </div>

              <div className="min-w-0">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-tekst-gedempt dark:text-white/55 mb-1.5">
                  Punten
                </h4>
                <ul className="space-y-1">
                  {klus.punten.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 text-xs min-w-0">
                      {p.voltooid
                        ? <IconCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                        : <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 rounded-sm border border-gray-300 dark:border-white/20" />}
                      <span className={cn(
                        'break-words min-w-0 flex-1',
                        p.voltooid
                          ? 'text-tekst-gedempt dark:text-white/55 line-through'
                          : 'text-gray-700 dark:text-white/70',
                      )}>
                        {p.titel}
                      </span>
                      {p.aantalFotos > 0 ? (
                        <span className="flex items-center gap-0.5 flex-shrink-0 text-tekst-gedempt dark:text-white/55 tabular-nums">
                          <IconPhoto className="w-3 h-3" />{p.aantalFotos}
                        </span>
                      ) : p.fotoVereist ? (
                        <span
                          className="flex items-center gap-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
                          title="Dit punt heeft fotoplicht en nog geen foto"
                        >
                          <IconCamera className="w-3 h-3" />
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

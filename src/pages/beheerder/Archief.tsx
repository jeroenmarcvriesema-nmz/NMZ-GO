import { useEffect, useState } from 'react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useArchief, type ArchiefBon, type ArchiefFoto } from '@/hooks/useArchief'
import { useFotos } from '@/hooks/useFotos'
import { formatDatum, cn } from '@/lib/utils'
import { standkleur } from '@/lib/klusstand'
import {
  IconSearch, IconMapPin, IconPhoto, IconCircleCheck, IconCircle,
  IconChevronDown, IconArchive, IconUsers, IconX,
} from '@tabler/icons-react'

/**
 * Archief — terugzoeken wat we op een adres gedaan hebben.
 *
 * Dit scherm bestond niet en werd expliciet gevraagd. De vraag komt
 * altijd van buiten: een bewoner belt, een verzekeraar vraagt, een
 * makelaar wil weten wat er onder die vloer is gebeurd. Het antwoord
 * stond verspreid over ClickUp-bijlagen en de telefoon van degene die
 * er toevallig was.
 *
 * Wat je hier krijgt is precies wat je dan nodig hebt: het adres, wat
 * er is afgevinkt, wie er stond, en de foto's die daarbij gemaakt zijn.
 */
export default function Archief() {
  const { resultaten, loading, gezocht, error, zoek } = useArchief()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  // Zoeken terwijl je typt, maar niet bij elke aanslag. Een halve
  // seconde stilte is het teken dat iemand klaar is met typen.
  useEffect(() => {
    const klok = setTimeout(() => { void zoek(term) }, 400)
    return () => clearTimeout(klok)
  }, [term, zoek])

  return (
    <PageWrapper title="Archief">
      <div className="max-w-5xl space-y-5">
        <Card className="p-5">
          <label className="block text-sm font-semibold text-gray-700 dark:text-white/70 mb-2">
            Waar hebben we gewerkt?
          </label>
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
            <input
              type="search"
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Adres, plaats of opdrachtnummer…"
              className="w-full min-h-[44px] pl-9 pr-9 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow"
            />
            {term && (
              <button
                onClick={() => setTerm('')}
                title="Wissen"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-sm text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white"
              >
                <IconX className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-white/40">
            Zoekt door alle bonnen, ook die van vorig jaar. Een deel van de
            straatnaam is genoeg.
          </p>
        </Card>

        {loading && (
          <div className="flex justify-center py-14"><Spinner className="w-8 h-8" /></div>
        )}

        {!loading && error && (
          <Card>
            <ErrorState
              melding="Het archief kon niet doorzocht worden. Controleer je verbinding."
              onOpnieuw={() => void zoek(term)}
            />
          </Card>
        )}

        {!loading && !error && !gezocht && (
          <Card>
            <EmptyState
              icon={<IconArchive />}
              titel="Typ een adres"
              uitleg="Zodra je twee letters hebt getypt zoeken we mee. Je ziet dan per bon wat er is afgevinkt en welke foto's erbij horen."
            />
          </Card>
        )}

        {!loading && !error && gezocht && resultaten.length === 0 && (
          <Card>
            <EmptyState
              icon={<IconSearch />}
              titel="Niets gevonden"
              uitleg="Geen bon op dit adres. Probeer alleen de straatnaam, of zoek op plaats."
            />
          </Card>
        )}

        {!loading && resultaten.length > 0 && (
          <>
            <p className="text-xs text-gray-400 dark:text-white/40">
              {resultaten.length} {resultaten.length === 1 ? 'bon' : 'bonnen'} gevonden
            </p>
            <div className="space-y-3">
              {resultaten.map((bon) => (
                <BonRegel
                  key={bon.id}
                  bon={bon}
                  open={open === bon.id}
                  onToggle={() => setOpen(open === bon.id ? null : bon.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  )
}

function BonRegel({ bon, open, onToggle }: { bon: ArchiefBon; open: boolean; onToggle: () => void }) {
  const punten = bon.taken ?? []
  const klaar = punten.filter((t) => t.voltooid).length
  const fotos = punten.flatMap((t) => t.fotos ?? [])

  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-brand-yellow-light/30 dark:hover:bg-white/5 transition-colors"
      >
        <IconMapPin className="w-4 h-4 flex-shrink-0 mt-1 text-gray-400 dark:text-white/40" />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white truncate">{bon.adres}</div>
          <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
            {[bon.plaats, formatDatum(bon.opgeleverd_op ?? bon.datum), bon.opdrachtnummer && `opdracht ${bon.opdrachtnummer}`]
              .filter(Boolean).join(' · ')}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Dezelfde kleurtaal als de rest: "Afgerond" stond hier
                op geel, en "loopt nog" op grijs ook als er al de halve
                bon was afgevinkt. */}
            {(() => {
              const k = standkleur({ status: bon.status, opgeleverd_op: bon.opgeleverd_op, puntenKlaar: klaar })
              return <Badge variant={k.badge}>{k.label}</Badge>
            })()}
            <span className="text-xs text-gray-400 dark:text-white/40">
              {klaar}/{punten.length} punten
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/40">
              <IconPhoto className="w-3.5 h-3.5" />{fotos.length}
            </span>
            {bon.medewerkers.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/40 min-w-0">
                <IconUsers className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{bon.medewerkers.map((m) => m.naam).join(', ')}</span>
              </span>
            )}
          </div>
        </div>

        <IconChevronDown className={cn(
          'w-4 h-4 flex-shrink-0 mt-1 text-gray-300 dark:text-white/25 transition-transform duration-150',
          open && 'rotate-180'
        )} />
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-white/10 p-4 space-y-5">
          {bon.werkvoorbereiding && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40">
                Werkvoorbereiding
              </summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-gray-600 dark:text-white/60">
                {bon.werkvoorbereiding}
              </p>
            </details>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2">
              Uitgevoerd
            </h3>
            {punten.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/40">Geen punten op deze bon.</p>
            ) : (
              <ul className="space-y-2">
                {punten.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 text-sm">
                    {p.voltooid
                      ? <IconCircleCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />
                      : <IconCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-300 dark:text-white/20" />}
                    <span className="min-w-0">
                      <span className={cn(
                        'leading-snug',
                        p.voltooid ? 'text-gray-700 dark:text-white/70' : 'text-gray-400 dark:text-white/40'
                      )}>
                        {p.titel}
                      </span>
                      {p.opmerking && (
                        <span className="block text-xs text-gray-400 dark:text-white/40 mt-0.5">
                          {p.opmerking}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Fotostrook fotos={fotos} />
        </div>
      )}
    </div>
  )
}

/**
 * De foto's van deze bon.
 *
 * De links worden pas gemaakt als je de bon openklapt en ze vervallen
 * na een uur — de bucket is besloten en dat blijft zo. Dit zijn foto's
 * uit de woningen van bewoners; een link die eeuwig blijft werken is
 * hier geen gemak maar een lek.
 */
function Fotostrook({ fotos }: { fotos: ArchiefFoto[] }) {
  const { getUrl } = useFotos()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [bezig, setBezig] = useState(true)

  useEffect(() => {
    let afgebroken = false
    const haal = async () => {
      setBezig(true)
      // Een opgeruimde foto heeft geen bestand meer: ondertekenen levert
      // niets op. Die overslaan, anders wordt er per stuk een ronde naar
      // de server gedaan voor een antwoord dat toch leeg is.
      const paren = await Promise.all(
        fotos
          .filter((f) => !f.opgeruimd_op)
          .map(async (f) => [f.id, await getUrl(f.storage_path)] as const),
      )
      if (afgebroken) return
      setUrls(Object.fromEntries(paren.filter(([, u]) => u) as [string, string][]))
      setBezig(false)
    }
    if (fotos.length > 0) void haal(); else setBezig(false)
    return () => { afgebroken = true }
  }, [fotos])

  if (fotos.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-white/40">
        Geen foto's bij deze bon.
      </p>
    )
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2">
        Foto's ({fotos.length})
      </h3>
      {bezig ? (
        <div className="flex justify-center py-6"><Spinner className="w-6 h-6" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {fotos.map((f) => {
            // Het bestand is opgeruimd, de foto niet: die staat als
            // bijlage bij de ClickUp-taak. Zonder dit viel zo'n foto
            // stilzwijgend uit de strook terwijl de kop er nog wel bij
            // telde — vier foto's beloofd, twee te zien.
            if (f.opgeruimd_op) {
              return (
                <div
                  key={f.id}
                  className="aspect-square rounded-sm border border-gray-100 dark:border-white/10 bg-surface-2 dark:bg-white/5 flex flex-col items-center justify-center gap-1.5 p-2 text-center"
                >
                  <IconArchive className="w-5 h-5 text-gray-400 dark:text-white/40" />
                  <span className="text-[11px] leading-tight text-gray-400 dark:text-white/40">
                    Opgeruimd — staat bij de ClickUp-taak
                  </span>
                </div>
              )
            }
            const url = urls[f.id]
            if (!url) return null
            return (
              <a
                key={f.id}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group block aspect-square overflow-hidden rounded-sm border border-gray-100 dark:border-white/10"
              >
                <img
                  src={url}
                  alt={f.bestandsnaam ?? 'werkfoto'}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-200 ease-brand group-hover:scale-105"
                />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

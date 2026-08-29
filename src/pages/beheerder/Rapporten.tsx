import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDatum, berekenVoortgang } from '@/lib/utils'
import { naarCsv, download, bestandsnaamMetDatum } from '@/lib/export'
import { toast } from '@/store/toastStore'
import { IconDownload, IconFileText, IconChevronRight } from '@tabler/icons-react'

type Periode = 'maand' | 'kwartaal' | 'jaar' | 'alles'

const PERIODEN: { waarde: Periode; label: string; dagen: number | null }[] = [
  { waarde: 'maand',    label: 'Deze maand',    dagen: 31 },
  { waarde: 'kwartaal', label: 'Dit kwartaal',  dagen: 92 },
  { waarde: 'jaar',     label: 'Dit jaar',      dagen: 365 },
  { waarde: 'alles',    label: 'Alles',         dagen: null },
]

/**
 * Rapporten — afgerond werk, en wat je ermee kunt.
 *
 * De knop hier deed niets: hij toonde een melding dat export "in een
 * volgende versie" zou komen. Een knop die niets doet is erger dan geen
 * knop, want iemand rekent erop en ontdekt pas op het verkeerde moment
 * dat het er niet is.
 *
 * Wat hij nu wél doet is wat kantoor er daadwerkelijk mee moet: de
 * gegevens naar Excel, voor de administratie en de facturatie. Een
 * opleverrapport per bon in PDF is een ander gesprek — de velden
 * daarvoor staan in de database maar er is nog geen scherm dat ze
 * invult, en dan zou de PDF een lege huls zijn.
 */
export default function Rapporten() {
  const { werkbonnen, loading } = useWerkbonnen()
  const navigate = useNavigate()
  const [periode, setPeriode] = useState<Periode>('kwartaal')

  const klaar = useMemo(() => {
    // Voltooid óf opgeleverd. Die twee liepen hier uiteen: een bon die
    // door kantoor is opgeleverd staat in de database niet
    // noodzakelijk op 'voltooid', en viel dus buiten het rapport terwijl
    // hij juist het meest afgerond is dat er bestaat.
    const af = werkbonnen.filter((w) => w.status === 'voltooid' || w.opgeleverd_op)

    const dagen = PERIODEN.find((p) => p.waarde === periode)?.dagen
    if (!dagen) return af

    const grens = new Date()
    grens.setDate(grens.getDate() - dagen)
    const grensISO = grens.toISOString().split('T')[0]

    return af.filter((w) => (w.opgeleverd_op ?? w.datum).slice(0, 10) >= grensISO)
  }, [werkbonnen, periode])

  const exporteer = () => {
    if (klaar.length === 0) {
      toast.info('Er is in deze periode niets afgerond om te exporteren.')
      return
    }

    const koppen = [
      'Bonnummer', 'Adres', 'Plaats', 'Datum', 'Opgeleverd op',
      'Ploeg', 'Punten totaal', 'Punten klaar', "Foto's", 'Status',
    ]

    const rijen = klaar.map((w) => {
      const taken = w.taken ?? []
      return [
        w.bonnummer,
        w.adres,
        (w as { plaats?: string | null }).plaats ?? '',
        w.datum,
        w.opgeleverd_op ? w.opgeleverd_op.slice(0, 10) : '',
        (w.medewerkers ?? []).map((m) => m.naam).join(', '),
        taken.length,
        taken.filter((t) => t.voltooid).length,
        taken.flatMap((t) => t.fotos ?? []).length,
        w.opgeleverd_op ? 'opgeleverd' : w.status,
      ]
    })

    download(bestandsnaamMetDatum('nmzgo-afgerond'), naarCsv(koppen, rijen))
    toast.goed(`${klaar.length} werkbonnen geëxporteerd.`)
  }

  return (
    <PageWrapper
      title="Rapporten"
      actions={
        <Button variant="primary" onClick={exporteer} disabled={loading || klaar.length === 0}>
          <IconDownload className="w-4 h-4" /> Exporteren naar Excel
        </Button>
      }
    >
      <div className="max-w-4xl space-y-5">
        <div className="flex gap-1.5 bg-surface-2 dark:bg-white/5 p-1 rounded-sm w-fit">
          {PERIODEN.map((p) => (
            <button
              key={p.waarde}
              onClick={() => setPeriode(p.waarde)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                periode === p.waarde
                  ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Card>
          <SectionHeading title={`Afgerond werk (${klaar.length})`} />

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : klaar.length === 0 ? (
            <EmptyState
              icon={<IconFileText />}
              titel="Niets afgerond in deze periode"
              uitleg="Zodra een zwamsaneerder een bon afrondt en kantoor hem oplevert, verschijnt hij hier. Kies een ruimere periode om verder terug te kijken."
            />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {klaar.map((w) => {
                const taken = w.taken ?? []
                const fotos = taken.flatMap((t) => t.fotos ?? []).length
                return (
                  <button
                    key={w.id}
                    onClick={() => navigate(`/werkbonnen/${w.id}`)}
                    className="flex items-center gap-3 w-full py-4 px-2 -mx-2 text-left rounded-lg transition-colors hover:bg-brand-yellow-light/40 dark:hover:bg-white/5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {w.adres}
                      </div>
                      <div className="text-xs text-tekst-gedempt dark:text-white/55 mt-0.5 truncate">
                        {[
                          w.bonnummer,
                          formatDatum(w.opgeleverd_op ?? w.datum),
                          (w.medewerkers ?? []).map((m) => m.naam).join(', ') || null,
                        ].filter(Boolean).join(' · ')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="green">
                          {w.opgeleverd_op ? 'Opgeleverd' : 'Afgerond'}
                        </Badge>
                        <span className="text-xs text-tekst-gedempt dark:text-white/55">
                          {berekenVoortgang(taken)}% · {taken.length} punten · {fotos} foto's
                        </span>
                      </div>
                    </div>
                    <IconChevronRight className="w-4 h-4 flex-shrink-0 text-tekst-fijn dark:text-white/40" />
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <p className="text-xs text-tekst-gedempt dark:text-white/55 leading-relaxed">
          De export bevat adres, ploeg, afgevinkte punten en het aantal foto's per
          bon — genoeg voor de administratie. Het opleverrapport per klus vraag je
          aan op de werkbon zelf, samen met de drie tekstvelden die erin komen. De
          PDF wordt nog niet gemaakt: zo'n aanvraag blijft in de wachtrij staan
          tot de generator er is.
        </p>
      </div>
    </PageWrapper>
  )
}

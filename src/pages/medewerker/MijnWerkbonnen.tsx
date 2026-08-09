import { useNavigate } from 'react-router-dom'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { useAuth } from '@/hooks/useAuth'
import { useWerkdag, formatTijd, geefUren } from '@/hooks/useWerkdag'
import { useMijnPrestaties } from '@/hooks/useMijnPrestaties'
import { usePlanningDoorkijk } from '@/hooks/usePlanningDoorkijk'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { TaakItem } from '@/components/taak/TaakItem'
import { Klusinfo } from '@/components/werkbon/Klusinfo'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { berekenVoortgang, formatDatum, cn } from '@/lib/utils'
import { kiesVandaag, isoDatum } from '@/lib/planning'
import {
  IconMapPin, IconCalendar, IconPlayerPlay, IconPlayerStop,
  IconListCheck, IconPhoto, IconClock, IconTrophy, IconChevronRight,
  IconUsers, IconCircleCheck,
} from '@tabler/icons-react'
import type { Werkbon } from '@/types'

function groet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function datumLang(): string {
  return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function MijnWerkbonnen() {
  const { profile } = useAuth()
  const { werkbonnen, loading, refetch } = useWerkbonnen()
  const navigate = useNavigate()

  const voornaam = (profile?.naam ?? '').split(' ')[0]
  const vandaag = kiesVandaag(werkbonnen)
  const { state: werkdag, bezig: werkdagBezig, startWerkdag, stopWerkdag, hervatWerkdag } = useWerkdag(vandaag?.id ?? null)

  if (loading) {
    return (
      <PageWrapper title="Vandaag">
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  const taken = vandaag?.taken ?? []
  const voortgang = berekenVoortgang(taken)
  const aantalTaken = taken.length
  const aantalKlaar = taken.filter((t) => t.voltooid).length
  const aantalFotos = taken.flatMap((t) => t.fotos ?? []).length

  // Dezelfde schil als kantoor: zijbalk op een laptop, balk onderin op
  // een telefoon. Dit scherm had een eigen opbouw zonder navigatie —
  // daardoor was er geen weg naar je andere bonnen en voelde de app
  // leeg, want er was maar één ding te zien.
  const Schil = ({ children, compact }: { children: React.ReactNode; compact?: boolean }) => (
    <PageWrapper title="Vandaag">
      <div className={cn('max-w-5xl space-y-4', compact && 'pb-28')}>
        <div>
          <p className="text-xs text-gray-400 dark:text-white/40 capitalize">{datumLang()}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {groet()}, {voornaam}
          </h1>
        </div>
        {children}
      </div>
    </PageWrapper>
  )

  // ── Geen werkbon vandaag ──────────────────────────────────────
  if (!vandaag) {
    return (
      <Schil>
        <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm">
          <EmptyState
            icon={<IconCalendar />}
            titel="Vandaag geen werkbon"
            uitleg="Er staat nog niets voor je klaar. Neem contact op met je uitvoerder als je wél werk verwacht."
          />
        </div>
        <Prestaties />
        <WaarWerktWie />
      </Schil>
    )
  }

  // ── Nog niet gestart ──────────────────────────────────────────
  if (werkdag.fase === 'voor_start') {
    return (
      <Schil>
        <WerkbonKop werkbon={vandaag} aantalTaken={aantalTaken} />

        {/* Vóór de startknop: op dit moment sta je voor de deur en
            zoek je de kluiscode, niet de urenregistratie. */}
        <Klusinfo werkbon={vandaag} />

        <button
          onClick={startWerkdag}
          disabled={werkdagBezig}
          className="w-full py-5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold text-lg flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-all duration-150 ease-brand disabled:opacity-60 disabled:active:scale-100"
        >
          <IconPlayerPlay className="w-6 h-6" />
          {werkdagBezig ? 'BEZIG…' : 'START WERKDAG'}
        </button>

        {/* De punten lezen mag altijd; afvinken pas na het starten.
            Wie voor de deur staat wil weten wát hij gaat doen voordat
            hij zijn dag begint — dat achter een knop verstoppen maakt
            het scherm leeg zonder reden. */}
        <PuntenKaart taken={taken} werkbonId={vandaag.id} readOnly onRefresh={refetch}
                     bijschrift="Lezen kan nu al — afvinken zodra je bent gestart" />

        <Tegels aantalKlaar={aantalKlaar} aantalTaken={aantalTaken}
                aantalFotos={aantalFotos} voortgang={voortgang} uren="—" />
        <Prestaties />
        <WaarWerktWie />
      </Schil>
    )
  }

  // ── Werkdag gestopt ───────────────────────────────────────────
  if (werkdag.fase === 'gestopt') {
    return (
      <Schil>
        <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <IconCircleCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="font-bold text-gray-900 dark:text-white">Werkdag gestopt</h2>
          <p className="text-sm text-gray-400 dark:text-white/40 mt-1">
            {formatTijd(werkdag.startTijd)} — {formatTijd(werkdag.stopTijd)} ·{' '}
            {geefUren(werkdag.startTijd, werkdag.stopTijd)} uur
          </p>
        </div>

        {/* Stoppen was een doodlopende weg: geen bon, geen punten,
            geen weg terug. Wie te vroeg op stop drukt moet gewoon
            verder kunnen. */}
        <button
          onClick={hervatWerkdag}
          disabled={werkdagBezig}
          className="w-full min-h-[56px] rounded-lg bg-white dark:bg-surface-dark-2 border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <IconPlayerPlay className="w-5 h-5" />
          {werkdagBezig ? 'BEZIG…' : 'Werkdag hervatten'}
        </button>

        <WerkbonKop werkbon={vandaag} aantalTaken={aantalTaken} />
        <Klusinfo werkbon={vandaag} />
        <PuntenKaart taken={taken} werkbonId={vandaag.id} readOnly onRefresh={refetch}
                     bijschrift="Hervat je werkdag om weer af te vinken" />

        <Tegels aantalKlaar={aantalKlaar} aantalTaken={aantalTaken} aantalFotos={aantalFotos}
                voortgang={voortgang} uren={geefUren(werkdag.startTijd, werkdag.stopTijd)} />
        <Prestaties />
        <WaarWerktWie />
      </Schil>
    )
  }

  // ── Aan het werk ──────────────────────────────────────────────
  return (
    <PageWrapper title={vandaag.adres}>
      <div className="max-w-5xl space-y-4 pb-28">
        <Tegels aantalKlaar={aantalKlaar} aantalTaken={aantalTaken} aantalFotos={aantalFotos}
                voortgang={voortgang} uren={geefUren(werkdag.startTijd, null)} />

        <Klusinfo werkbon={vandaag} />

        <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-white/80">{vandaag.projectnaam}</p>
            <span className={cn('text-xl font-extrabold tabular-nums',
              voortgang === 100 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white')}>
              {voortgang}%
            </span>
          </div>
          <ProgressBar value={voortgang} size="md" variant={voortgang === 100 ? 'green' : 'yellow'} />
        </div>

        <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
          <SectionHeading
            title="Checklist"
            actions={<span className="text-xs text-gray-400 dark:text-white/40">Foto vereist per punt</span>}
          />
          {taken.length > 0 ? (
            taken.map((taak) => (
              <TaakItem key={taak.id} taak={taak} werkbonId={vandaag.id} onRefresh={refetch} />
            ))
          ) : (
            <p className="text-sm text-gray-400 dark:text-white/40 text-center py-4">Geen punten op deze bon.</p>
          )}
        </div>

        <button
          onClick={() => navigate(`/werkbon/${vandaag.id}`)}
          className="w-full py-4 rounded-lg bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 font-semibold text-sm flex items-center justify-center gap-2 hover:border-brand-yellow transition-all duration-150 ease-brand"
        >
          Werkbon openen <IconChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Boven de navigatiebalk op een telefoon, anders valt hij eronder. */}
      <div className="fixed bottom-16 md:bottom-0 left-0 md:left-60 right-0 z-40 p-4 bg-white/90 dark:bg-surface-dark-2/90 backdrop-blur-sm border-t border-gray-100 dark:border-white/10">
        <div className="max-w-5xl mx-auto">
        <button
          onClick={stopWerkdag}
          disabled={werkdagBezig}
          className="w-full py-4 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-lg disabled:opacity-60 disabled:active:scale-100"
        >
          <IconPlayerStop className="w-5 h-5" />
          {werkdagBezig ? 'BEZIG…' : 'STOP WERKDAG'}
        </button>
        </div>
      </div>
    </PageWrapper>
  )
}

// ── Onderdelen ────────────────────────────────────────────────

/** Dezelfde KpiCard als op het kantoordashboard — vandaar de herkenning. */
function Tegels({ aantalKlaar, aantalTaken, aantalFotos, voortgang, uren }: {
  aantalKlaar: number; aantalTaken: number; aantalFotos: number; voortgang: number; uren: string
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Punten klaar" value={`${aantalKlaar}/${aantalTaken}`}
               icon={<IconListCheck />} variant={aantalKlaar === aantalTaken && aantalTaken > 0 ? 'green' : 'neutral'} />
      <KpiCard label="Foto's" value={aantalFotos} icon={<IconPhoto />} variant="neutral" />
      <KpiCard label="Voortgang" value={`${voortgang}%`} icon={<IconCircleCheck />}
               variant={voortgang === 100 ? 'green' : 'yellow'} />
      <KpiCard label="Gewerkt" value={uren} icon={<IconClock />} variant="neutral" />
    </div>
  )
}

function WerkbonKop({ werkbon, aantalTaken }: { werkbon: any; aantalTaken: number }) {
  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 border-l-4 border-l-brand-yellow rounded-lg shadow-sm p-5">
      {/* Het adres is de klus. "Zwamsanering" staat op elke bon en zegt
          dus niets — dat stond hier als kop en het adres eronder. */}
      <p className="text-[11px] font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest mb-2">
        Vandaag werk je aan
      </p>
      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
        {werkbon.adres}
      </h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-white/60">
        <span>{werkbon.projectnaam}</span>
        {werkbon.bonnummer && <span className="text-gray-400 dark:text-white/40">Bon {werkbon.bonnummer}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-50 dark:border-white/5 text-xs text-gray-400 dark:text-white/40">
        {/* Met "start" ervoor, anders leest een datum uit het verleden
            als een fout in plaats van als de startdatum. */}
        <span className="flex items-center gap-1">
          <IconCalendar className="w-3.5 h-3.5" />
          start {formatDatum(werkbon.geplande_start ?? werkbon.datum)}
        </span>
        {werkbon.geplande_eind && (
          <span className="flex items-center gap-1">opleveren {formatDatum(werkbon.geplande_eind)}</span>
        )}
        <span className="flex items-center gap-1"><IconListCheck className="w-3.5 h-3.5" />{aantalTaken} punten</span>
      </div>
    </div>
  )
}

/** Stond op verzonnen cijfers; nu geteld uit de echte tabellen. */
function Prestaties() {
  const { data, loading } = useMijnPrestaties()

  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
      <SectionHeading title="Mijn cijfers" actions={<IconTrophy className="w-4 h-4 text-brand-yellow-dark dark:text-brand-yellow" />} />
      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5" /></div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { waarde: data.werkbonnenAfgerond, label: 'Werkbonnen afgerond' },
            { waarde: data.werkdagenGewerkt, label: 'Werkdagen gewerkt' },
            { waarde: data.fotosGemaakt, label: "Foto's gemaakt" },
          ].map((c, i) => (
            <div key={c.label} className={cn('min-w-0 text-center px-1', i === 1 && 'border-x border-gray-100 dark:border-white/10')}>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{c.waarde}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-white/40 mt-0.5 leading-tight break-words">{c.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Waar zit iedereen vandaag. Toont uitsluitend adres en naam — de
 * databasefunctie geeft niet meer terug, dus een werkbon van een
 * collega blijft dicht.
 */
function WaarWerktWie() {
  const dag = isoDatum()
  const { regels, loading } = usePlanningDoorkijk(dag, dag)

  if (!loading && regels.length === 0) return null

  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
      <SectionHeading title="Wie werkt waar vandaag" actions={<IconUsers className="w-4 h-4 text-gray-400 dark:text-white/40" />} />
      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5" /></div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-white/5">
          {regels.map((r, i) => (
            <div key={`${r.adres}-${r.medewerker}-${i}`} className="flex items-center gap-3 py-2.5">
              <Avatar naam={r.medewerker} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.medewerker}</p>
                <p className="text-xs text-gray-400 dark:text-white/40 truncate">
                  {r.adres}{r.plaats ? `, ${r.plaats}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * De uit te voeren punten. Lezen mag altijd, afvinken alleen als de
 * werkdag loopt — dat verschil staat er ook bij, zodat niemand denkt
 * dat de app kapot is als er niets gebeurt bij aantikken.
 */
function PuntenKaart({ taken, werkbonId, readOnly, onRefresh, bijschrift }: {
  taken: any[]; werkbonId: string; readOnly?: boolean
  onRefresh: () => void; bijschrift?: string
}) {
  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
      <SectionHeading
        title={`Uit te voeren punten (${taken.length})`}
        actions={bijschrift
          ? <span className="text-xs text-gray-400 dark:text-white/40">{bijschrift}</span>
          : undefined}
      />
      {taken.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-white/40 text-center py-4">
          Geen punten op deze bon.
        </p>
      ) : (
        taken.map((t) => (
          <TaakItem key={t.id} taak={t} werkbonId={werkbonId}
                    readOnly={readOnly} onRefresh={onRefresh} />
        ))
      )}
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { useAuth } from '@/hooks/useAuth'
import { useWerkdag, formatTijd, geefUren } from '@/hooks/useWerkdag'
import { TaakItem } from '@/components/taak/TaakItem'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { berekenVoortgang, formatDatum } from '@/lib/utils'
import {
  IconMapPin,
  IconCalendar,
  IconPlayerPlay,
  IconPlayerStop,
  IconListCheck,
  IconPhoto,
  IconClock,
  IconTrophy,
  IconChevronRight,
} from '@tabler/icons-react'

// ── Mockdata prestaties — later koppelen aan Supabase werkdag_logs
// Supabase koppeling:
//   projectenAfgerond → COUNT werkbonnen WHERE status = voltooid AND medewerker = auth.uid()
//   werkdagenGewerkt  → COUNT werkdag_logs WHERE medewerker_id = auth.uid()
//   fotosGeupload     → COUNT fotos WHERE uploader_id = auth.uid()
const MOCK_PRESTATIES = {
  projectenAfgerond: 12,
  werkdagenGewerkt: 34,
  fotosGeupload: 87,
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function formatDatumLang(): string {
  return new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function MijnWerkbonnen() {
  const { profile } = useAuth()
  const { werkbonnen, loading, refetch } = useWerkbonnen()
  const navigate = useNavigate()
  const voornaam = (profile?.naam ?? '').split(' ')[0]

  const vandaag = werkbonnen.find((w) => w.status !== 'voltooid') ?? null
  const { state: werkdag, startWerkdag, stopWerkdag } = useWerkdag(vandaag?.id ?? null)

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F2F0EB' }}
      >
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  const voortgang = berekenVoortgang(vandaag?.taken ?? [])
  const aantalTaken = vandaag?.taken?.length ?? 0
  const aantalKlaar = vandaag?.taken?.filter((t) => t.voltooid).length ?? 0
  const aantalFotos = vandaag?.taken?.flatMap((t) => t.fotos ?? []).length ?? 0

  // ── Gedeelde header — altijd zichtbaar ────────────────────────
  const Header = () => (
    <div className="bg-gray-900 px-5 py-5">
      <p className="text-sm text-white/50 mb-0.5 capitalize">{formatDatumLang()}</p>
      <h1 className="text-xl font-extrabold text-white">
        {greeting()}, {voornaam}
      </h1>
    </div>
  )

  // ── Geen werkbon ──────────────────────────────────────────────
  if (!vandaag) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F2F0EB' }}>
        <Header />
        <div className="flex-1 p-5 space-y-4">
          {/* Geen werkbon kaart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <IconCalendar className="w-7 h-7 text-gray-400" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              Vandaag nog geen werkbon
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Er is nog geen werkbon aan jou gekoppeld voor vandaag.
              <br />
              Neem contact op met je uitvoerder.
            </p>
          </div>

          {/* Prestaties — altijd zichtbaar */}
          <PrestatiesKaart />
        </div>
      </div>
    )
  }

  // ── VOOR START ────────────────────────────────────────────────
  if (werkdag.fase === 'voor_start') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F2F0EB' }}>
        <Header />

        <div className="flex-1 p-5 space-y-4">
          {/* Werkbon kaart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-yellow" />
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Vandaag werk je aan
              </p>
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">
                {vandaag.projectnaam}
              </h2>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                <IconMapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                {vandaag.adres}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <IconCalendar className="w-4 h-4 flex-shrink-0" />
                {formatDatum(vandaag.datum)}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <IconListCheck className="w-3.5 h-3.5" />
                  {aantalTaken} taken
                </span>
              </div>
            </div>
          </div>

          {/* START knop */}
          <button
            onClick={startWerkdag}
            className="w-full py-5 rounded-2xl bg-green-500 text-white font-extrabold text-lg flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(34,197,94,0.35)] active:scale-[0.98] transition-transform"
          >
            <IconPlayerPlay className="w-6 h-6" />
            START WERKDAG
          </button>

          {/* Status overzicht */}
          <StatusKaart
            fase="voor_start"
            aantalTaken={aantalTaken}
            aantalKlaar={aantalKlaar}
            aantalFotos={aantalFotos}
            startTijd={null}
          />

          {/* Prestaties */}
          <PrestatiesKaart />

          {/* Werkbon openen */}
          <button
            onClick={() => navigate(`/werkbon/${vandaag.id}`)}
            className="w-full py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            Werkbon openen
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── GESTOPT ───────────────────────────────────────────────────
  if (werkdag.fase === 'gestopt') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F2F0EB' }}>
        <Header />
        <div className="flex-1 p-5 space-y-4">
          {/* Afsluitkaart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <IconPlayerStop className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Werkdag gestopt</h2>
            <p className="text-sm text-gray-500">
              {formatTijd(werkdag.startTijd)} &mdash; {formatTijd(werkdag.stopTijd)}
              &nbsp;&middot;&nbsp;
              {geefUren(werkdag.startTijd, werkdag.stopTijd)} uur
            </p>
          </div>

          <StatusKaart
            fase="gestopt"
            aantalTaken={aantalTaken}
            aantalKlaar={aantalKlaar}
            aantalFotos={aantalFotos}
            startTijd={werkdag.startTijd}
          />

          <PrestatiesKaart />
        </div>
      </div>
    )
  }

  // ── ACTIEF ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F2F0EB' }}>
      {/* Sticky header met project */}
      <div className="bg-gray-900 sticky top-0 z-40 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40">Aan het werk</p>
            <p className="text-base font-bold text-white leading-tight">
              {vandaag.projectnaam}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40">Gestart</p>
            <p className="text-sm font-mono font-bold text-brand-yellow">
              {formatTijd(werkdag.startTijd)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 pb-32">
        {/* Voortgangskaart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-0.5">{vandaag.adres}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <IconListCheck className="w-3.5 h-3.5" />
                  {aantalKlaar}/{aantalTaken} taken
                </span>
                <span className="flex items-center gap-1">
                  <IconPhoto className="w-3.5 h-3.5" />
                  {aantalFotos} foto&apos;s
                </span>
              </div>
            </div>
            <span
              className="text-2xl font-extrabold"
              style={{ color: voortgang === 100 ? '#16a34a' : '#111110' }}
            >
              {voortgang}%
            </span>
          </div>
          <ProgressBar
            value={voortgang}
            size="md"
            variant={voortgang === 100 ? 'green' : 'yellow'}
          />
        </div>

        {/* Checklist */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Checklist</h2>
            <span className="text-xs text-gray-400">Foto vereist voor afvinken</span>
          </div>
          {vandaag.taken && vandaag.taken.length > 0 ? (
            vandaag.taken.map((taak) => (
              <TaakItem
                key={taak.id}
                taak={taak}
                werkbonId={vandaag.id}
                onRefresh={refetch}
              />
            ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Geen taken gevonden.</p>
          )}
        </div>

        {/* Werkbon openen */}
        <button
          onClick={() => navigate(`/werkbon/${vandaag.id}`)}
          className="w-full py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
        >
          Werkbon openen
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* STOP knop — fixed onderaan */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-gray-100">
        <button
          onClick={stopWerkdag}
          className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-lg"
        >
          <IconPlayerStop className="w-5 h-5" />
          STOP WERKDAG
        </button>
      </div>
    </div>
  )
}

// ── StatusKaart ───────────────────────────────────────────────
interface StatusKaartProps {
  fase: 'voor_start' | 'actief' | 'gestopt'
  aantalTaken: number
  aantalKlaar: number
  aantalFotos: number
  startTijd: Date | null
}

function StatusKaart({
  fase,
  aantalTaken,
  aantalKlaar,
  aantalFotos,
  startTijd,
}: StatusKaartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Status vandaag
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <div
            className={[
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              fase === 'voor_start' ? 'bg-gray-100' : 'bg-green-100',
            ].join(' ')}
          >
            <IconClock
              className={[
                'w-4 h-4',
                fase === 'voor_start' ? 'text-gray-400' : 'text-green-600',
              ].join(' ')}
            />
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Status</p>
            <p className="text-sm font-bold text-gray-900">
              {fase === 'voor_start'
                ? 'Nog niet gestart'
                : fase === 'actief'
                ? 'Gestart'
                : 'Gestopt'}
            </p>
          </div>
        </div>

        {startTijd && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <IconClock className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Gestart om</p>
              <p className="text-sm font-bold text-gray-900">
                {startTijd.toLocaleTimeString('nl-NL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-yellow-light flex items-center justify-center flex-shrink-0">
            <IconListCheck className="w-4 h-4 text-brand-yellow-dark" />
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Taken</p>
            <p className="text-sm font-bold text-gray-900">
              {aantalKlaar}/{aantalTaken}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <IconPhoto className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Foto&apos;s</p>
            <p className="text-sm font-bold text-gray-900">{aantalFotos}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PrestatiesKaart ───────────────────────────────────────────
function PrestatiesKaart() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <IconTrophy className="w-4 h-4 text-brand-yellow-dark" />
        <h3 className="text-sm font-bold text-gray-900">Mijn prestaties</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-extrabold text-gray-900">
            {MOCK_PRESTATIES.projectenAfgerond}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
            Projecten afgerond
          </p>
        </div>
        <div className="text-center border-x border-gray-100">
          <p className="text-2xl font-extrabold text-gray-900">
            {MOCK_PRESTATIES.werkdagenGewerkt}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
            Werkdagen gewerkt
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-extrabold text-gray-900">
            {MOCK_PRESTATIES.fotosGeupload}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
            Foto&apos;s ge&uuml;pload
          </p>
        </div>
      </div>
    </div>
  )
}

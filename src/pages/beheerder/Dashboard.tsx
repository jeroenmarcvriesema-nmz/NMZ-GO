import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MeldingItem } from '@/components/dashboard/MeldingItem'
import { ProjectTabel } from '@/components/dashboard/ProjectTabel'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Storingen } from '@/components/dashboard/Storingen'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import {
  IconPlus,
  IconFolderOpen,
  IconClock,
  IconAlertTriangle,
  IconCircleCheck,
  IconTrendingUp,
  IconCalendar,
} from '@tabler/icons-react'

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
    year: 'numeric',
  })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, loading, error, refetch } = useDashboard()
  const voornaam = (profile?.naam ?? '').split(' ')[0]

  if (loading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="flex justify-center py-32"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper title="Dashboard">
        <ErrorState
          melding="Het dashboard kon niet worden geladen. Controleer je verbinding."
          onOpnieuw={refetch}
        />
      </PageWrapper>
    )
  }

  // KPI's komen uit de werkbonnen van vandaag, niet uit de
  // projecten-tabel: die vult zich pas met de ClickUp-synchronisatie
  // (fase 2) en zou tot die tijd zes nullen tonen boven een tabel die
  // wél werk laat zien.
  const lopend        = data.actieveProjecten
  const vandaagActief = data.vandaagGestart
  const nietGestart   = data.nogNietGestart
  const achter        = data.achterOpSchema
  const opleveringen  = data.vandaagAfgerond
  const gemVoortgang  = data.projecten.length
    ? Math.round(data.projecten.reduce((n, p) => n + p.voortgang, 0) / data.projecten.length)
    : 0

  const urgenteMeldingen = data.meldingen.filter(
    (m) => m.type === 'niet_gestart' || m.type === 'controle' || m.type === 'geen_fotos'
  )

  return (
    <PageWrapper
      title="Dashboard"
      actions={
        <Button variant="primary" onClick={() => navigate('/werkbonnen/nieuw')}>
          <IconPlus className="w-4 h-4" /> Nieuwe werkbon
        </Button>
      }
    >
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white break-words">
          {greeting()}, {voornaam}
        </h1>
        <p className="text-sm text-gray-400 dark:text-white/40 mt-1.5 capitalize">{formatDatumLang()}</p>
        {urgenteMeldingen.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm font-medium px-3 py-1.5 rounded-lg">
            <IconAlertTriangle className="w-4 h-4" />
            {urgenteMeldingen.length} aandachtspunt{urgenteMeldingen.length !== 1 ? 'en' : ''} vereisen actie
          </div>
        )}
      </div>

      {/* Vier kaarten in plaats van zes.
          "Lopend vandaag" en "Gestart" telden bijna hetzelfde en stonden
          naast elkaar te verschillen, wat vooral verwarring gaf. Ze zijn
          samengetrokken tot één kaart die het verhaal in één keer
          vertelt: hoeveel klussen lopen er, en hoeveel daarvan is
          begonnen.

          Wat aandacht vraagt staat vooraan en niet ergens in het midden.
          Een rij van zes waarvan er vijf op nul staan leest als een
          dashboard dat niets weet. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <KpiCard
          label={nietGestart > 0 ? `Niet gestart · ${lopend} vandaag` : `Vandaag · ${vandaagActief} gestart`}
          value={nietGestart > 0 ? nietGestart : lopend}
          icon={nietGestart > 0 ? <IconClock /> : <IconFolderOpen />}
          variant={nietGestart > 0 ? 'yellow' : 'neutral'}
        />
        <KpiCard
          label="Achter op schema"
          value={achter}
          icon={<IconAlertTriangle />}
          variant={achter > 0 ? 'red' : 'neutral'}
        />
        <KpiCard label="Afgerond" value={opleveringen} icon={<IconCircleCheck />} variant="green" />
        <KpiCard label="Gem. voortgang" value={`${gemVoortgang}%`} icon={<IconTrendingUp />} variant="neutral" />
      </div>

      {/* Storingen uit de app zelf. Verschijnt alleen als er iets is —
          een kaart die altijd nul meldt wordt niet meer gelezen. */}
      <Storingen />

      {/* Operationele meldingen */}
      {data.meldingen.length > 0 && (
        <div className="mb-8 sm:mb-10">
          <SectionHeading title="Operationele meldingen" />
          <div className="space-y-2">
            {data.meldingen.map((m) => (
              <MeldingItem key={m.id} melding={m} />
            ))}
          </div>
        </div>
      )}

      {/* Projectoverzicht + Activiteit */}
      {/* min-w-0 op beide kolommen. Zonder dat groeit een grid-kind mee
          met zijn inhoud in plaats van zich aan de kolom te houden, en
          dan schuift de hele pagina opzij — dat was het overzicht dat
          buiten de marges viel. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8">
        <div className="xl:col-span-2 min-w-0 bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
          <SectionHeading
            title="Projectoverzicht"
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/planning')}>
                  <IconCalendar className="w-4 h-4" /> Planning
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/projecten')}>
                  Alle projecten →
                </Button>
              </>
            }
          />
          {data.projecten.length === 0 ? (
            <EmptyState
              icon={<IconCalendar />}
              titel="Vandaag staat er niets gepland"
              uitleg="Werkbonnen met de datum van vandaag verschijnen hier zodra ze zijn aangemaakt."
              actie={<Button variant="primary" size="sm" onClick={() => navigate('/werkbonnen/nieuw')}><IconPlus className="w-4 h-4" /> Nieuwe werkbon</Button>}
            />
          ) : (
            <ProjectTabel projecten={data.projecten} />
          )}
        </div>
        <div className="min-w-0 bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
          <SectionHeading title="Activiteit vandaag" />
          <ActivityFeed activiteit={data.activiteit} />
        </div>
      </div>
    </PageWrapper>
  )
}

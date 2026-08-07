import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MeldingItem } from '@/components/dashboard/MeldingItem'
import { ProjectTabel } from '@/components/dashboard/ProjectTabel'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useDashboard } from '@/hooks/useDashboard'
import { useProjecten } from '@/hooks/useProjecten'
import { useAuth } from '@/hooks/useAuth'
import {
  IconPlus,
  IconFolderOpen,
  IconPlayerPlay,
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
  const { data, loading: loadingDash } = useDashboard()
  const { projecten, loading: loadingProj } = useProjecten()
  const voornaam = (profile?.naam ?? '').split(' ')[0]

  const loading = loadingDash || loadingProj

  if (loading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="flex justify-center py-32"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  // Bereken KPI's uit projecten mock data
  const lopend       = projecten.filter((p) => p.status === 'actief' || p.status === 'op_schema' || p.status === 'vertraging').length
  const vandaagActief = data.vandaagGestart
  const nietGestart  = projecten.filter((p) => p.status === 'niet_gestart').length
  const opSchema     = projecten.filter((p) => p.status === 'op_schema').length
  const vertraging   = projecten.filter((p) => p.status === 'vertraging').length
  const opleveringen = projecten.filter((p) => p.status === 'afgerond').length

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
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
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

      {/* KPI's — 6 stuks Sprint 3 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
        <KpiCard label="Lopende projecten" value={lopend}        icon={<IconFolderOpen />}    variant="neutral" />
        <KpiCard label="Vandaag actief"    value={vandaagActief} icon={<IconPlayerPlay />}    variant="blue" />
        <KpiCard label="Niet gestart"      value={nietGestart}   icon={<IconClock />}         variant={nietGestart > 0 ? 'yellow' : 'neutral'} />
        <KpiCard label="Op schema"         value={opSchema}      icon={<IconTrendingUp />}    variant="green" />
        <KpiCard label="Vertraging"        value={vertraging}    icon={<IconAlertTriangle />} variant={vertraging > 0 ? 'red' : 'neutral'} />
        <KpiCard label="Opleveringen"      value={opleveringen}  icon={<IconCircleCheck />}   variant="green" />
      </div>

      {/* Operationele meldingen */}
      {data.meldingen.length > 0 && (
        <div className="mb-10">
          <SectionHeading title="Operationele meldingen" />
          <div className="space-y-2">
            {data.meldingen.map((m) => (
              <MeldingItem key={m.id} melding={m} />
            ))}
          </div>
        </div>
      )}

      {/* Projectoverzicht + Activiteit */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-6">
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
          <ProjectTabel projecten={data.projecten} />
        </div>
        <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-6">
          <SectionHeading title="Activiteit vandaag" />
          <ActivityFeed activiteit={data.activiteit} />
        </div>
      </div>
    </PageWrapper>
  )
}

import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MeldingItem } from '@/components/dashboard/MeldingItem'
import { ProjectTabel } from '@/components/dashboard/ProjectTabel'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import {
  IconPlus, IconFolderOpen, IconPlayerPlay, IconClock,
  IconAlertTriangle, IconCircleCheck,
} from '@tabler/icons-react'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function formatDatumLang(): string {
  return new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, loading } = useDashboard()
  const voornaam = (profile?.naam ?? '').split(' ')[0]

  if (loading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="flex justify-center py-32"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  const urgenteMeldingen = data.meldingen.filter((m) =>
    m.type === 'niet_gestart' || m.type === 'controle' || m.type === 'geen_fotos'
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
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          {greeting()}, {voornaam}
        </h1>
        <p className="text-sm text-gray-400 mt-1 capitalize">{formatDatumLang()}</p>
        {urgenteMeldingen.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-3 py-1.5 rounded-lg">
            <IconAlertTriangle className="w-4 h-4" />
            {urgenteMeldingen.length} aandachtspunt{urgenteMeldingen.length !== 1 ? 'en' : ''} vereisen actie
          </div>
        )}
      </div>

      {/* ── KPI Kaarten ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <KpiCard
          label="Actieve projecten"
          value={data.actieveProjecten}
          icon={<IconFolderOpen />}
          variant="neutral"
        />
        <KpiCard
          label="Vandaag gestart"
          value={data.vandaagGestart}
          icon={<IconPlayerPlay />}
          variant="blue"
        />
        <KpiCard
          label="Nog niet gestart"
          value={data.nogNietGestart}
          icon={<IconClock />}
          variant={data.nogNietGestart > 0 ? 'yellow' : 'neutral'}
          sub={data.nogNietGestart > 0 ? 'Actie vereist' : undefined}
        />
        <KpiCard
          label="Achter op schema"
          value={data.achterOpSchema}
          icon={<IconAlertTriangle />}
          variant={data.achterOpSchema > 0 ? 'red' : 'neutral'}
          sub={data.achterOpSchema > 0 ? 'Direct ingrijpen' : undefined}
        />
        <KpiCard
          label="Vandaag afgerond"
          value={data.vandaagAfgerond}
          icon={<IconCircleCheck />}
          variant="green"
        />
      </div>

      {/* ── Operationele meldingen ────────────────────────────── */}
      {data.meldingen.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-3">Operationele meldingen</h2>
          <div className="space-y-2">
            {data.meldingen.map((m) => (
              <MeldingItem key={m.id} melding={m} />
            ))}
          </div>
        </div>
      )}

      {/* ── Projectoverzicht + Feed ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Projecttabel — 2/3 breed */}
        <div className="xl:col-span-2 bg-white border border-gray-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-900">Projectoverzicht</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/werkbonnen')}>
              Alle projecten →
            </Button>
          </div>
          <ProjectTabel projecten={data.projecten} />
        </div>

        {/* Activity feed — 1/3 breed */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-5">Activiteit vandaag</h2>
          <ActivityFeed activiteit={data.activiteit} />
        </div>

      </div>
    </PageWrapper>
  )
}

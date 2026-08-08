import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useProjecten, statusLabel, statusKleur } from '@/hooks/useProjecten'
import { cn, formatDatumKort } from '@/lib/utils'
import type { ProjectStatus } from '@/types'
import {
  IconPlus, IconSearch, IconMapPin, IconCalendar,
  IconUsers, IconListCheck, IconPhoto, IconChevronRight, IconFolderOpen,
} from '@tabler/icons-react'

const STATUS_FILTERS: { label: string; value: ProjectStatus | 'alle' }[] = [
  { label: 'Alle',         value: 'alle' },
  { label: 'Actief',       value: 'actief' },
  { label: 'Op schema',    value: 'op_schema' },
  { label: 'Vertraging',   value: 'vertraging' },
  { label: 'Niet gestart', value: 'niet_gestart' },
  { label: 'Afgerond',     value: 'afgerond' },
]

export default function Projecten() {
  const navigate = useNavigate()
  const { projecten, loading, error, refetch } = useProjecten()
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'alle'>('alle')
  const [zoek, setZoek] = useState('')

  const gefilterd = projecten.filter((p) => {
    const sOk = statusFilter === 'alle' || p.status === statusFilter
    const zOk =
      !zoek ||
      p.naam.toLowerCase().includes(zoek.toLowerCase()) ||
      p.adres.toLowerCase().includes(zoek.toLowerCase()) ||
      p.opdrachtgever.toLowerCase().includes(zoek.toLowerCase())
    return sOk && zOk
  })

  return (
    <PageWrapper
      title="Projecten"
      actions={
        <Button variant="primary" onClick={() => navigate('/werkbonnen/nieuw')}>
          <IconPlus className="w-4 h-4" /> Nieuw project
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
          <input
            type="text"
            placeholder="Zoek project, adres of opdrachtgever..."
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20"
          />
        </div>
        <div className="flex gap-1 bg-surface-2 dark:bg-white/5 p-1 rounded-sm flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap',
                statusFilter === f.value
                  ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="w-8 h-8" />
        </div>
      ) : error ? (
        <ErrorState
          melding="De projecten konden niet worden geladen. Controleer je verbinding."
          onOpnieuw={refetch}
        />
      ) : gefilterd.length === 0 ? (
        <EmptyState
          icon={<IconFolderOpen />}
          titel={statusFilter !== 'alle' || zoek ? 'Geen projecten gevonden' : 'Nog geen projecten'}
          uitleg={statusFilter !== 'alle' || zoek
            ? 'Er zijn geen projecten die aan je filters voldoen.'
            : 'Bij ons is elke klus een losse werkbon. De synchronisatie maakt daarom geen projecten aan — een ClickUp-taak wordt één werkbon, en meerwerk wordt een aparte bon. Dit scherm is er voor projectmatig werk zodra we dat gaan gebruiken; tot die tijd staat alles bij Werkbonnen.'}
          actie={(statusFilter !== 'alle' || zoek)
            ? <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('alle'); setZoek('') }}>Filters wissen</Button>
            : <Button variant="primary" size="sm" onClick={() => navigate('/werkbonnen')}>Naar werkbonnen</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {gefilterd.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projecten/${project.id}`)}
              className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-brand group"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug group-hover:text-brand-yellow-dark dark:group-hover:text-brand-yellow transition-colors">
                    {project.naam}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-white/60 mt-0.5">{project.opdrachtgever}</p>
                </div>
                <span className={cn('inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-lg border flex-shrink-0', statusKleur(project.status))}>
                  {statusLabel(project.status)}
                </span>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-400 dark:text-white/40 mb-4">
                <span className="flex items-center gap-1">
                  <IconMapPin className="w-3.5 h-3.5" />
                  {project.adres}
                </span>
                <span className="flex items-center gap-1">
                  <IconCalendar className="w-3.5 h-3.5" />
                  {formatDatumKort(project.startdatum)} &ndash; {formatDatumKort(project.einddatum)}
                </span>
              </div>

              {/* Voortgang */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 dark:text-white/40 mb-1.5">
                  <span>Voortgang</span>
                  <span className="font-semibold text-gray-700 dark:text-white/70">{project.voortgang}%</span>
                </div>
                <ProgressBar
                  value={project.voortgang}
                  variant={
                    project.status === 'afgerond'
                      ? 'green'
                      : project.status === 'vertraging'
                      ? 'red'
                      : 'yellow'
                  }
                />
              </div>

              {/* Stats + Medewerkers */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-white/40">
                  <span className="flex items-center gap-1">
                    <IconListCheck className="w-3.5 h-3.5" />
                    {project.aantalTakenKlaar}/{project.aantalTaken}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconPhoto className="w-3.5 h-3.5" />
                    {project.aantalFotos}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconUsers className="w-3.5 h-3.5" />
                    {project.medewerkers.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {project.medewerkers.slice(0, 3).map((m) => (
                    <Avatar key={m.id} naam={m.naam} size="sm" className="w-6 h-6 text-[10px] -ml-1 first:ml-0 border-2 border-white dark:border-surface-dark-2" />
                  ))}
                  {project.medewerkers.length > 3 && (
                    <span className="text-[11px] text-gray-400 dark:text-white/40 ml-1">+{project.medewerkers.length - 3}</span>
                  )}
                  <IconChevronRight className="w-4 h-4 text-gray-300 dark:text-white/30 ml-2 group-hover:text-brand-yellow transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}

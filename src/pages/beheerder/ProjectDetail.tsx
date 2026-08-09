import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useProject, usePlanning, useMedewerkers, statusLabel, statusKleur } from '@/hooks/useProjecten'
import { cn, formatDatum } from '@/lib/utils'
import type { Profile } from '@/types'
import {
  IconArrowLeft, IconMapPin, IconCalendar, IconBuilding,
  IconUsers, IconListCheck, IconPhoto, IconMessageCircle,
  IconUserPlus, IconCheck,
} from '@tabler/icons-react'

type Tab = 'overzicht' | 'planning' | 'fotos' | 'medewerkers' | 'opmerkingen'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overzicht',    label: 'Overzicht',    icon: <IconListCheck className="w-4 h-4" /> },
  { id: 'medewerkers',  label: 'Medewerkers',  icon: <IconUsers className="w-4 h-4" /> },
  { id: 'planning',     label: 'Planning',     icon: <IconCalendar className="w-4 h-4" /> },
  { id: 'fotos',        label: "Foto's",       icon: <IconPhoto className="w-4 h-4" /> },
  { id: 'opmerkingen',  label: 'Opmerkingen',  icon: <IconMessageCircle className="w-4 h-4" /> },
]

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { project, loading: loadingProject, koppelMedewerkers } = useProject(id ?? '')
  const { planning, loading: loadingPlanning } = usePlanning()
  const { medewerkers } = useMedewerkers()
  const [actieveTab, setActieveTab] = useState<Tab>('overzicht')
  const [koppelModal, setKoppelModal] = useState(false)
  const [geselecteerd, setGeselecteerd] = useState<string[]>([])

  if (loadingProject || loadingPlanning) {
    return (
      <PageWrapper title="Project">
        <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  if (!project) {
    return (
      <PageWrapper title="Project">
        <div className="text-center py-16 text-gray-400 dark:text-white/40">Project niet gevonden.</div>
      </PageWrapper>
    )
  }

  const beschikbaar = medewerkers.filter(
    (m) => !project.medewerkers.find((pm) => pm.id === m.id)
  )

  const projectPlanning = planning
    .filter((p) => p.projectId === project.id)
    .sort((a, b) => a.datum.localeCompare(b.datum))

  const toggleSelecteer = (id: string) => {
    setGeselecteerd((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <PageWrapper
      title={project.naam}
      actions={
        <Button variant="ghost" onClick={() => navigate('/projecten')}>
          <IconArrowLeft className="w-4 h-4" /> Terug
        </Button>
      }
    >
      {/* Header kaart */}
      <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{project.naam}</h1>
              <span className={cn('inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg border', statusKleur(project.status))}>
                {statusLabel(project.status)}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-white/60 mb-4">
              <span className="flex items-center gap-1.5">
                <IconMapPin className="w-4 h-4 text-gray-400 dark:text-white/40" /> {project.adres}
              </span>
              <span className="flex items-center gap-1.5">
                <IconBuilding className="w-4 h-4 text-gray-400 dark:text-white/40" /> {project.opdrachtgever}
              </span>
              <span className="flex items-center gap-1.5">
                <IconCalendar className="w-4 h-4 text-gray-400 dark:text-white/40" />
                {formatDatum(project.startdatum)} &ndash; {formatDatum(project.einddatum)}
              </span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-500 dark:text-white/60 font-medium">Voortgang</span>
                <span className="font-bold text-gray-900 dark:text-white">{project.voortgang}%</span>
              </div>
              <ProgressBar
                value={project.voortgang}
                size="md"
                variant={
                  project.status === 'afgerond' ? 'green'
                  : project.status === 'vertraging' ? 'red'
                  : 'yellow'
                }
              />
            </div>
          </div>

          {/* KPI blokken */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 lg:min-w-[280px] min-w-0">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{project.aantalTakenKlaar}</div>
              <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">van {project.aantalTaken} taken</div>
            </div>
            <div className="text-center border-x border-gray-100 dark:border-white/10">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{project.aantalFotos}</div>
              <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">foto&apos;s</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{project.medewerkers.length}</div>
              <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">medewerkers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-lg mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActieveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0',
              actieveTab === tab.id
                ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab inhoud */}
      <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-6">
        {actieveTab === 'overzicht' && (
          <div className="space-y-4">
            <SectionHeading title="Algemene gegevens" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Projectnaam',    value: project.naam },
                { label: 'Opdrachtgever',  value: project.opdrachtgever },
                { label: 'Adres',          value: project.adres },
                { label: 'Status',         value: statusLabel(project.status) },
                { label: 'Startdatum',     value: formatDatum(project.startdatum) },
                { label: 'Einddatum',      value: formatDatum(project.einddatum) },
                { label: 'Werkbonnen',     value: String(project.aantalWerkbonnen) },
                { label: 'Voortgang',      value: `${project.voortgang}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-400 dark:text-white/40 uppercase tracking-wide">{label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {actieveTab === 'medewerkers' && (
          <div>
            <SectionHeading
              title={`Gekoppelde medewerkers (${project.medewerkers.length})`}
              actions={
                <Button variant="primary" size="sm" onClick={() => { setGeselecteerd([]); setKoppelModal(true) }}>
                  <IconUserPlus className="w-4 h-4" /> Koppelen
                </Button>
              }
            />
            {project.medewerkers.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/40 text-center py-8">Nog geen medewerkers gekoppeld.</p>
            ) : (
              <div className="space-y-3">
                {project.medewerkers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                    <Avatar naam={m.naam} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{m.naam}</div>
                      <div className="text-xs text-gray-400 dark:text-white/40">{m.rol}</div>
                    </div>
                    <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 px-2 py-0.5 rounded-md font-medium">
                      Actief
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {actieveTab === 'planning' && (
          <div>
            <SectionHeading
              title="Ingeplande dagen"
              actions={
                <Button variant="ghost" size="sm" onClick={() => navigate('/planning')}>
                  <IconCalendar className="w-4 h-4" /> Weekplanning
                </Button>
              }
            />
            {projectPlanning.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/40 text-center py-8">Nog geen dagen ingepland voor dit project.</p>
            ) : (
              <div className="space-y-3">
                {projectPlanning.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 py-3 border-b border-gray-50 dark:border-white/5 last:border-0">
                    <div className="w-28 text-sm font-semibold text-gray-900 dark:text-white">{formatDatum(item.datum)}</div>
                    <div className="flex-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/60">
                      <IconUsers className="w-3.5 h-3.5 text-gray-400 dark:text-white/40 flex-shrink-0" />
                      {item.medewerkers.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {actieveTab === 'fotos' && (
          <div>
            <SectionHeading title={`Foto's (${project.aantalFotos})`} />
            {project.aantalFotos === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/40 text-center py-8">Nog geen foto&apos;s toegevoegd.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {Array.from({ length: Math.min(project.aantalFotos, 12) }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg bg-gradient-to-br from-brand-yellow-light dark:from-brand-yellow/20 to-brand-yellow border border-brand-yellow/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <IconPhoto className="w-6 h-6 text-brand-yellow-dark dark:text-brand-yellow" />
                  </div>
                ))}
                {project.aantalFotos > 12 && (
                  <div className="aspect-square rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-500 dark:text-white/60">+{project.aantalFotos - 12}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {actieveTab === 'opmerkingen' && (
          <div>
            <SectionHeading title="Opmerkingen" />
            {project.opmerkingen ? (
              <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed whitespace-pre-wrap">
                {project.opmerkingen}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-white/40 text-center py-8">Geen opmerkingen.</p>
            )}
          </div>
        )}
      </div>

      {/* Medewerker koppelen modal */}
      <Modal
        open={koppelModal}
        onClose={() => setKoppelModal(false)}
        title="Medewerkers koppelen"
        size="md"
      >
        <div className="space-y-3 mb-5">
          {beschikbaar.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-white/40 text-center py-4">Alle medewerkers zijn al gekoppeld.</p>
          ) : (
            beschikbaar.map((m) => (
              <div
                key={m.id}
                onClick={() => toggleSelecteer(m.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                  geselecteerd.includes(m.id)
                    ? 'border-brand-yellow bg-brand-yellow-light dark:bg-brand-yellow/10'
                    : 'border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 bg-white dark:bg-surface-dark-2'
                )}
              >
                <Avatar naam={m.naam} size="sm" />
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{m.naam}</span>
                {geselecteerd.includes(m.id) && (
                  <IconCheck className="w-4 h-4 text-brand-yellow-dark" />
                )}
              </div>
            ))
          )}
        </div>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={geselecteerd.length === 0}
          onClick={() => {
            koppelMedewerkers(geselecteerd)
            setGeselecteerd([])
            setKoppelModal(false)
          }}
        >
          {geselecteerd.length === 0
            ? 'Selecteer medewerkers'
            : `${geselecteerd.length} medewerker${geselecteerd.length !== 1 ? 's' : ''} koppelen`}
        </Button>
      </Modal>
    </PageWrapper>
  )
}

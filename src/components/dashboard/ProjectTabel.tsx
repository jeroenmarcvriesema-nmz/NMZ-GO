import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { ProjectRegel } from '@/hooks/useDashboard'
import { IconPhoto, IconListCheck } from '@tabler/icons-react'

interface StatusPilProps {
  status: ProjectRegel['status']
}

function StatusPil({ status }: StatusPilProps) {
  const map = {
    gestart:     { label: 'Bezig',        cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    niet_gestart: { label: 'Niet gestart', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    achter:      { label: 'Achter',       cls: 'bg-red-50 text-red-600 border-red-200' },
    afgerond:    { label: 'Afgerond',     cls: 'bg-green-50 text-green-700 border-green-200' },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn('inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md border', cls)}>
      {label}
    </span>
  )
}

function VoortgangBalk({ value, status }: { value: number; status: ProjectRegel['status'] }) {
  const color = status === 'afgerond' ? 'bg-green-500'
    : status === 'achter' ? 'bg-red-400'
    : 'bg-brand-yellow'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden min-w-[60px]">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-500 w-8 text-right">{value}%</span>
    </div>
  )
}

function formatRelatief(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'Nu'
  if (diff < 60) return `${diff} min geleden`
  const h = Math.floor(diff / 60)
  return `${h} uur geleden`
}

interface ProjectTabelProps {
  projecten: ProjectRegel[]
}

export function ProjectTabel({ projecten }: ProjectTabelProps) {
  const navigate = useNavigate()

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Project</th>
            <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4 hidden md:table-cell">Team</th>
            <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Status</th>
            <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4 min-w-[120px]">Voortgang</th>
            <th className="text-right text-xs font-semibold text-gray-400 pb-3 hidden lg:table-cell">Laatste update</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {projecten.map((p) => (
            <tr
              key={p.id}
              onClick={() => navigate(`/werkbonnen/${p.id}`)}
              className="hover:bg-gray-50/50 cursor-pointer transition-colors"
            >
              <td className="py-3.5 pr-4">
                <div className="font-semibold text-gray-900 text-sm">{p.projectnaam}</div>
                <div className="text-xs text-gray-400 mt-0.5">{p.adres}</div>
                <div className="flex items-center gap-3 mt-1.5 md:hidden">
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <IconListCheck className="w-3 h-3" />
                    {p.aantalTakenKlaar}/{p.aantalTaken}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <IconPhoto className="w-3 h-3" />
                    {p.aantalFotos}
                  </span>
                </div>
              </td>
              <td className="py-3.5 pr-4 hidden md:table-cell">
                <div className="flex flex-col gap-0.5">
                  {p.team.map((naam) => (
                    <span key={naam} className="text-xs text-gray-600">{naam}</span>
                  ))}
                </div>
              </td>
              <td className="py-3.5 pr-4">
                <StatusPil status={p.status} />
              </td>
              <td className="py-3.5 pr-4">
                <VoortgangBalk value={p.voortgang} status={p.status} />
                <div className="flex items-center gap-3 mt-1.5 hidden lg:flex">
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <IconListCheck className="w-3 h-3" />
                    {p.aantalTakenKlaar}/{p.aantalTaken} taken
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <IconPhoto className="w-3 h-3" />
                    {p.aantalFotos} foto's
                  </span>
                </div>
              </td>
              <td className="py-3.5 text-right hidden lg:table-cell">
                <span className="text-xs text-gray-400">{formatRelatief(p.laatsteUpdate)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

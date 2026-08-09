import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { ProjectRegel } from '@/hooks/useDashboard'
import { IconPhoto, IconListCheck, IconChevronRight, IconMapPin } from '@tabler/icons-react'

interface StatusPilProps {
  status: ProjectRegel['status']
}

function StatusPil({ status }: StatusPilProps) {
  const map = {
    gestart:      { label: 'Bezig',        cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' },
    niet_gestart: { label: 'Niet gestart', cls: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10' },
    achter:       { label: 'Achter',       cls: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' },
    afgerond:     { label: 'Afgerond',     cls: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30' },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn(
      'inline-flex items-center whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-md border',
      cls,
    )}>
      {label}
    </span>
  )
}

function balkKleur(status: ProjectRegel['status']): string {
  return status === 'afgerond' ? 'bg-green-500'
    : status === 'achter' ? 'bg-red-400'
    : 'bg-brand-yellow'
}

function VoortgangBalk({ value, status }: { value: number; status: ProjectRegel['status'] }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 min-w-0 bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', balkKleur(status))} style={{ width: `${value}%` }} />
      </div>
      <span className="flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-white/50 w-9 text-right tabular-nums">
        {value}%
      </span>
    </div>
  )
}

function formatRelatief(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'Nu'
  if (diff < 60) return `${diff} min geleden`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h} uur geleden`
  return `${Math.floor(h / 24)} dagen geleden`
}

interface ProjectTabelProps {
  projecten: ProjectRegel[]
}

/**
 * Het overzicht van wat er vandaag loopt.
 *
 * Dit was één tabel, ook op een telefoon. Een tabel heeft een minimale
 * breedte die je niet kunt wegnemen zonder de kolommen onleesbaar te
 * maken, dus schoof het overzicht het scherm uit — dat is wat er buiten
 * de marges viel.
 *
 * Twee opbouwen dus: op een telefoon losse regels waarin alles onder
 * elkaar past en niets afgekapt hoeft te worden, vanaf een breed scherm
 * de tabel die daar juist prettig leest. Geen compromis waarin allebei
 * half werkt.
 */
export function ProjectTabel({ projecten }: ProjectTabelProps) {
  const navigate = useNavigate()

  return (
    <>
      {/* ── Telefoon: regels, geen tabel ── */}
      <div className="md:hidden divide-y divide-gray-50 dark:divide-white/5 -mx-1">
        {projecten.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/werkbonnen/${p.id}`)}
            className="flex items-start gap-2 w-full py-3 px-1 text-left rounded-lg hover:bg-brand-yellow-light/30 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {p.projectnaam}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/40 mt-0.5 min-w-0">
                    <IconMapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{p.adres}</span>
                  </div>
                </div>
                <StatusPil status={p.status} />
              </div>

              {p.team.length > 0 && (
                <div className="text-xs text-gray-400 dark:text-white/40 mt-1 truncate">
                  {p.team.join(', ')}
                </div>
              )}

              <div className="mt-2">
                <VoortgangBalk value={p.voortgang} status={p.status} />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-400 dark:text-white/40">
                <span className="flex items-center gap-1">
                  <IconListCheck className="w-3 h-3 flex-shrink-0" />
                  {p.aantalTakenKlaar}/{p.aantalTaken}
                </span>
                <span className="flex items-center gap-1">
                  <IconPhoto className="w-3 h-3 flex-shrink-0" />
                  {p.aantalFotos}
                </span>
                <span className="truncate">{formatRelatief(p.laatsteUpdate)}</span>
              </div>
            </div>

            <IconChevronRight className="w-4 h-4 flex-shrink-0 mt-1 text-gray-300 dark:text-white/25" />
          </button>
        ))}
      </div>

      {/* ── Laptop: de tabel ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/10">
              <th className="text-left text-xs font-semibold text-gray-400 dark:text-white/40 pb-3 pr-4">Project</th>
              <th className="text-left text-xs font-semibold text-gray-400 dark:text-white/40 pb-3 pr-4">Team</th>
              <th className="text-left text-xs font-semibold text-gray-400 dark:text-white/40 pb-3 pr-4">Status</th>
              <th className="text-left text-xs font-semibold text-gray-400 dark:text-white/40 pb-3 pr-4 min-w-[130px]">Voortgang</th>
              <th className="text-right text-xs font-semibold text-gray-400 dark:text-white/40 pb-3 hidden lg:table-cell">Laatste update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {projecten.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(`/werkbonnen/${p.id}`)}
                className="hover:bg-gray-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <td className="py-4 pr-4 max-w-[18rem]">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{p.projectnaam}</div>
                  <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5 truncate">{p.adres}</div>
                </td>
                <td className="py-4 pr-4 max-w-[12rem]">
                  <div className="flex flex-col gap-0.5">
                    {p.team.map((naam) => (
                      <span key={naam} className="text-xs text-gray-600 dark:text-white/60 truncate">{naam}</span>
                    ))}
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <StatusPil status={p.status} />
                </td>
                <td className="py-4 pr-4">
                  <VoortgangBalk value={p.voortgang} status={p.status} />
                  <div className="hidden lg:flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/40">
                      <IconListCheck className="w-3 h-3" />
                      {p.aantalTakenKlaar}/{p.aantalTaken} taken
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/40">
                      <IconPhoto className="w-3 h-3" />
                      {p.aantalFotos} foto's
                    </span>
                  </div>
                </td>
                <td className="py-4 text-right hidden lg:table-cell whitespace-nowrap">
                  <span className="text-xs text-gray-400 dark:text-white/40">{formatRelatief(p.laatsteUpdate)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

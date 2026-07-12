import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Spinner } from '@/components/ui/Spinner'
import { usePlanning, statusLabel, statusKleur } from '@/hooks/useProjecten'
import { cn, formatDatumKort } from '@/lib/utils'
import { IconUsers, IconMapPin } from '@tabler/icons-react'

function weekDagen(): Date[] {
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)
  const dag = vandaag.getDay()
  const ma = new Date(vandaag)
  ma.setDate(vandaag.getDate() - (dag === 0 ? 6 : dag - 1))
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(ma)
    d.setDate(ma.getDate() + i)
    return d
  })
}

const DAG_NAMEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag']

export default function Planning() {
  const { planning, loading } = usePlanning()
  const navigate = useNavigate()
  const dagen = weekDagen()
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)

  if (loading) {
    return (
      <PageWrapper title="Planning">
        <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Weekplanning">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-white/60">
          Week van{' '}
          <span className="font-semibold text-gray-700 dark:text-white/80">
            {formatDatumKort(dagen[0])} &ndash; {formatDatumKort(dagen[4])}
          </span>
        </p>
      </div>

      {/* Desktop: 5-kolommen grid */}
      <div className="hidden md:grid grid-cols-5 gap-3">
        {dagen.map((dag, i) => {
          const dagStr = dag.toISOString().split('T')[0]
          const isVandaag = dag.getTime() === vandaag.getTime()
          const dagItems = planning.filter((p) => p.datum === dagStr)

          return (
            <div key={i} className="flex flex-col">
              {/* Dag header */}
              <div
                className={cn(
                  'rounded-t-xl px-3 py-2.5 border-b',
                  isVandaag
                    ? 'bg-brand-yellow border-brand-yellow-dark'
                    : 'bg-white dark:bg-surface-dark-2 border-gray-100 dark:border-white/10'
                )}
              >
                <div className={cn('text-sm font-bold', isVandaag ? 'text-gray-900' : 'text-gray-700 dark:text-white/80')}>
                  {DAG_NAMEN[i]}
                </div>
                <div className={cn('text-xs', isVandaag ? 'text-gray-700' : 'text-gray-400 dark:text-white/40')}>
                  {formatDatumKort(dag)}
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 bg-white dark:bg-surface-dark-2 border border-t-0 border-gray-100 dark:border-white/10 rounded-b-xl p-2 space-y-2 min-h-[120px]">
                {dagItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-6">
                    <span className="text-xs text-gray-300 dark:text-white/30">Vrij</span>
                  </div>
                ) : (
                  dagItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/projecten/${item.projectId}`)}
                      className="rounded-lg p-2.5 cursor-pointer hover:opacity-90 transition-all duration-150 border bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20"
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
                          {item.projectnaam}
                        </span>
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0', statusKleur(item.status))}>
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/40 mb-1">
                        <IconMapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{item.adres}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/40">
                        <IconUsers className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{item.medewerkers.join(', ')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: gestapeld per dag */}
      <div className="md:hidden space-y-4">
        {dagen.map((dag, i) => {
          const dagStr = dag.toISOString().split('T')[0]
          const isVandaag = dag.getTime() === vandaag.getTime()
          const dagItems = planning.filter((p) => p.datum === dagStr)

          return (
            <div key={i} className="bg-white dark:bg-surface-dark-2 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
              <div className={cn('px-4 py-3 flex items-center justify-between', isVandaag ? 'bg-brand-yellow' : 'bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10')}>
                <div>
                  <span className={cn('text-sm font-bold', isVandaag ? 'text-gray-900' : 'text-gray-700 dark:text-white/80')}>
                    {DAG_NAMEN[i]}
                  </span>
                  <span className={cn('text-xs ml-2', isVandaag ? 'text-gray-700' : 'text-gray-400 dark:text-white/40')}>
                    {formatDatumKort(dag)}
                  </span>
                </div>
                {dagItems.length > 0 && (
                  <span className="text-xs font-bold bg-white/50 dark:bg-white/10 text-gray-700 dark:text-white/80 px-2 py-0.5 rounded-full">
                    {dagItems.length}
                  </span>
                )}
              </div>
              {dagItems.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-300 dark:text-white/30 text-center">Geen projecten</div>
              ) : (
                dagItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/projecten/${item.projectId}`)}
                    className="px-4 py-3 border-b border-gray-50 dark:border-white/5 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.projectnaam}</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', statusKleur(item.status))}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-white/40">{item.adres}</div>
                    <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{item.medewerkers.join(', ')}</div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </PageWrapper>
  )
}

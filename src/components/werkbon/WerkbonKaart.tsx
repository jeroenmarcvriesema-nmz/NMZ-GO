import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { berekenVoortgang, formatDatumKort } from '@/lib/utils'
import type { Werkbon } from '@/types'
import { IconCalendar, IconUsers, IconListCheck } from '@tabler/icons-react'

interface WerkbonKaartProps {
  werkbon: Werkbon
  linkPrefix?: string
}

export function WerkbonKaart({ werkbon, linkPrefix = '/werkbonnen' }: WerkbonKaartProps) {
  const navigate = useNavigate()
  const voortgang = berekenVoortgang(werkbon.taken || [])
  const voltooide = (werkbon.taken || []).filter((t) => t.voltooid).length
  const totaal    = (werkbon.taken || []).length

  return (
    <Card accent="yellow" onClick={() => navigate(`${linkPrefix}/${werkbon.id}`)}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-base font-bold tracking-tight text-gray-900 dark:text-white">{werkbon.adres}</div>
          <div className="text-sm text-gray-500 dark:text-white/60 mt-0.5">{werkbon.projectnaam}</div>
        </div>
        <StatusBadge status={werkbon.status} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-400 dark:text-white/40 mb-3">
        <span className="flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" />{formatDatumKort(werkbon.datum)}</span>
        {(werkbon.medewerkers || []).length > 0 && (
          <span className="flex items-center gap-1"><IconUsers className="w-3.5 h-3.5" />{werkbon.medewerkers!.map((m) => m.naam).join(', ')}</span>
        )}
        <span className="flex items-center gap-1"><IconListCheck className="w-3.5 h-3.5" />{voltooide}/{totaal} taken</span>
      </div>
      <ProgressBar value={voortgang} variant={voortgang === 100 ? 'green' : 'yellow'} />
      <div className="text-[11px] text-gray-400 dark:text-white/40 font-semibold mt-1">{voortgang}% voltooid</div>
    </Card>
  )
}

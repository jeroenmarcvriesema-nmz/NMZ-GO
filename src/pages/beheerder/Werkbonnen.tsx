import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { WerkbonKaart } from '@/components/werkbon/WerkbonKaart'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import type { WerkbonStatus } from '@/types'

const statusFilters: { label: string; value: WerkbonStatus | 'alle' }[] = [
  { label: 'Alle', value: 'alle' }, { label: 'Open', value: 'open' },
  { label: 'Bezig', value: 'bezig' }, { label: 'Voltooid', value: 'voltooid' },
]

export default function Werkbonnen() {
  const navigate = useNavigate()
  const { werkbonnen, loading } = useWerkbonnen()
  const [statusFilter, setStatusFilter] = useState<WerkbonStatus | 'alle'>('alle')
  const [zoek, setZoek] = useState('')

  const gefilterd = werkbonnen.filter((w) => {
    const sOk = statusFilter === 'alle' || w.status === statusFilter
    const zOk = !zoek || w.adres.toLowerCase().includes(zoek.toLowerCase()) ||
      w.projectnaam.toLowerCase().includes(zoek.toLowerCase()) ||
      (w.medewerkers || []).some((m) => m.naam.toLowerCase().includes(zoek.toLowerCase()))
    return sOk && zOk
  })

  return (
    <PageWrapper title="Werkbonnen" actions={
      <Button variant="primary" onClick={() => navigate('/werkbonnen/nieuw')}>
        <IconPlus className="w-4 h-4" /> Nieuwe werkbon
      </Button>
    }>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
          <input type="text" placeholder="Zoek op adres, project of medewerker…" value={zoek} onChange={(e) => setZoek(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-brand-yellow" />
        </div>
        <div className="flex gap-1.5 bg-surface-2 dark:bg-white/5 p-1 rounded-sm">
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${statusFilter === f.value ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : gefilterd.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-white/40"><div className="text-4xl mb-3">📋</div><div className="font-medium">Geen werkbonnen gevonden</div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gefilterd.map((w) => <WerkbonKaart key={w.id} werkbon={w} />)}
        </div>
      )}
    </PageWrapper>
  )
}

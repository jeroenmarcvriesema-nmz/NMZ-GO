import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { Spinner } from '@/components/ui/Spinner'
import { formatDatum } from '@/lib/utils'
import { IconDownload } from '@tabler/icons-react'

export default function Rapporten() {
  const { werkbonnen, loading } = useWerkbonnen()
  const voltooid = werkbonnen.filter((w) => w.status === 'voltooid')

  return (
    <PageWrapper title="Rapporten">
      <div className="max-w-2xl">
        <Card>
          <div className="text-sm font-bold mb-4">Voltooide werkbonnen ({voltooid.length})</div>
          {loading ? <div className="flex justify-center py-8"><Spinner /></div>
            : voltooid.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">📄</div>
                <div className="font-medium">Nog geen voltooide werkbonnen</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {voltooid.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <div className="text-sm font-semibold">{w.adres}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDatum(w.datum)} · {(w.medewerkers || []).map((m) => m.naam).join(', ') || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={w.status} />
                      <Button variant="secondary" size="sm" onClick={() => alert('PDF export volgt in volgende versie.')}>
                        <IconDownload className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>
    </PageWrapper>
  )
}

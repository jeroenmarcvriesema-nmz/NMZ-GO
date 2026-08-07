import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'
import { Spinner } from '@/components/ui/Spinner'
import { formatDatum } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toastStore'
import { IconDownload, IconFileText } from '@tabler/icons-react'

export default function Rapporten() {
  const { werkbonnen, loading } = useWerkbonnen()
  const voltooid = werkbonnen.filter((w) => w.status === 'voltooid')

  return (
    <PageWrapper title="Rapporten">
      <div className="max-w-2xl">
        <Card>
          <SectionHeading title={`Voltooide werkbonnen (${voltooid.length})`} />
          {loading ? <div className="flex justify-center py-8"><Spinner /></div>
            : voltooid.length === 0 ? (
              <EmptyState
                icon={<IconFileText />}
                titel="Nog geen voltooide werkbonnen"
                uitleg="Zodra een monteur een werkbon afrondt, verschijnt het rapport hier."
              />
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {voltooid.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 py-4 px-2 -mx-2 rounded-lg transition-colors hover:bg-brand-yellow-light/40 dark:hover:bg-white/5">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{w.adres}</div>
                      <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
                        {formatDatum(w.datum)} · {(w.medewerkers || []).map((m) => m.naam).join(', ') || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={w.status} />
                      <Button variant="secondary" size="sm" onClick={() => toast.info('PDF-export volgt in een volgende versie.')}>
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

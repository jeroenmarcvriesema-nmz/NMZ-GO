import { PageWrapper } from '@/components/layout/PageWrapper'
import { WerkbonKaart } from '@/components/werkbon/WerkbonKaart'
import { Spinner } from '@/components/ui/Spinner'
import { useWerkbonnen } from '@/hooks/useWerkbonnen'

export default function Afgerond() {
  const { werkbonnen, loading } = useWerkbonnen()
  const voltooid = werkbonnen.filter((w) => w.status === 'voltooid')

  return (
    <PageWrapper title="Afgerond">
      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : voltooid.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📋</div>
          <div className="font-semibold">Nog geen afgeronde werkbonnen</div>
        </div>
      ) : (
        <div className="space-y-3">
          {voltooid.map((w) => <WerkbonKaart key={w.id} werkbon={w} linkPrefix="/werkbon" />)}
        </div>
      )}
    </PageWrapper>
  )
}

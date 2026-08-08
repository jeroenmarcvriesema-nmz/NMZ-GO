import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// Draaide op verzonnen cijfers (MOCK_PRESTATIES). Nu geteld uit de
// echte tabellen. Drie losse tellingen in plaats van één query: RLS
// zorgt er al voor dat een zwamsaneerder alleen zijn eigen rijen ziet,
// dus het blijven kleine, snelle vragen.

export interface Prestaties {
  werkbonnenAfgerond: number
  werkdagenGewerkt: number
  fotosGemaakt: number
}

const LEEG: Prestaties = { werkbonnenAfgerond: 0, werkdagenGewerkt: 0, fotosGemaakt: 0 }

export function useMijnPrestaties() {
  const { profile } = useAuth()
  const [data, setData] = useState<Prestaties>(LEEG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let afgebroken = false

    const haal = async () => {
      if (!profile) { setLoading(false); return }

      const [bonnen, dagen, fotos] = await Promise.all([
        supabase.from('werkbonnen')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'voltooid'),
        supabase.from('werkdag_logs')
          .select('id', { count: 'exact', head: true })
          .eq('medewerker_id', profile.id),
        supabase.from('fotos')
          .select('id', { count: 'exact', head: true })
          .eq('uploader_id', profile.id),
      ])

      if (afgebroken) return
      setData({
        werkbonnenAfgerond: bonnen.count ?? 0,
        werkdagenGewerkt: dagen.count ?? 0,
        fotosGemaakt: fotos.count ?? 0,
      })
      setLoading(false)
    }

    haal()
    return () => { afgebroken = true }
  }, [profile?.id])

  return { data, loading }
}

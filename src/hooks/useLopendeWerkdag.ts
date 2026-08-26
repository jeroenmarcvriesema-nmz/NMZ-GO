import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ============================================================
// NMZ GO — op welke klus sta ik nu geklokt?
// ============================================================
// `useWerkdag` beantwoordt dezelfde vraag maar andersom: geef mij een
// werkbon, en ik zeg of je daarop geklokt staat. Het scherm Vandaag
// moet het omgekeerde weten vóórdat het een klus kiest — anders kiest
// het er een op de planning, en springt de kaart weg onder de man die
// al aan het werk is.
//
// Eén rij per monteur per werkbon per dag (migratie 006). In de
// praktijk staat er hooguit één open: je klokt uit voor je verkast.
// Staat er toch meer dan één open, dan wint de laatst gestarte — dat
// is waar je nu bent.
// ============================================================

export function useLopendeWerkdag() {
  const { profile } = useAuth()
  const [werkbonId, setWerkbonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let levend = true

    const haal = async () => {
      if (!profile) { setWerkbonId(null); setLoading(false); return }

      const { data } = await supabase
        .from('werkdag_logs')
        .select('werkbon_id, start_tijd')
        .eq('medewerker_id', profile.id)
        .eq('datum', new Date().toISOString().split('T')[0])
        .is('stop_tijd', null)
        .order('start_tijd', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!levend) return
      setWerkbonId((data as { werkbon_id?: string } | null)?.werkbon_id ?? null)
      setLoading(false)
    }

    haal()
    return () => { levend = false }
  }, [profile?.id])

  return { werkbonId, loading }
}

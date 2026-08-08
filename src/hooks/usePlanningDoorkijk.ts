import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Waar werken mijn collega's vandaag? Bewust via de databasefunctie
// planning_overzicht() (migratie 008) en niet via de tabel: die functie
// geeft uitsluitend datum, adres en naam terug. Een zwamsaneerder kan
// dus zien wáár iemand zit — handig om af te stemmen — zonder diens
// werkbon, taken of foto's te kunnen inzien.

export interface PlanningRegel {
  datum: string
  adres: string
  plaats: string | null
  medewerker: string
}

export function usePlanningDoorkijk(van: string, tot: string) {
  const [regels, setRegels] = useState<PlanningRegel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let afgebroken = false

    const haal = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('planning_overzicht', {
        p_van: van,
        p_tot: tot,
      })

      if (afgebroken) return
      if (error) {
        setError(error.message)
        setRegels([])
      } else {
        setError(null)
        setRegels((data as PlanningRegel[]) ?? [])
      }
      setLoading(false)
    }

    haal()
    return () => { afgebroken = true }
  }, [van, tot])

  return { regels, loading, error }
}

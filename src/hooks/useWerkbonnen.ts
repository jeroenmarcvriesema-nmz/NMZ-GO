import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Werkbon } from '@/types'

export function useWerkbonnen() {
  const [werkbonnen, setWerkbonnen] = useState<Werkbon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('werkbonnen')
      .select(`
        *,
        taken(*),
        medewerkers:werkbon_medewerkers(persoon:personen(*))
      `)
      .order('datum', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      const mapped = (data || []).map((w: any) => ({
        ...w,
        medewerkers: (w.medewerkers || []).map((m: any) => m.persoon).filter(Boolean),
      }))
      setWerkbonnen(mapped)
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const verwijder = async (id: string) => {
    const { error } = await supabase.from('werkbonnen').delete().eq('id', id)
    if (!error) setWerkbonnen((prev) => prev.filter((w) => w.id !== id))
    return { error }
  }

  return { werkbonnen, loading, error, refetch: fetch, verwijder }
}

export function useWerkbon(id: string) {
  const [werkbon, setWerkbon] = useState<Werkbon | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * `stil` betekent: haal opnieuw op zonder het scherm leeg te maken.
   *
   * Elke foto en elk vinkje riep hierna `refetch()` aan, en die zette
   * `loading` op waar. Het scherm werd dan vervangen door een spinner en
   * kwam bovenaan terug — je verloor je plek in een lijst van vijftien
   * punten, elke keer opnieuw. Dat zag eruit als een refresh, en dat
   * was het feitelijk ook.
   *
   * Alleen de eerste keer weet je nog niets en hoort er een spinner te
   * staan. Daarna heb je het scherm al; dat mag blijven staan terwijl
   * de nieuwe gegevens onderweg zijn.
   */
  const fetch = async (stil = false) => {
    if (!id) return
    if (!stil) setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('werkbonnen')
      .select(`
        *,
        taken(*, fotos(*)),
        medewerkers:werkbon_medewerkers(persoon:personen(*))
      `)
      .eq('id', id)
      .single()

    // Een mislukte ophaalronde bleef hiervoor stil: het scherm hield de
    // oude gegevens vast en niemand kreeg iets te zien. Een foto die
    // niet verschijnt hoort een melding op te leveren, geen raadsel.
    if (fetchError) {
      setError(fetchError.message)
    } else if (data) {
      setError(null)
      setWerkbon({
        ...data,
        medewerkers: (data.medewerkers || []).map((m: any) => m.persoon).filter(Boolean),
        taken: (data.taken || []).sort((a: any, b: any) => a.volgorde - b.volgorde),
      })
    }
    if (!stil) setLoading(false)
  }

  useEffect(() => { fetch() }, [id])

  return { werkbon, loading, error, refetch: () => fetch(true) }
}

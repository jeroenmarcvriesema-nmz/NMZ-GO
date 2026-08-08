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

  const fetch = async () => {
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('werkbonnen')
      .select(`
        *,
        taken(*, fotos(*)),
        medewerkers:werkbon_medewerkers(persoon:personen(*))
      `)
      .eq('id', id)
      .single()

    if (!error && data) {
      setWerkbon({
        ...data,
        medewerkers: (data.medewerkers || []).map((m: any) => m.persoon).filter(Boolean),
        taken: (data.taken || []).sort((a: any, b: any) => a.volgorde - b.volgorde),
      })
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [id])

  return { werkbon, loading, refetch: fetch }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ── Opmerkingen bij één afvinkpunt ─────────────────────────────
// Het verkeer in de app ging één kant op: de ploeg vinkt af en zet er
// foto's bij, kantoor kijkt ernaar. Wie op zo'n foto iets zag — goed of
// fout — moest bellen, en dat verdween daarmee uit het dossier.
//
// Dit is de terugweg, en hij gaat twee kanten op. Ook de ploeg schrijft
// hier, want een opmerking waar niet op geantwoord kan worden is een
// mededeling.

export interface Puntopmerking {
  id: string
  tekst: string
  created_at: string
  auteur_id: string | null
  auteur: { naam: string | null } | null
}

export function usePuntOpmerkingen(taakId: string, werkbonId: string) {
  const { profile } = useAuth()
  const [opmerkingen, setOpmerkingen] = useState<Puntopmerking[]>([])
  const [laden, setLaden] = useState(true)
  const [bezig, setBezig] = useState(false)

  const haal = useCallback(async () => {
    const { data } = await supabase
      .from('punt_opmerkingen')
      .select('id, tekst, created_at, auteur_id, auteur:profiles ( naam )')
      .eq('taak_id', taakId)
      .order('created_at', { ascending: true })
    setOpmerkingen((data as unknown as Puntopmerking[]) ?? [])
    setLaden(false)
  }, [taakId])

  useEffect(() => { haal() }, [haal])

  /**
   * Een opmerking plaatsen.
   *
   * `tenant_id` en `auteur_id` gaan expliciet mee: de policy eist dat de
   * auteur de ingelogde gebruiker is, en de tenant die van hemzelf.
   * Zonder die twee weigert de database — en dat is de bedoeling.
   */
  const plaats = async (tekst: string): Promise<string | null> => {
    const schoon = tekst.trim()
    if (!schoon || bezig) return null
    if (!profile?.id || !profile?.tenant_id) return 'Je account is niet volledig geladen.'

    setBezig(true)
    const { error } = await supabase.from('punt_opmerkingen').insert({
      taak_id: taakId,
      werkbon_id: werkbonId,
      tenant_id: profile.tenant_id,
      auteur_id: profile.id,
      tekst: schoon,
    })
    setBezig(false)

    if (error) return error.message || 'De opmerking kon niet worden geplaatst.'
    await haal()
    return null
  }

  /** Weghalen kan alleen je eigen tekst; de database bewaakt dat. */
  const verwijder = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('punt_opmerkingen').delete().eq('id', id)
    if (error) return error.message || 'De opmerking kon niet worden verwijderd.'
    await haal()
    return null
  }

  return { opmerkingen, laden, bezig, plaats, verwijder, herlaad: haal }
}

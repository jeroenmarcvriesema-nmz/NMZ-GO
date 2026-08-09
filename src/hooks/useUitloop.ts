import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { dagenUitloop, isoDatum, type Ingepland } from '@/lib/planning'

// ============================================================
// NMZ GO — welke klussen lopen uit
// ============================================================
// De gegevens hiervoor lagen er al: `geplande_eind`, `stilgelegd_op` en
// het gebeurtenissenlogboek. Er was alleen geen scherm dat de vraag
// stelde. Daardoor was uitloop iets wat je pas merkte als een klant
// belde, of als twee ploegen op dezelfde ochtend op hetzelfde adres
// stonden.
//
// Bewust géén nieuwe kolom of nachtelijke berekening: de uitloop volgt
// uit wat er al staat, en een afgeleide waarde die je opslaat is een
// waarde die kan gaan liegen.
// ============================================================

export interface UitloopBon extends Ingepland {
  id: string
  bonnummer: string
  adres: string
  plaats: string | null
  stilgelegd_op: string | null
  stilleg_reden: string | null
  medewerkers: { naam: string }[]
  punten: number
  puntenKlaar: number
  /** Hoeveel dagen deze klus over zijn planning heen is. */
  dagen: number
}

export interface Stillegging {
  id: string
  werkbon_id: string
  soort: string
  reden: string | null
  created_at: string
  adres: string | null
}

export function useUitloop() {
  const [bonnen, setBonnen] = useState<UitloopBon[]>([])
  const [stilgelegd, setStilgelegd] = useState<UitloopBon[]>([])
  const [historie, setHistorie] = useState<Stillegging[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const haal = useCallback(async () => {
    setLoading(true)
    setError(null)
    const nu = isoDatum()

    const { data, error } = await supabase
      .from('werkbonnen')
      .select(`
        id, bonnummer, adres, plaats, datum, status,
        geplande_start, geplande_eind, opgeleverd_op,
        stilgelegd_op, stilleg_reden,
        taken(id, voltooid),
        medewerkers:werkbon_medewerkers(persoon:personen(naam))
      `)
      .is('opgeleverd_op', null)
      .neq('status', 'voltooid')
      .order('geplande_eind', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const rijen: UitloopBon[] = (data ?? []).map((w: any) => {
      const taken = w.taken ?? []
      return {
        ...w,
        medewerkers: (w.medewerkers ?? []).map((m: any) => m.persoon).filter(Boolean),
        punten: taken.length,
        puntenKlaar: taken.filter((t: any) => t.voltooid).length,
        dagen: dagenUitloop(w, nu),
      }
    })

    // Twee lijsten, want het zijn twee verschillende problemen. Een klus
    // die stilligt heeft een reden en wacht op een besluit; een klus die
    // uitloopt heeft dat niet en vraagt om een telefoontje.
    setStilgelegd(rijen.filter((b) => b.stilgelegd_op))
    setBonnen(
      rijen.filter((b) => !b.stilgelegd_op && b.dagen > 0)
           .sort((a, b) => b.dagen - a.dagen),
    )

    // Het logboek erbij: wat is er de afgelopen tijd stilgelegd en
    // waarom. Dat is het patroon waar je iets aan hebt — één keer
    // asbest is pech, vier keer in een maand is een werkwijze.
    const { data: log } = await supabase
      .from('werkbon_gebeurtenissen')
      .select('id, werkbon_id, soort, reden, created_at, werkbon:werkbonnen(adres)')
      .eq('soort', 'stilgelegd')
      .order('created_at', { ascending: false })
      .limit(25)

    setHistorie(((log ?? []) as any[]).map((g) => ({
      id: g.id,
      werkbon_id: g.werkbon_id,
      soort: g.soort,
      reden: g.reden,
      created_at: g.created_at,
      adres: g.werkbon?.adres ?? null,
    })))

    setLoading(false)
  }, [])

  useEffect(() => { void haal() }, [haal])

  return { bonnen, stilgelegd, historie, loading, error, herlaad: haal }
}

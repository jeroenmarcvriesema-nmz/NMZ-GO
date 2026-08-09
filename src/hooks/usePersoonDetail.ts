import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { isoDatum } from '@/lib/planning'
import type { Persoon, Profile } from '@/types'

// ============================================================
// NMZ GO — het dossier van één man
// ============================================================
// De teampagina was een lijst met namen en verder niets. Wie wilde
// weten hoe iemand ervoor staat — hoeveel klussen, hoeveel af, hoeveel
// foto's, wanneer voor het laatst gewerkt — moest dat uit de werkbonnen
// bij elkaar zoeken.
//
// Alles hieronder komt uit gegevens die er al lagen. Er wordt niets
// bijgehouden wat we niet al hadden, en er wordt niets berekend wat een
// oordeel over iemand uitspreekt. Het zijn tellingen, geen scores: wie
// weinig klussen heeft staat niet slecht, die is misschien net begonnen
// of heeft vakantie gehad.
// ============================================================

export interface PersoonStats {
  klussen: number
  lopend: number
  afgerond: number
  punten: number
  puntenKlaar: number
  fotos: number
  urenDezeMaand: number
  laatsteKlusOp: string | null
  laatsteAdres: string | null
  dezeWeek: number
}

export interface PersoonDossier {
  persoon: Persoon
  account: Profile | null
  stats: PersoonStats
  bonnen: {
    id: string
    adres: string
    datum: string
    geplande_start: string | null
    geplande_eind: string | null
    status: string
    opgeleverd_op: string | null
    stilgelegd_op: string | null
    punten: number
    puntenKlaar: number
  }[]
}

const LEEG: PersoonStats = {
  klussen: 0, lopend: 0, afgerond: 0, punten: 0, puntenKlaar: 0,
  fotos: 0, urenDezeMaand: 0, laatsteKlusOp: null, laatsteAdres: null, dezeWeek: 0,
}

export function usePersoonDetail(persoonId: string | undefined) {
  const [dossier, setDossier] = useState<PersoonDossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const haal = useCallback(async () => {
    if (!persoonId) return
    setLoading(true)
    setError(null)

    const { data: persoon, error: pFout } = await supabase
      .from('personen').select('*').eq('id', persoonId).maybeSingle()

    if (pFout || !persoon) {
      setError(pFout?.message ?? 'Deze persoon bestaat niet (meer).')
      setLoading(false)
      return
    }

    const p = persoon as Persoon

    // Het account, als er al een is. Een persoon zonder account is
    // normaal — de planning loopt vooruit op de uitnodigingen.
    let account: Profile | null = null
    if (p.profile_id) {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', p.profile_id).maybeSingle()
      account = (data as Profile) ?? null
    }

    const { data: koppelingen } = await supabase
      .from('werkbon_medewerkers')
      .select(`
        werkbon:werkbonnen(
          id, adres, datum, status, geplande_start, geplande_eind,
          opgeleverd_op, stilgelegd_op,
          taken(id, voltooid, fotos(id))
        )
      `)
      .eq('persoon_id', persoonId)

    const bonnen = ((koppelingen ?? []) as any[])
      .map((k) => k.werkbon)
      .filter(Boolean)
      .map((w: any) => {
        const taken = w.taken ?? []
        return {
          id: w.id,
          adres: w.adres,
          datum: w.datum,
          geplande_start: w.geplande_start,
          geplande_eind: w.geplande_eind,
          status: w.status,
          opgeleverd_op: w.opgeleverd_op,
          stilgelegd_op: w.stilgelegd_op,
          punten: taken.length,
          puntenKlaar: taken.filter((t: any) => t.voltooid).length,
          fotos: taken.flatMap((t: any) => t.fotos ?? []).length,
        }
      })
      .sort((a, b) => (b.geplande_start ?? b.datum).localeCompare(a.geplande_start ?? a.datum))

    // Uren van deze maand, uit de werkdaglogboeken. Alleen als er een
    // account aan hangt: zonder inloggen wordt er geen werkdag gestart.
    let uren = 0
    if (p.profile_id) {
      const eersteVanDeMaand = isoDatum(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
      const { data: logs } = await supabase
        .from('werkdag_logs')
        .select('start_tijd, stop_tijd')
        .eq('medewerker_id', p.profile_id)
        .gte('datum', eersteVanDeMaand)

      for (const log of (logs ?? []) as any[]) {
        if (!log.start_tijd || !log.stop_tijd) continue
        const ms = new Date(log.stop_tijd).getTime() - new Date(log.start_tijd).getTime()
        if (ms > 0) uren += ms / 3_600_000
      }
    }

    const nu = isoDatum()
    const stats: PersoonStats = {
      klussen: bonnen.length,
      afgerond: bonnen.filter((b) => b.status === 'voltooid' || b.opgeleverd_op).length,
      lopend: bonnen.filter((b) => b.status !== 'voltooid' && !b.opgeleverd_op).length,
      punten: bonnen.reduce((n, b) => n + b.punten, 0),
      puntenKlaar: bonnen.reduce((n, b) => n + b.puntenKlaar, 0),
      fotos: bonnen.reduce((n, b) => n + (b as any).fotos, 0),
      urenDezeMaand: Math.round(uren * 10) / 10,
      laatsteKlusOp: bonnen[0]?.geplande_start ?? bonnen[0]?.datum ?? null,
      laatsteAdres: bonnen[0]?.adres ?? null,
      dezeWeek: bonnen.filter((b) => {
        const start = b.geplande_start ?? b.datum
        const eind = b.geplande_eind ?? start
        return start <= nu && eind >= nu
      }).length,
    }

    setDossier({ persoon: p, account, stats: bonnen.length ? stats : { ...LEEG, urenDezeMaand: stats.urenDezeMaand }, bonnen })
    setLoading(false)
  }, [persoonId])

  useEffect(() => { void haal() }, [haal])

  return { dossier, loading, error, herlaad: haal }
}

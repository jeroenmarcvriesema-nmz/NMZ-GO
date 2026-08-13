import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { klusstand, type Klusstand } from '@/lib/klusstand'
import { isoDatum } from '@/lib/planning'

// ============================================================
// NMZ GO — wat er vandaag loopt, in één ophaalronde
// ============================================================
// Het dashboard vertelt hoevéél er loopt en de werkbonnenlijst vertelt
// wélke klussen er zijn, maar voor "wat gebeurt er nu op de vloer"
// moest je elke bon los openslaan. Bij acht lopende klussen is dat acht
// keer klikken en terug, en dan ben je de eerste alweer kwijt.
//
// Dit haalt in één keer op wat er anders achter die acht kliks zit: de
// punten mét hun titel, de foto's, de werktijden en wie er op staat.
// Eén ronde in plaats van acht, en het scherm hoeft niets meer bij te
// halen als je een klus openklapt.
// ============================================================

export interface LopendPunt {
  id: string
  titel: string
  voltooid: boolean
  fotoVereist: boolean
  aantalFotos: number
}

export interface LopendeWerkdag {
  naam: string
  start: string
  stop: string | null
  automatisch: boolean
}

export interface LopendeKlus {
  id: string
  adres: string
  bonnummer: string | null
  kluiscode: string | null
  start: string
  eind: string
  stand: Klusstand
  stillegReden: string | null
  ploeg: string[]
  punten: LopendPunt[]
  aantalFotos: number
  laatsteFoto: string | null
  werkdagen: LopendeWerkdag[]
  /** Er staat nu iemand op deze klus: gestart en nog niet gestopt. */
  looptNu: boolean
}

const SELECT = `
  id, adres, bonnummer, kluiscode, datum, status,
  geplande_start, geplande_eind, stilgelegd_op, stilleg_reden, opgeleverd_op,
  taken ( id, titel, voltooid, foto_vereist, volgorde, fotos ( id ) ),
  fotos!fotos_werkbon_id_fkey ( id, created_at ),
  werkbon_medewerkers ( persoon:personen ( naam ) )
`

/**
 * De klussen die vandaag lopen.
 *
 * "Lopend" is hier de planning en niet de voortgang: alles waarvan
 * vandaag tussen de start- en opleverdatum valt en dat nog niet is
 * afgerond of opgeleverd. Een klus waar nog geen punt van is afgevinkt
 * hoort er dus bij — juist die wil je zien, want daar is misschien nog
 * niemand begonnen.
 *
 * Stilgelegde klussen blijven staan. Ze zijn vandaag gepland en liggen
 * stil; dat is precies het bericht.
 */
export function useLopend() {
  const [klussen, setKlussen] = useState<LopendeKlus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ophalen = useCallback(async () => {
    const vandaag = isoDatum()

    // Twee ronden, want de werkdaglogs hangen aan een andere tabel en
    // een geneste select zou elke bon zijn hele historie meegeven.
    const [bonnenRes, logsRes] = await Promise.all([
      supabase.from('werkbonnen').select(SELECT)
        .is('opgeleverd_op', null)
        .lte('geplande_start', vandaag),
      supabase.from('werkdag_logs')
        .select('werkbon_id, start_tijd, stop_tijd, automatisch_afgesloten, medewerker:profiles ( naam )')
        .eq('datum', vandaag),
    ])

    if (bonnenRes.error || logsRes.error) {
      setError(bonnenRes.error?.message ?? logsRes.error?.message ?? 'Onbekende fout')
      setLoading(false)
      return
    }

    const logsPerBon = new Map<string, LopendeWerkdag[]>()
    for (const l of (logsRes.data ?? []) as any[]) {
      if (!l.werkbon_id) continue
      const lijst = logsPerBon.get(l.werkbon_id) ?? []
      lijst.push({
        naam: l.medewerker?.naam ?? 'Onbekend',
        start: l.start_tijd,
        stop: l.stop_tijd,
        automatisch: Boolean(l.automatisch_afgesloten),
      })
      logsPerBon.set(l.werkbon_id, lijst)
    }

    const rijen: LopendeKlus[] = ((bonnenRes.data ?? []) as any[])
      .filter((w) => {
        // De opleverdatum mag voorbij zijn: een klus die uitloopt loopt
        // nog steeds. Alleen wat af is valt af.
        const stand = klusstand(w)
        return stand !== 'afgerond' && stand !== 'opgeleverd'
      })
      .map((w) => {
        const taken: any[] = [...(w.taken ?? [])].sort(
          (a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0),
        )
        const fotos: any[] = w.fotos ?? []
        const werkdagen = logsPerBon.get(w.id) ?? []

        return {
          id: w.id,
          adres: w.adres ?? '',
          bonnummer: w.bonnummer ?? null,
          kluiscode: w.kluiscode ?? null,
          start: w.geplande_start ?? w.datum,
          eind: w.geplande_eind ?? w.geplande_start ?? w.datum,
          stand: klusstand(w),
          stillegReden: w.stilleg_reden ?? null,
          ploeg: (w.werkbon_medewerkers ?? [])
            .map((wm: any) => wm.persoon?.naam)
            .filter(Boolean),
          punten: taken.map((t) => ({
            id: t.id,
            titel: t.titel ?? '',
            voltooid: Boolean(t.voltooid),
            fotoVereist: t.foto_vereist !== false,
            aantalFotos: (t.fotos ?? []).length,
          })),
          aantalFotos: fotos.length,
          laatsteFoto: fotos.reduce<string | null>(
            (max, f) => (!max || f.created_at > max ? f.created_at : max), null,
          ),
          werkdagen,
          looptNu: werkdagen.some((d) => !d.stop),
        }
      })

    setError(null)
    setKlussen(rijen)
    setLoading(false)
  }, [])

  useEffect(() => { ophalen() }, [ophalen])

  return { klussen, loading, error, refetch: ophalen }
}

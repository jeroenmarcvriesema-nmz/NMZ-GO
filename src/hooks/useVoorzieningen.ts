import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { leesVoorzieningen, type Voorziening } from '@/lib/voorzieningen'
import { isoDatum } from '@/lib/planning'

// ============================================================
// NMZ GO — welke containers en dixi's er besteld en afgemeld moeten
// ============================================================
// Beide worden bij een derde partij besteld, staan op een adres, en
// moeten na afloop weer weg. Wát er nodig is staat in de
// werkvoorbereiding van de opdracht; wat er al gedáán is staat in
// `werkbon_voorzieningen` (migratie 033). Zonder dat tweede blijft het
// een lijst die elke ochtend opnieuw doorgelopen moet worden, en dan
// belt de een de verhuurder voor de tweede keer terwijl de ander denkt
// dat het geregeld was.
//
// Eén regel per voorziening en niet per klus. Een container en een dixi
// zijn twee bestellingen met elk hun eigen moment: de container kan
// besteld zijn terwijl de dixi nog moet, en de dixi kan al afgemeld
// zijn terwijl de container er nog staat. Per klus groeperen zou die
// twee door elkaar halen.
// ============================================================

export type Soort = 'container' | 'dixi'

export interface VoorzieningRegel {
  /** Uniek per klus én soort, want een klus levert er twee. */
  sleutel: string
  werkbonId: string
  soort: Soort
  adres: string
  bonnummer: string | null
  start: string
  eind: string
  /** Wat de werkopdracht erover zegt. */
  wat: Voorziening
  besteldOp: string | null
  afgemeldOp: string | null
  /** Dagen tot de startdatum. Negatief betekent: al begonnen. */
  dagenTotStart: number
  /** Dagen sinds de opleverdatum. Negatief betekent: nog niet zover. */
  dagenNaEind: number
  stilgelegd: boolean
}

export interface Voorzieningenlijst {
  /** De opleverdatum is bereikt en er staat nog iets. Kost huur. */
  afmelden: VoorzieningRegel[]
  /** Moet nog geleverd worden vóór de eerste werkdag. */
  bestellen: VoorzieningRegel[]
  /** Besteld en nog niet afgemeld. Hier kun je vervroegd afmelden. */
  staatEr: VoorzieningRegel[]
  loading: boolean
  error: string | null
  /** Zet of haalt een stempel, en werkt de lijst meteen bij. */
  stempel: (r: VoorzieningRegel, wat: 'besteld' | 'afgemeld', aan: boolean) => Promise<string | null>
}

/** Hoe ver vooruit we kijken voor "moet nog besteld worden". */
const DAGEN_VOORUIT = 10

function dagenTussen(van: string, tot: string): number {
  return Math.round(
    (Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) / 86_400_000,
  )
}

export function useVoorzieningen(): Voorzieningenlijst {
  const [regels, setRegels] = useState<VoorzieningRegel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ophalen = useCallback(async () => {
    const [bonnenRes, stempelsRes] = await Promise.all([
      supabase.from('werkbonnen')
        .select('id, adres, bonnummer, datum, geplande_start, geplande_eind, werkvoorbereiding, stilgelegd_op')
        .is('opgeleverd_op', null),
      supabase.from('werkbon_voorzieningen')
        .select('werkbon_id, soort, besteld_op, afgemeld_op'),
    ])

    if (bonnenRes.error || stempelsRes.error) {
      setError(bonnenRes.error?.message ?? stempelsRes.error?.message ?? 'Onbekende fout')
      setLoading(false)
      return
    }

    const stempels = new Map<string, { besteld_op: string | null; afgemeld_op: string | null }>()
    for (const s of (stempelsRes.data ?? []) as any[]) {
      stempels.set(`${s.werkbon_id}:${s.soort}`, s)
    }

    const vandaag = isoDatum()
    const uit: VoorzieningRegel[] = []

    for (const w of (bonnenRes.data ?? []) as any[]) {
      const start = w.geplande_start ?? w.datum
      const eind = w.geplande_eind ?? start
      const gelezen = leesVoorzieningen(w.werkvoorbereiding)

      for (const soort of ['container', 'dixi'] as Soort[]) {
        const wat = gelezen[soort]
        // Alleen wat de opdracht echt vraagt. "Niet vermeld" hoort hier
        // niet: dan zou de lijst zich vullen met klussen waarvan we het
        // simpelweg niet weten, en is een volle lijst geen signaal meer.
        if (wat.nodig !== 'ja') continue

        const stempel = stempels.get(`${w.id}:${soort}`)
        uit.push({
          sleutel: `${w.id}:${soort}`,
          werkbonId: w.id,
          soort,
          adres: w.adres ?? '',
          bonnummer: w.bonnummer ?? null,
          start,
          eind,
          wat,
          besteldOp: stempel?.besteld_op ?? null,
          afgemeldOp: stempel?.afgemeld_op ?? null,
          dagenTotStart: dagenTussen(vandaag, start),
          dagenNaEind: dagenTussen(eind, vandaag),
          stilgelegd: Boolean(w.stilgelegd_op),
        })
      }
    }

    setError(null)
    setRegels(uit)
    setLoading(false)
  }, [])

  useEffect(() => { ophalen() }, [ophalen])

  const stempel = useCallback(async (
    r: VoorzieningRegel,
    wat: 'besteld' | 'afgemeld',
    aan: boolean,
  ): Promise<string | null> => {
    // Meteen op het scherm, en pas daarna de bevestiging. Wie tien
    // regels afvinkt hoort niet tussen elke tik op de database te
    // wachten; gaat het mis, dan draait de ophaalronde hieronder het
    // terug én zeggen we waarom.
    setRegels((huidig) => huidig.map((x) => x.sleutel !== r.sleutel ? x : {
      ...x,
      besteldOp: wat === 'besteld' ? (aan ? new Date().toISOString() : null) : x.besteldOp,
      afgemeldOp: wat === 'afgemeld' ? (aan ? new Date().toISOString() : null) : x.afgemeldOp,
    }))

    const { error: fout } = await supabase.rpc('voorziening_stempelen', {
      p_werkbon: r.werkbonId,
      p_soort: r.soort,
      p_wat: wat,
      p_aan: aan,
    })

    if (fout) {
      await ophalen()
      return fout.message || 'Dat kon niet worden opgeslagen.'
    }
    return null
  }, [ophalen])

  // Drie stapels, en ze sluiten elkaar uit. Een voorziening staat op
  // precies één plek, zodat afvinken hem zichtbaar naar de volgende
  // stapel verplaatst in plaats van hem twee keer te laten staan.
  const open = regels.filter((r) => !r.afgemeldOp)

  const afmelden = open
    .filter((r) => r.dagenNaEind >= 0)
    .sort((a, b) => b.dagenNaEind - a.dagenNaEind)

  const bestellen = open
    .filter((r) => r.dagenNaEind < 0 && !r.besteldOp && r.dagenTotStart <= DAGEN_VOORUIT)
    .sort((a, b) => a.dagenTotStart - b.dagenTotStart)

  const staatEr = open
    .filter((r) => r.dagenNaEind < 0 && r.besteldOp)
    .sort((a, b) => a.dagenNaEind - b.dagenNaEind)

  return { afmelden, bestellen, staatEr, loading, error, stempel }
}

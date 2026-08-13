import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { leesVoorzieningen, type Voorziening } from '@/lib/voorzieningen'
import { isoDatum } from '@/lib/planning'

// ============================================================
// NMZ GO — welke containers en dixi's er besteld en afgemeld moeten
// ============================================================
// Beide worden bij een derde partij besteld, staan op een adres, en
// moeten na afloop weer weg. Tot nu toe stond dat alleen in de
// werkvoorbereiding van de opdracht — een lap tekst per klus, die je
// per bon moest openslaan om te zien of er iets besteld moest worden.
//
// Twee momenten tellen, en het zijn er precies twee:
//
//   1. Vóór de startdatum: bestellen. Een container die op dag één niet
//      staat, kost een dag.
//   2. Op de opleverdatum: afmelden. Een container die blijft staan
//      kost huur per dag, en een dixi net zo.
//
// Alles hier wordt uit de bestaande tekst gelezen; er is geen veld voor
// en geen invoer bij. Dat is bewust: de werkvoorbereider vult het al in
// ClickUp in, en hem het twee keer laten opschrijven is een garantie
// dat het op een dag niet meer overeenkomt.
// ============================================================

export interface VoorzieningRegel {
  id: string
  adres: string
  bonnummer: string | null
  start: string
  eind: string
  container: Voorziening
  dixi: Voorziening
  /** Dagen tot de startdatum. Negatief betekent: al begonnen. */
  dagenTotStart: number
  /** Dagen sinds de opleverdatum. Negatief betekent: nog niet zover. */
  dagenNaEind: number
  stilgelegd: boolean
}

export interface Voorzieningenlijst {
  /** Moet vandaag of eerder weg: de klus is op zijn opleverdatum. */
  afmelden: VoorzieningRegel[]
  /** Moet nog geleverd worden: de klus begint binnenkort of vandaag. */
  bestellen: VoorzieningRegel[]
  loading: boolean
  error: string | null
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

  useEffect(() => {
    let levend = true

    supabase
      .from('werkbonnen')
      .select('id, adres, bonnummer, datum, geplande_start, geplande_eind, werkvoorbereiding, stilgelegd_op')
      .is('opgeleverd_op', null)
      .then(({ data, error: fout }) => {
        if (!levend) return
        if (fout) { setError(fout.message); setLoading(false); return }

        const vandaag = isoDatum()

        setRegels(((data ?? []) as any[]).map((w) => {
          const start = w.geplande_start ?? w.datum
          const eind = w.geplande_eind ?? start
          const { container, dixi } = leesVoorzieningen(w.werkvoorbereiding)

          return {
            id: w.id,
            adres: w.adres ?? '',
            bonnummer: w.bonnummer ?? null,
            start,
            eind,
            container,
            dixi,
            dagenTotStart: dagenTussen(vandaag, start),
            dagenNaEind: dagenTussen(eind, vandaag),
            stilgelegd: Boolean(w.stilgelegd_op),
          }
        }))
        setError(null)
        setLoading(false)
      })

    return () => { levend = false }
  }, [])

  // Alleen klussen waar iets te bestellen valt. "Niet vermeld" telt
  // hier niet mee: dat zou de lijst vullen met klussen waarvan we het
  // gewoon niet weten, en dan is een volle lijst geen signaal meer.
  const heeftIets = (r: VoorzieningRegel) =>
    r.container.nodig === 'ja' || r.dixi.nodig === 'ja'

  const afmelden = regels
    .filter((r) => heeftIets(r) && r.dagenNaEind >= 0)
    .sort((a, b) => b.dagenNaEind - a.dagenNaEind)

  // Wat al afgemeld moet worden hoeft niet ook nog besteld te worden.
  const bestellen = regels
    .filter((r) => heeftIets(r) && r.dagenNaEind < 0 && r.dagenTotStart <= DAGEN_VOORUIT)
    .sort((a, b) => a.dagenTotStart - b.dagenTotStart)

  return { afmelden, bestellen, loading, error }
}

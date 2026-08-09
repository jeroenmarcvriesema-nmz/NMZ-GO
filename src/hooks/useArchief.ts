import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================================
// NMZ GO — terugzoeken op adres
// ============================================================
// De vraag die kantoor stelt is altijd dezelfde: "we hebben daar vorig
// jaar wat gedaan, wat was dat en heb je foto's?" Tot nu toe was het
// antwoord een zoektocht door ClickUp-bijlagen.
//
// Het zoeken gebeurt aan de kant van de database, niet in de browser.
// Nu zijn het achtentwintig bonnen; over twee jaar zijn het er
// duizenden, en dan is "alles ophalen en filteren" op een werktelefoon
// geen optie meer. Het adres is de ingang omdat dat is waar iemand naar
// vraagt — niet het bonnummer, dat kent niemand uit zijn hoofd.
// ============================================================

export interface ArchiefFoto {
  id: string
  storage_path: string
  bestandsnaam: string | null
  created_at: string
  fase: string | null
}

export interface ArchiefPunt {
  id: string
  titel: string
  omschrijving: string | null
  voltooid: boolean
  opmerking: string | null
  volgorde: number
  fotos: ArchiefFoto[]
}

export interface ArchiefBon {
  id: string
  bonnummer: string
  adres: string
  postcode: string | null
  plaats: string | null
  opdrachtnummer: string | null
  datum: string
  geplande_start: string | null
  geplande_eind: string | null
  status: string
  opgeleverd_op: string | null
  inspecteur: string | null
  werkvoorbereiding: string | null
  taken: ArchiefPunt[]
  medewerkers: { naam: string }[]
}

const VELDEN = `
  id, bonnummer, adres, postcode, plaats, opdrachtnummer, datum,
  geplande_start, geplande_eind, status, opgeleverd_op, inspecteur,
  werkvoorbereiding,
  taken(id, titel, omschrijving, voltooid, opmerking, volgorde,
        fotos(id, storage_path, bestandsnaam, created_at, fase)),
  medewerkers:werkbon_medewerkers(persoon:personen(naam))
`

export function useArchief() {
  const [resultaten, setResultaten] = useState<ArchiefBon[]>([])
  const [loading, setLoading] = useState(false)
  const [gezocht, setGezocht] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const zoek = useCallback(async (term: string) => {
    const schoon = term.trim()

    // Onder de twee tekens levert een zoekopdracht de halve database op
    // en zegt hij niets. Dan wachten we gewoon.
    if (schoon.length < 2) {
      setResultaten([])
      setGezocht(false)
      return
    }

    setLoading(true)
    setError(null)

    // Op adres én op plaats: "Bentinckstraat" en "Den Haag" zijn allebei
    // manieren waarop iemand het opzoekt. Het opdrachtnummer erbij,
    // want dat staat op de papieren die soms wél voorhanden zijn.
    const patroon = `%${schoon}%`
    const { data, error } = await supabase
      .from('werkbonnen')
      .select(VELDEN)
      .or(`adres.ilike.${patroon},plaats.ilike.${patroon},opdrachtnummer.ilike.${patroon}`)
      .order('datum', { ascending: false })
      .limit(50)

    if (error) {
      setError(error.message)
      setResultaten([])
    } else {
      setResultaten((data ?? []).map((w: any) => ({
        ...w,
        taken: (w.taken ?? []).sort((a: any, b: any) => a.volgorde - b.volgorde),
        medewerkers: (w.medewerkers ?? []).map((m: any) => m.persoon).filter(Boolean),
      })) as ArchiefBon[])
    }

    setGezocht(true)
    setLoading(false)
  }, [])

  return { resultaten, loading, gezocht, error, zoek }
}

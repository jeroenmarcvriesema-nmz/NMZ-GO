import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project, PlanningItem, Persoon, Profile, ProjectStatus } from '@/types'

// Eén genest select levert alles wat een projectkaart nodig heeft.
// De aggregaties (voortgang, aantallen) worden client-side berekend:
// het gaat om tientallen rijen, niet duizenden, en dit houdt de hook
// leesbaar zonder database-view of RPC.
const PROJECT_SELECT = `
  *,
  werkbonnen (
    id, datum, adres, status,
    taken ( id, voltooid ),
    fotos!fotos_werkbon_id_fkey ( id ),
    werkbon_medewerkers ( persoon:personen(*) )
  )
`

function mapProject(row: any): Project {
  const werkbonnen: any[] = row.werkbonnen || []

  const taken = werkbonnen.flatMap((w) => w.taken || [])
  const aantalTaken = taken.length
  const aantalTakenKlaar = taken.filter((t: any) => t.voltooid).length

  // Dezelfde medewerker kan op meerdere werkbonnen van hetzelfde
  // project staan — ontdubbelen op id.
  const medewerkers: Profile[] = Object.values(
    werkbonnen
      .flatMap((w) => w.werkbon_medewerkers || [])
      .map((wm: any) => wm.persoon)
      .filter(Boolean)
      .reduce((acc: Record<string, Profile>, m: Profile) => {
        acc[m.id] = m
        return acc
      }, {})
  )

  return {
    id: row.id,
    naam: row.naam ?? '',
    adres: row.adres ?? '',
    opdrachtgever: row.opdrachtgever ?? '',
    status: row.status as ProjectStatus,
    startdatum: row.startdatum ?? '',
    einddatum: row.einddatum ?? '',
    opmerkingen: row.opmerkingen ?? '',
    voortgang: aantalTaken > 0 ? Math.round((aantalTakenKlaar / aantalTaken) * 100) : 0,
    medewerkers,
    aantalWerkbonnen: werkbonnen.length,
    aantalTaken,
    aantalTakenKlaar,
    aantalFotos: werkbonnen.reduce((n, w) => n + (w.fotos?.length || 0), 0),
  }
}

export function useProjecten() {
  const [projecten, setProjecten] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projecten')
      .select(PROJECT_SELECT)
      .order('startdatum', { ascending: false, nullsFirst: false })

    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setProjecten((data || []).map(mapProject))
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return { projecten, loading, error, refetch: fetch }
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = async () => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('projecten')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .single()

    if (error) {
      setError(error.message)
      setProject(null)
    } else {
      setError(null)
      setProject(data ? mapProject(data) : null)
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [id])

  // Let op: medewerkers hangen in het datamodel aan een wérkbon, niet
  // aan een project (zie 001_initial.sql). "Koppelen aan een project"
  // betekent daarom: koppelen aan alle werkbonnen van dat project.
  // Heeft het project nog geen werkbonnen, dan is er niets om aan te
  // koppelen en geeft deze functie een fout terug.
  const koppelMedewerkers = async (medewerkerIds: string[]) => {
    if (!project || medewerkerIds.length === 0) return { error: null }

    const { data: werkbonnen, error: werkbonError } = await supabase
      .from('werkbonnen')
      .select('id')
      .eq('project_id', project.id)

    if (werkbonError) return { error: werkbonError.message }

    if (!werkbonnen || werkbonnen.length === 0) {
      return { error: 'Dit project heeft nog geen werkbonnen om medewerkers aan te koppelen.' }
    }

    const rijen = werkbonnen.flatMap((w) =>
      medewerkerIds.map((medewerkerId) => ({
        werkbon_id: w.id,
        persoon_id: medewerkerId,
        // Door een mens gezet, dus de synchronisatie laat hem staan.
        handmatig: true,
      }))
    )

    // Bestaande koppelingen negeren in plaats van als fout behandelen —
    // de primary key op (werkbon_id, persoon_id) vangt duplicaten af.
    const { error: insertError } = await supabase
      .from('werkbon_medewerkers')
      .upsert(rijen, { onConflict: 'werkbon_id,persoon_id', ignoreDuplicates: true })

    if (insertError) return { error: insertError.message }

    await fetch()
    return { error: null }
  }

  return { project, loading, error, refetch: fetch, koppelMedewerkers }
}

// De ploeg om uit te kiezen bij het toewijzen.
//
// Dit leest personen en niet profiles: een naam kan op een klus staan
// zonder dat er een account bij hoort. Dat is bij ons de normale
// toestand — van de tweeëndertig namen in ClickUp heeft de meerderheid
// nog nooit ingelogd, en ze moeten wél ingepland kunnen worden.
//
// Alleen actieve mensen: wie uit dienst is hoort niet in een
// koppellijst te staan.
export function useMedewerkers() {
  const [medewerkers, setMedewerkers] = useState<Persoon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('personen')
        .select('*')
        .eq('actief', true)
        .order('naam')

      if (error) setError(error.message)
      else { setError(null); setMedewerkers(data || []) }
      setLoading(false)
    }
    fetch()
  }, [])

  return { medewerkers, loading, error }
}

// De planning wordt afgeleid uit werkbonnen: elke werkbon met een datum
// die aan een project hangt, is één regel in de weekplanning.
export function usePlanning() {
  const [planning, setPlanning] = useState<PlanningItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('werkbonnen')
        .select(`
          id, datum, adres,
          project:projecten ( id, naam, status ),
          werkbon_medewerkers ( persoon:personen(naam) )
        `)
        .not('project_id', 'is', null)
        .order('datum', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setError(null)
        setPlanning(
          (data || [])
            .filter((w: any) => w.project)
            .map((w: any) => ({
              id: w.id,
              datum: w.datum,
              projectId: w.project.id,
              projectnaam: w.project.naam ?? '',
              adres: w.adres ?? '',
              medewerkers: (w.werkbon_medewerkers || [])
                .map((wm: any) => wm.persoon?.naam)
                .filter(Boolean),
              status: w.project.status as ProjectStatus,
            }))
        )
      }
      setLoading(false)
    }
    fetch()
  }, [])

  return { planning, loading, error }
}

export function statusLabel(s: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    actief: 'Actief',
    niet_gestart: 'Niet gestart',
    op_schema: 'Op schema',
    vertraging: 'Vertraging',
    afgerond: 'Afgerond',
  }
  return map[s]
}

export function statusKleur(s: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    actief: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    niet_gestart: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/50 border-gray-200 dark:border-white/10',
    op_schema: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
    vertraging: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30',
    afgerond: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-400 border-green-300 dark:border-green-500/30',
  }
  return map[s]
}

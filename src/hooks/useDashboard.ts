import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Dashboard ──────────────────────────────────────────────────
// Draaide tot nu toe op mock data. Nu op de echte tabellen:
// werkbonnen van vandaag, hun taken en foto's, en de werkdag_logs
// uit migratie 006.
//
// De aggregaties gebeuren client-side. Het gaat om de werkbonnen van
// één dag — tientallen rijen, geen duizenden — en dat houdt de regels
// waarmee "achter op schema" wordt bepaald leesbaar op één plek,
// zonder database-view of RPC.

export interface ProjectRegel {
  id: string
  projectnaam: string
  adres: string
  team: string[]
  status: 'gestart' | 'niet_gestart' | 'achter' | 'afgerond'
  voortgang: number             // 0-100
  aantalFotos: number
  aantalTaken: number
  aantalTakenKlaar: number
  laatsteUpdate: string | null  // ISO timestamp
}

export interface Melding {
  id: string
  type: 'niet_gestart' | 'geen_fotos' | 'controle' | 'afgerond'
  tekst: string
  project: string
  tijd: string
}

export interface Activiteit {
  id: string
  tijd: string   // "07:03"
  tekst: string
  type: 'start' | 'fotos' | 'afgerond' | 'info'
}

export interface DashboardData {
  actieveProjecten: number
  vandaagGestart: number
  nogNietGestart: number
  achterOpSchema: number
  vandaagAfgerond: number
  projecten: ProjectRegel[]
  meldingen: Melding[]
  activiteit: Activiteit[]
}

const LEEG: DashboardData = {
  actieveProjecten: 0,
  vandaagGestart: 0,
  nogNietGestart: 0,
  achterOpSchema: 0,
  vandaagAfgerond: 0,
  projecten: [],
  meldingen: [],
  activiteit: [],
}

// ── Regels ─────────────────────────────────────────────────────
// Deze drempels bepalen wanneer het dashboard alarm slaat. Ze staan
// hier bij elkaar zodat ze te verantwoorden en te verstellen zijn,
// in plaats van verstopt in een voorwaarde ergens onderin.

/** Vanaf dit tijdstip telt "nog niet gestart" als aandachtspunt. */
const START_VERWACHT_UUR = 8

/** Zo lang mag een monteur bezig zijn zonder één foto. */
const UREN_ZONDER_FOTO = 1

/** Na zoveel uur bezig verwacht het dashboard zichtbare voortgang. */
const UREN_VOOR_VOORTGANG = 2

/** Minder dan dit deel van de taken klaar na bovenstaande tijd = achter. */
const VOORTGANG_DREMPEL = 0.5

const SELECT = `
  id, projectnaam, adres, status, datum, updated_at,
  taken ( id, voltooid ),
  fotos!fotos_werkbon_id_fkey ( id, created_at ),
  werkbon_medewerkers ( persoon:personen ( id, naam ) )
`

function tijdKort(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function urenSinds(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000
}

export function useDashboard(): { data: DashboardData; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<DashboardData>(LEEG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    const vandaag = new Date().toISOString().split('T')[0]

    const [bonnenRes, logsRes] = await Promise.all([
      supabase.from('werkbonnen').select(SELECT).eq('datum', vandaag),
      supabase.from('werkdag_logs')
        .select('werkbon_id, start_tijd, stop_tijd, medewerker:profiles ( naam )')
        .eq('datum', vandaag),
    ])

    if (bonnenRes.error || logsRes.error) {
      setError(bonnenRes.error?.message ?? logsRes.error?.message ?? 'Onbekende fout')
      setLoading(false)
      return
    }

    const bonnen: any[] = bonnenRes.data || []
    const logs: any[] = logsRes.data || []

    // Vroegste start per werkbon: als twee monteurs op dezelfde bon
    // staan, telt het moment waarop de eerste begon.
    const startPerBon = new Map<string, string>()
    logs.forEach((l) => {
      if (!l.werkbon_id) return
      const huidig = startPerBon.get(l.werkbon_id)
      if (!huidig || l.start_tijd < huidig) startPerBon.set(l.werkbon_id, l.start_tijd)
    })

    const projecten: ProjectRegel[] = bonnen.map((b) => {
      const taken: any[] = b.taken || []
      const fotos: any[] = b.fotos || []
      const aantalTaken = taken.length
      const aantalTakenKlaar = taken.filter((t) => t.voltooid).length
      const voortgang = aantalTaken > 0 ? Math.round((aantalTakenKlaar / aantalTaken) * 100) : 0

      const gestartOp = startPerBon.get(b.id) ?? null
      const laatsteFoto = fotos.reduce<string | null>(
        (max, f) => (!max || f.created_at > max ? f.created_at : max), null
      )

      let status: ProjectRegel['status']
      if (b.status === 'voltooid') {
        status = 'afgerond'
      } else if (!gestartOp) {
        status = 'niet_gestart'
      } else if (
        urenSinds(gestartOp) >= UREN_VOOR_VOORTGANG &&
        aantalTaken > 0 &&
        aantalTakenKlaar / aantalTaken < VOORTGANG_DREMPEL
      ) {
        status = 'achter'
      } else {
        status = 'gestart'
      }

      return {
        id: b.id,
        projectnaam: b.projectnaam || '',
        adres: b.adres || '',
        team: (b.werkbon_medewerkers || [])
          .map((wm: any) => wm.persoon?.naam)
          .filter(Boolean),
        status,
        voortgang,
        aantalFotos: fotos.length,
        aantalTaken,
        aantalTakenKlaar,
        // De laatste foto zegt meer over "leeft dit nog" dan de
        // starttijd; valt daarop terug zolang er geen foto's zijn.
        laatsteUpdate: laatsteFoto ?? gestartOp,
      }
    })

    // ── Meldingen ────────────────────────────────────────────────
    const meldingen: Melding[] = []
    const naVerwachteStart = new Date().getHours() >= START_VERWACHT_UUR

    projecten.forEach((p) => {
      if (p.status === 'niet_gestart' && naVerwachteStart) {
        meldingen.push({
          id: `niet-gestart-${p.id}`, type: 'niet_gestart',
          tekst: 'Nog niet gestart', project: p.adres,
          tijd: `${String(START_VERWACHT_UUR).padStart(2, '0')}:00`,
        })
      }

      const gestartOp = startPerBon.get(p.id)
      if (gestartOp && p.aantalFotos === 0 && urenSinds(gestartOp) >= UREN_ZONDER_FOTO && p.status !== 'afgerond') {
        meldingen.push({
          id: `geen-fotos-${p.id}`, type: 'geen_fotos',
          tekst: "Geen foto's ontvangen", project: p.adres,
          tijd: tijdKort(gestartOp),
        })
      }

      if (p.status === 'achter') {
        meldingen.push({
          id: `achter-${p.id}`, type: 'controle',
          tekst: 'Achter op schema', project: p.adres,
          tijd: gestartOp ? tijdKort(gestartOp) : '—',
        })
      }
    })

    bonnen
      .filter((b) => b.status === 'voltooid')
      .forEach((b) => {
        meldingen.push({
          id: `afgerond-${b.id}`, type: 'afgerond',
          tekst: 'Werkbon afgerond', project: b.adres || '',
          tijd: b.updated_at ? tijdKort(b.updated_at) : '—',
        })
      })

    meldingen.sort((a, z) => a.tijd.localeCompare(z.tijd))

    // ── Activiteit ───────────────────────────────────────────────
    const adresPerBon = new Map<string, string>(bonnen.map((b) => [b.id, b.adres || '']))
    const activiteit: Activiteit[] = []

    logs.forEach((l, i) => {
      const naam = l.medewerker?.naam ?? 'Een monteur'
      const adres = l.werkbon_id ? adresPerBon.get(l.werkbon_id) ?? '' : ''
      activiteit.push({
        id: `start-${i}`, tijd: tijdKort(l.start_tijd), type: 'start',
        tekst: adres ? `${naam} gestart op ${adres}` : `${naam} gestart`,
      })
    })

    // Foto's per werkbon samenvatten: acht losse regels "foto
    // toegevoegd" verdringen alles wat er verder gebeurde.
    bonnen.forEach((b) => {
      const fotos: any[] = b.fotos || []
      if (!fotos.length) return
      const laatste = fotos.reduce((max: string, f: any) => (f.created_at > max ? f.created_at : max), fotos[0].created_at)
      activiteit.push({
        id: `fotos-${b.id}`, tijd: tijdKort(laatste), type: 'fotos',
        tekst: `${fotos.length} ${fotos.length === 1 ? 'foto' : "foto's"} toegevoegd — ${b.adres || ''}`,
      })
    })

    bonnen
      .filter((b) => b.status === 'voltooid' && b.updated_at)
      .forEach((b) => {
        activiteit.push({
          id: `klaar-${b.id}`, tijd: tijdKort(b.updated_at), type: 'afgerond',
          tekst: `Werkbon afgerond — ${b.adres || ''}`,
        })
      })

    activiteit.sort((a, z) => a.tijd.localeCompare(z.tijd))

    setError(null)
    setData({
      actieveProjecten: projecten.filter((p) => p.status !== 'afgerond').length,
      vandaagGestart: startPerBon.size,
      nogNietGestart: projecten.filter((p) => p.status === 'niet_gestart').length,
      achterOpSchema: projecten.filter((p) => p.status === 'achter').length,
      vandaagAfgerond: projecten.filter((p) => p.status === 'afgerond').length,
      projecten,
      meldingen,
      activiteit,
    })
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return { data, loading, error, refetch: fetch }
}

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { klusstand, vergelijkStand, type Klusstand } from '@/lib/klusstand'

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
  /**
   * Dezelfde stand als op de werkbonnen, de planning en het archief.
   *
   * Dit was een eigen lijstje — 'gestart' | 'niet_gestart' | 'achter' |
   * 'afgerond' — met eigen kleuren, waaronder rood voor "achter".
   * Rood betekent elders "ligt stil", en "Bezig" heette hier "Gestart".
   * Eén woordenlijst dus, uit `lib/klusstand.ts`.
   */
  stand: Klusstand
  /**
   * Achter op schema: al twee uur bezig en nog geen halve bon af.
   *
   * Bewust géén stand maar een vlag ernaast. Het gaat over het tempo
   * van vandaag en niet over waar de klus staat — een klus kan
   * tegelijk "bezig" én achter zijn, en dat is precies de combinatie
   * die je wilt zien.
   */
  achter: boolean
  voortgang: number             // 0-100
  aantalFotos: number
  aantalTaken: number
  aantalTakenKlaar: number
  laatsteUpdate: string | null  // ISO timestamp
  /** Startdatum, voor de tweede sortering binnen dezelfde stand. */
  start: string
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

/**
 * De werkvoorraad geteld per stand.
 *
 * Het dashboard telde uitsluitend werkbonnen met `datum = vandaag`.
 * Dat zijn er vijf van de eenendertig, terwijl er veertien klussen
 * daadwerkelijk lopen: een klus die vorige week begon en tot volgende
 * week doorloopt heeft `datum` in het verleden en viel er dus buiten.
 * Het dashboard toonde daarmee een derde van de werkelijkheid.
 *
 * Deze telling gaat over álle openstaande klussen, met dezelfde standen
 * als de rest van de app (`lib/klusstand.ts`) — geen tweede
 * statuslogica.
 */
export type Werkvoorraad = Record<Klusstand, number>

export interface DashboardData {
  /** Alle openstaande klussen, per stand. */
  werkvoorraad: Werkvoorraad
  /** Klussen waarvan de opleverdatum voorbij is en die nog niet af zijn. */
  uitgelopen: number
  vandaagGestart: number
  achterOpSchema: number
  projecten: ProjectRegel[]
  meldingen: Melding[]
  activiteit: Activiteit[]
}

const GEEN_VOORRAAD: Werkvoorraad = {
  niet_gestart: 0, bezig: 0, af_te_ronden: 0, afgerond: 0, opgeleverd: 0, stilgelegd: 0,
}

const LEEG: DashboardData = {
  werkvoorraad: GEEN_VOORRAAD,
  uitgelopen: 0,
  vandaagGestart: 0,
  achterOpSchema: 0,
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

const VOORRAAD_SELECT = `
  id, status, stilgelegd_op, opgeleverd_op, datum, geplande_start, geplande_eind,
  taken ( id, voltooid )
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

    const [bonnenRes, logsRes, voorraadRes] = await Promise.all([
      supabase.from('werkbonnen').select(SELECT).eq('datum', vandaag),
      supabase.from('werkdag_logs')
        .select('werkbon_id, start_tijd, stop_tijd, medewerker:profiles ( naam )')
        .eq('datum', vandaag),
      // Alles, maar smal: alleen wat nodig is om de stand te bepalen.
      // Eenendertig rijen met per punt een id en een vinkje — een
      // fractie van de zware select hierboven, en het enige antwoord op
      // "hoeveel klussen lopen er nu".
      supabase.from('werkbonnen').select(VOORRAAD_SELECT),
    ])

    if (bonnenRes.error || logsRes.error || voorraadRes.error) {
      setError(
        bonnenRes.error?.message ?? logsRes.error?.message
        ?? voorraadRes.error?.message ?? 'Onbekende fout'
      )
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

      const achter = Boolean(
        gestartOp &&
        urenSinds(gestartOp) >= UREN_VOOR_VOORTGANG &&
        aantalTaken > 0 &&
        aantalTakenKlaar / aantalTaken < VOORTGANG_DREMPEL
      )

      return {
        id: b.id,
        projectnaam: b.projectnaam || '',
        adres: b.adres || '',
        team: (b.werkbon_medewerkers || [])
          .map((wm: any) => wm.persoon?.naam)
          .filter(Boolean),
        stand: klusstand(b),
        achter,
        start: b.geplande_start ?? b.datum ?? '',
        voortgang,
        aantalFotos: fotos.length,
        aantalTaken,
        aantalTakenKlaar,
        // De laatste foto zegt meer over "leeft dit nog" dan de
        // starttijd; valt daarop terug zolang er geen foto's zijn.
        laatsteUpdate: laatsteFoto ?? gestartOp,
      }
    })

    // Op stand gesorteerd, niet op de volgorde waarin de database ze
    // teruggaf. Wat stilligt of op afronden wacht staat bovenaan; bij
    // gelijke stand het werk dat het langst loopt.
    projecten.sort((a, b) => vergelijkStand(a, b, (p) => ({
      status: p.stand === 'afgerond' ? 'voltooid' : 'open',
      stilgelegd_op: p.stand === 'stilgelegd' ? 'ja' : null,
      opgeleverd_op: p.stand === 'opgeleverd' ? 'ja' : null,
      puntenKlaar: p.aantalTakenKlaar,
      punten: p.aantalTaken,
    }), (p) => p.start))

    // ── Meldingen ────────────────────────────────────────────────
    const meldingen: Melding[] = []
    const naVerwachteStart = new Date().getHours() >= START_VERWACHT_UUR

    projecten.forEach((p) => {
      if (p.stand === 'niet_gestart' && naVerwachteStart) {
        meldingen.push({
          id: `niet-gestart-${p.id}`, type: 'niet_gestart',
          tekst: 'Nog niet gestart', project: p.adres,
          tijd: `${String(START_VERWACHT_UUR).padStart(2, '0')}:00`,
        })
      }

      const gestartOp = startPerBon.get(p.id)
      if (gestartOp && p.aantalFotos === 0 && urenSinds(gestartOp) >= UREN_ZONDER_FOTO && p.stand !== 'afgerond') {
        meldingen.push({
          id: `geen-fotos-${p.id}`, type: 'geen_fotos',
          tekst: "Geen foto's ontvangen", project: p.adres,
          tijd: tijdKort(gestartOp),
        })
      }

      if (p.achter) {
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

    // ── Werkvoorraad ─────────────────────────────────────────────
    // Over álle klussen, niet alleen die van vandaag. Dezelfde standen
    // als op de werkbonnen, de planning en het archief.
    const werkvoorraad: Werkvoorraad = { ...GEEN_VOORRAAD }
    let uitgelopen = 0

    for (const b of (voorraadRes.data ?? []) as any[]) {
      const stand = klusstand(b)
      werkvoorraad[stand] += 1

      // Uitgelopen: de opleverdatum is voorbij en de klus is niet af.
      // Dat is iets anders dan "achter op schema" hieronder, wat over
      // het tempo van vandaag gaat.
      const eind = b.geplande_eind ?? b.geplande_start ?? b.datum
      const open = stand !== 'afgerond' && stand !== 'opgeleverd'
      if (open && eind && eind < vandaag) uitgelopen += 1
    }

    setError(null)
    setData({
      werkvoorraad,
      uitgelopen,
      vandaagGestart: startPerBon.size,
      achterOpSchema: projecten.filter((p) => p.achter).length,
      projecten,
      meldingen,
      activiteit,
    })
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return { data, loading, error, refetch: fetch }
}

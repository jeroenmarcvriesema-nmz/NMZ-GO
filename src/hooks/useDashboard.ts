import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { klusstand, STANDVOLGORDE, type Klusstand } from '@/lib/klusstand'
import { looptOp, teltVoorVandaag } from '@/lib/planning'

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

  // ── De werkdag van vandaag ──────────────────────────────────
  // Deze stonden er al half in: `gestartOp` werd berekend en gebruikt
  // om te bepalen of een klus achterloopt, maar kwam nergens op het
  // scherm. Kantoor zag dus wél dat een klus achterliep en niet sinds
  // hoe laat er iemand aan het werk was — precies het getal waarmee je
  // de vraag "hoe kan dat" beantwoordt.
  /** Vroegste starttijd van vandaag, over alle monteurs op deze bon. */
  gestartOp: string | null
  /** Laatste stoptijd, of null zolang er nog iemand bezig is. */
  gestoptOp: string | null
  /** Er staat nu iemand op deze klus: gestart en nog niet gestopt. */
  looptNu: boolean
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

/** Eén dag in de doorkijk: hoeveel klussen, en in welke standen. */
export interface Weekdag {
  datum: string
  /** Maandag, dinsdag… */
  naam: string
  vandaag: boolean
  aantal: number
  verdeling: Werkvoorraad
}

export interface DashboardData {
  /** Alle openstaande klussen, per stand. */
  werkvoorraad: Werkvoorraad
  /** De komende zes werkdagen, met wat er per dag loopt. */
  doorkijk: Weekdag[]
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
  doorkijk: [],
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

// `stilgelegd_op` en `opgeleverd_op` stonden hier niet in, terwijl
// `klusstand()` ze als eerste twee vragen stelt. Een klus die stilligt
// kwam op het dashboard dus als "Bezig" te staan — de enige stand die
// een telefoontje vraagt, en juist die was hier onzichtbaar.
// `geplande_start` ontbrak net zo goed, waardoor de tweede sortering
// altijd op `datum` terugviel.
const SELECT = `
  id, projectnaam, adres, status, datum, updated_at,
  geplande_start, geplande_eind, stilgelegd_op, opgeleverd_op,
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

    const [logsRes, voorraadRes] = await Promise.all([
      supabase.from('werkdag_logs')
        .select('werkbon_id, start_tijd, stop_tijd, medewerker:profiles ( naam )')
        .eq('datum', vandaag),
      // Alles, maar smal: alleen wat nodig is om de stand te bepalen.
      // Tweeënvijftig rijen met per punt een id en een vinkje — een
      // fractie van de zware select hieronder, en het enige antwoord op
      // "hoeveel klussen lopen er nu".
      supabase.from('werkbonnen').select(VOORRAAD_SELECT),
    ])

    if (logsRes.error || voorraadRes.error) {
      setError(logsRes.error?.message ?? voorraadRes.error?.message ?? 'Onbekende fout')
      setLoading(false)
      return
    }

    const logs: any[] = logsRes.data || []

    // Vroegste start per werkbon: als twee monteurs op dezelfde bon
    // staan, telt het moment waarop de eerste begon.
    const startPerBon = new Map<string, string>()
    // De laatste stoptijd, en of er nog iemand loopt. Twee monteurs op
    // dezelfde bon: zolang er één niet gestopt is, loopt de klus.
    const stopPerBon = new Map<string, string>()
    const loopdtNog = new Set<string>()
    logs.forEach((l) => {
      if (!l.werkbon_id) return
      const huidig = startPerBon.get(l.werkbon_id)
      if (!huidig || l.start_tijd < huidig) startPerBon.set(l.werkbon_id, l.start_tijd)

      if (!l.stop_tijd) {
        loopdtNog.add(l.werkbon_id)
      } else {
        const laatste = stopPerBon.get(l.werkbon_id)
        if (!laatste || l.stop_tijd > laatste) stopPerBon.set(l.werkbon_id, l.stop_tijd)
      }
    })

    // ── Welke klussen horen vandaag op het bord? ─────────────────
    // Dit was `datum = vandaag`, en dat is vier van de tweeënvijftig
    // bonnen. Van de zes monteurs die vanochtend inklokten stond er
    // precies één op zo'n bon: de andere vijf werkten op klussen die
    // vorige week begonnen of morgen gepland staan, en die kwamen
    // nergens op het dashboard voorbij. Kantoor keek naar een lijst van
    // vier terwijl er tien klussen liepen.
    //
    // `datum` is bovendien niet de dag waarop gewerkt wordt maar de dag
    // waarop de bon is ingepland; bij een meerdaagse klus staat hij op
    // dag één en verschuift nooit meer. Dezelfde regel als de planning
    // en het Lopend-scherm hanteren is `looptOp()`: vandaag valt tussen
    // start en oplevering.
    //
    // Plus wie er daadwerkelijk geklokt heeft. Loopt iemand op een klus
    // die buiten zijn eigen planning valt — uitgelopen, of een dag
    // eerder begonnen — dan is dát het bericht, en dan hoort hij er
    // juist bij te staan.
    const relevant = new Set<string>()
    for (const b of (voorraadRes.data ?? []) as any[]) {
      const stand = klusstand({ ...b, looptNu: loopdtNog.has(b.id) })
      if (stand === 'afgerond' || stand === 'opgeleverd') continue
      if (looptOp(b, vandaag)) relevant.add(b.id)
    }
    logs.forEach((l) => { if (l.werkbon_id) relevant.add(l.werkbon_id) })

    // Alleen de zware select ophalen voor wat er ook echt komt te
    // staan. Zonder klussen geen ronde: `.in()` met een lege lijst is
    // een query die gegarandeerd niets teruggeeft.
    let bonnen: any[] = []
    if (relevant.size > 0) {
      const bonnenRes = await supabase
        .from('werkbonnen').select(SELECT).in('id', [...relevant])
      if (bonnenRes.error) {
        setError(bonnenRes.error.message)
        setLoading(false)
        return
      }
      bonnen = bonnenRes.data || []
    }

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
        stand: klusstand({ ...b, looptNu: loopdtNog.has(b.id) }),
        achter,
        start: b.geplande_start ?? b.datum ?? '',
        voortgang,
        aantalFotos: fotos.length,
        aantalTaken,
        aantalTakenKlaar,
        // De laatste foto zegt meer over "leeft dit nog" dan de
        // starttijd; valt daarop terug zolang er geen foto's zijn.
        laatsteUpdate: laatsteFoto ?? gestartOp,
        gestartOp,
        // Zolang er iemand bezig is heeft de klus geen eindtijd, ook al
        // heeft zijn maat al gestopt.
        gestoptOp: loopdtNog.has(b.id) ? null : (stopPerBon.get(b.id) ?? null),
        looptNu: loopdtNog.has(b.id),
      }
    })

    // Op stand gesorteerd, niet op de volgorde waarin de database ze
    // teruggaf. Wat stilligt of op afronden wacht staat bovenaan; bij
    // gelijke stand het werk dat het langst loopt.
    // De stand staat al op de regel; hem uit losse velden terugrekenen
    // — zoals hier gebeurde — verloor precies de standen die niet uit
    // de punten volgen. Een klus die bezig is omdat er iemand geklokt
    // heeft heeft nul afgevinkte punten, en belandde in die omweg dus
    // weer bij "nog niet gestart".
    projecten.sort((a, b) => {
      const verschil = STANDVOLGORDE[a.stand] - STANDVOLGORDE[b.stand]
      return verschil !== 0 ? verschil : a.start.localeCompare(b.start)
    })

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

    // ── Wat er vandaag speelt ────────────────────────────────────
    // Deze telling ging over álle klussen, ook die van volgende maand.
    // Klikken op een tegel bracht je daarom in de volle
    // werkbonnenlijst, en dat is geen overzicht maar een archief.
    //
    // Nu telt hij wat er vandaag op de vloer ligt, met exact dezelfde
    // regel als het scherm Lopend gebruikt — `teltVoorVandaag`. Dat is
    // geen detail: telde de tegel iets anders dan de lijst erachter,
    // dan is de tegel een leugen, en dat is deze maand al drie keer
    // gebeurd.
    const werkvoorraad: Werkvoorraad = { ...GEEN_VOORRAAD }
    let uitgelopen = 0

    for (const b of (voorraadRes.data ?? []) as any[]) {
      const stand = klusstand({ ...b, looptNu: loopdtNog.has(b.id) })
      if (teltVoorVandaag(b, vandaag, loopdtNog.has(b.id))) werkvoorraad[stand] += 1

      // Uitgelopen: de opleverdatum is voorbij en de klus is niet af.
      // Dat is iets anders dan "achter op schema" hieronder, wat over
      // het tempo van vandaag gaat.
      const eind = b.geplande_eind ?? b.geplande_start ?? b.datum
      const open = stand !== 'afgerond' && stand !== 'opgeleverd'
      if (open && eind && eind < vandaag) uitgelopen += 1
    }

    // ── Doorkijk ─────────────────────────────────────────────────
    // Zes dagen vooruit vanaf vandaag, zaterdag inbegrepen. Wat het
    // dashboard hiervoor niet vertelde is of morgen vol staat of leeg —
    // en dat is de vraag waarvoor een planner naar de planning ging.
    //
    // Uit dezelfde rijen als de werkvoorraad hierboven: een klus telt
    // mee op elke dag waarop hij loopt, want een klus van drie weken is
    // elk van die dagen bezet werk.
    const DAGNAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
    const doorkijk: Weekdag[] = []

    for (let i = 0; i < 6; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dagStr = d.toISOString().split('T')[0]
      // Zondag wordt overgeslagen: er wordt niet gewerkt, en een lege
      // kolom die er altijd is leest als een gat in de week.
      if (d.getDay() === 0) continue

      const verdeling: Werkvoorraad = { ...GEEN_VOORRAAD }
      let aantal = 0

      for (const b of (voorraadRes.data ?? []) as any[]) {
        const stand = klusstand({ ...b, looptNu: loopdtNog.has(b.id) })
        if (stand === 'afgerond' || stand === 'opgeleverd') continue
        if (!looptOp(b, dagStr)) continue
        verdeling[stand] += 1
        aantal += 1
      }

      doorkijk.push({ datum: dagStr, naam: DAGNAMEN[d.getDay()], vandaag: i === 0, aantal, verdeling })
    }

    setError(null)
    setData({
      werkvoorraad,
      doorkijk,
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

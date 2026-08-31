// ============================================================
// Neppe Supabase-client, uitsluitend om de app te kunnen bekíjken.
// ============================================================
// Zet dit bestand in je scratchpad — NIET in de repo — en wijs er een
// Vite-alias naartoe:
//
//   resolve: { alias: [
//     { find: /^@\/lib\/supabase$/, replacement: '<pad naar dit bestand>' },
//     { find: '@', replacement: path.resolve(__dirname, './src') },
//   ]}
//
// De volgorde telt: de specifieke alias moet vóór '@' staan.
//
// Het hele idee zit in `bouwer()` hieronder: een Proxy waarvan élke
// methode zichzelf teruggeeft en die als Promise oplost naar
// { data, error }. Daarmee werkt iedere query in de codebase —
// .select().eq().order().limit() in welke volgorde dan ook — zonder dat
// je ze één voor één hoeft na te lopen. Dat is wat het verschil maakt
// tussen "ik heb de code gelezen" en "ik heb elk scherm gezien".
// ============================================================

const nu = new Date()
const iso = (d: Date) => d.toISOString()
const dag = (n: number) => { const d = new Date(nu); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }
const uur = (h: number, m = 0) => { const d = new Date(nu); d.setHours(h, m, 0, 0); return iso(d) }

// ── Fixtures ────────────────────────────────────────────────
// Maak ze realistisch. Een bon van zes punten laat een probleem met
// scrollen niet zien; werkopdrachten hebben er twintig tot dertig, en
// dáár wordt een ontwerpfout pas zichtbaar.

const taken = (n: number, klaar: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-t${i}`,
    werkbon_id: prefix,
    titel: [
      'Kruipruimte schoonmaken en bodemafsluiterconstructie controleren',
      'Bodemfolie aanbrengen incl. overlap 30 cm',
      'Ventilatieroosters vervangen (4 stuks) voorgevel',
      'Zwamaantasting behandelen met preparaat, achterzijde balklaag',
      'Eindcontrole en opleveren aan bewoner',
      'Afvoeren restmateriaal naar container',
    ][i % 6],
    omschrijving: i % 3 === 0 ? 'Let op: bewoner is doordeweeks pas na 16:00 thuis.' : null,
    voltooid: i < klaar,
    volgorde: i,
    foto_vereist: i % 4 !== 3,
    voltooid_op: i < klaar ? uur(9 + (i % 8)) : null,
    fotos: i < klaar
      ? [{ id: `${prefix}-f${i}`, storage_path: `x/${prefix}-${i}.jpg`, created_at: uur(9), opgeruimd_op: null }]
      : [],
  }))

const persoon = (id: string, naam: string) => ({ id, naam })

const WERKBONNEN = [
  {
    id: 'wb1', bonnummer: 'NMZ-2026-1042', projectnaam: 'Zwamsanering Karolingenstraat',
    adres: 'Karolingenstraat 29', plaats: 'Zaandam', opdrachtgever: 'Woningcorporatie De Alliantie',
    status: 'open', datum: dag(0), geplande_start: dag(-2), geplande_eind: dag(1),
    stilgelegd_op: null, stilleg_reden: null, opgeleverd_op: null, updated_at: uur(11, 20),
    // Wissel dit tussen (6,3) en (24,18) om te zien hoe een bevinding
    // meeschaalt met de omvang van een echte bon.
    taken: taken(24, 18, 'wb1'),
    fotos: [{ id: 'a', created_at: uur(9) }],
    werkbon_medewerkers: [{ persoon: persoon('p1', 'Bilal Yıldız') }, { persoon: persoon('p2', 'Sanne de Vries') }],
  },
  // Zorg dat élke stand uit lib/klusstand.ts minstens één keer voorkomt:
  // niet_gestart, bezig, af_te_ronden, afgerond, opgeleverd, stilgelegd —
  // plus een klus die uitloopt en één met asbest in de stilleg_reden.
]

const FIXTURES: Record<string, any[]> = {
  // Zet `rol` op 'beheerder' of 'medewerker'; dat bepaalt de hele
  // navigatie en de helft van de schermen.
  profiles: [{ id: 'u1', naam: 'Jeroen Vriesema', rol: 'beheerder', functie: 'Eigenaar', actief: true }],
  personen: [persoon('p1', 'Bilal Yıldız'), persoon('p2', 'Sanne de Vries')].map((p) => ({ ...p, actief: true })),
  werkbonnen: WERKBONNEN,
  taken: WERKBONNEN.flatMap((w: any) => w.taken),
  werkdag_logs: [{ id: 'wd1', werkbon_id: 'wb1', medewerker_id: 'u1', gestart_op: uur(7, 45), gestopt_op: null, datum: dag(0) }],
  meldingen: [], fotos: [], punt_opmerkingen: [], werkbon_voorzieningen: [],
  clickup_instellingen: [{ medewerker_labels: [] }], uitnodigingen: [], fouten: [],
  werkbon_gebeurtenissen: [],
}

const RPC: Record<string, any> = {
  planning_overzicht: [
    { werkbon_id: 'wb1', adres: 'Karolingenstraat 29', plaats: 'Zaandam', medewerker: 'Bilal Yıldız', datum: dag(0) },
  ],
}

// ── De motor ────────────────────────────────────────────────

function resultaat(tabel: string, enkel: boolean) {
  // Verse identiteiten bij elke ophaalronde. Zonder dit geeft een refetch
  // exact dezelfde objecten terug, ziet React geen verandering en tekent
  // hij niets opnieuw — dan lijkt een geslaagde actie mislukt terwijl hij
  // gewoon is aangekomen. Dat kost je een uur zoeken.
  const rijen = JSON.parse(JSON.stringify(FIXTURES[tabel] ?? []))
  return enkel
    ? { data: rijen[0] ?? null, error: rijen[0] ? null : { code: 'PGRST116', message: 'geen rij' }, count: rijen.length }
    : { data: rijen, error: null, count: rijen.length }
}

/** Elke methode geeft zichzelf terug; `then` lost op naar het resultaat. */
function bouwer(tabel: string): any {
  let enkel = false

  /**
   * Een insert landt écht in de fixture.
   *
   * Zonder dit test je een handeling die nergens aankomt, en dan zie je
   * de helft van wat er misgaat niet. Precies zo is een knop die bij het
   * uploaden van grijs naar geel sprong door de audit heen geglipt: op
   * een schermafdruk klopte alles, de overgang zag niemand.
   *
   * Vul aan per tabel die je in een flow aanraakt.
   */
  const invoegen = (rij: any) => {
    if (tabel === 'fotos') {
      const taak = (FIXTURES.taken as any[]).find((t) => t.id === rij.taak_id)
      if (taak) {
        taak.fotos = [...(taak.fotos ?? []), {
          id: `nieuw-${Date.now()}`,
          storage_path: rij.storage_path ?? `x/${Date.now()}.jpg`,
          created_at: new Date().toISOString(),
          opgeruimd_op: null,
        }]
      }
    }
  }

  const proxy: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (ok: any, mis: any) => Promise.resolve(resultaat(tabel, enkel)).then(ok, mis)
      }
      if (prop === 'single' || prop === 'maybeSingle') return () => { enkel = true; return proxy }
      if (prop === 'insert') return (rij: any) => { invoegen(rij); return proxy }
      return () => proxy
    },
  })
  return proxy
}

export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'test@nmz.nl' } } }, error: null }),
    getUser: async () => ({ data: { user: { id: 'u1', email: 'test@nmz.nl', user_metadata: { naam: 'Test' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
    signUp: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: {}, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
  from: (tabel: string) => bouwer(tabel),
  rpc: async (naam: string) => ({ data: RPC[naam] ?? [], error: null }),
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'x' }, error: null }),
      remove: async () => ({ data: [], error: null }),
      list: async () => ({ data: [], error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }),
      // Let op: externe hosts worden door de proxy geblokkeerd. De
      // miniaturen blijven dan leeg — dat is ruis, geen bevinding.
      createSignedUrls: async (paden: string[]) => ({
        data: paden.map((p) => ({ path: p, signedUrl: '' })), error: null,
      }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
  removeChannel: () => {},
}

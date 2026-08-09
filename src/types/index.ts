export type Theme = 'light' | 'dark'
// Vijf rollen sinds migratie 008. In de database heet de uitvoerende
// rol `medewerker` — generiek, zodat er later een ander vak bij kan.
// Op het scherm staat "Zwamsaneerder"; zie ROL_LABEL in lib/utils.
export type Rol = 'eigenaar' | 'beheerder' | 'uitvoerder' | 'werkvoorbereider' | 'planner' | 'medewerker'
export type WerkbonStatus = 'open' | 'bezig' | 'voltooid'
export type ProjectStatus = 'actief' | 'niet_gestart' | 'op_schema' | 'vertraging' | 'afgerond' | 'stilgelegd'

export interface Profile {
  id: string
  naam: string
  rol: Rol
  /** Het bedrijf waar dit account bij hoort. Alle RLS-policies hangen hieraan. */
  tenant_id: string
  /** Functietitel, los van het rechtenniveau. Bijv. "Operationeel Manager". */
  functie: string | null
  /** Gelijkgehouden met auth.users; nodig om een wachtwoordreset te kunnen sturen. */
  email: string | null
  /** De naam waaronder deze persoon in ClickUp staat, bijv. "Mario". */
  clickup_label: string | null
  actief: boolean
  created_at: string
}

export interface Werkbon {
  id: string
  bonnummer: string
  projectnaam: string
  adres: string
  /** Los van `adres`: zoeken op "Assendelft" hoort te werken. */
  plaats?: string | null
  postcode?: string | null
  /** Projectnummer van de opdrachtgever, bijv. "C515". Leeg bij losse klussen. */
  opdrachtnummer?: string | null
  opdrachtgever: string | null
  datum: string
  status: WerkbonStatus
  aangemaakt_door: string | null
  created_at: string
  updated_at: string
  taken?: Taak[]
  medewerkers?: Profile[]

  // ── Uit ClickUp en de werkopdracht (migraties 012 en 015) ──
  // Alles wat iemand nodig heeft die voor de deur staat: hoe kom ik
  // binnen, wie bel ik, en wat staat er in de opdracht.
  clickup_taak_id?: string | null
  geplande_start?: string | null
  geplande_eind?: string | null
  uitloopdatum?: string | null
  kluiscode?: string | null
  inspecteur?: string | null
  inspecteur_telefoon?: string | null
  /** Alles boven "Uit te voeren werkzaamheden": compartimenten, preparaten, bijzonderheden. */
  werkvoorbereiding?: string | null
  /** Pad in de besloten bucket werkbon-documenten. */
  opdracht_pad?: string | null
  tekening_pad?: string | null

  stilgelegd_op?: string | null
  stilleg_reden?: string | null
  opgeleverd_op?: string | null

  // ── De drie tekstvelden van het opleverrapport (migratie 002/025) ──
  opmerkingen_bewoners?: string | null
  extra_werkzaamheden?: string | null
  bijzonderheden?: string | null
}

/** Een aangevraagd opleverrapport. Zie migratie 025. */
export interface Rapportage {
  id: string
  werkbon_id: string
  status: 'wachtend' | 'klaar' | 'mislukt'
  bestandspad: string | null
  fout: string | null
  aangevraagd_op: string
  gegenereerd_op: string | null
  clickup_geupload_op: string | null
}

/**
 * Iemand uit de ploeg. Bestaat los van een account: de planning in
 * ClickUp kent alleen namen, en of daar al iemand bij ingelogd heeft is
 * een aparte vraag. Zolang profile_id leeg is kan hij wél ingepland
 * worden, maar nog niet inloggen.
 */
export interface Persoon {
  id: string
  naam: string
  clickup_label: string | null
  profile_id: string | null
  actief: boolean
  pilot: boolean
  /** Wie op locatie de kar trekt. Puur informatief: geen verschil in scherm of rechten. */
  koppelrol: 'eerste man' | 'tweede man' | null
}

export interface Taak {
  id: string
  werkbon_id: string
  titel: string
  omschrijving: string | null
  voltooid: boolean
  /** Standaard aan. Alleen een uitvoerder of hoger kan hem uitzetten. */
  foto_vereist: boolean
  opmerking: string | null
  volgorde: number
  created_at: string
  fotos?: Foto[]
}

export interface Foto {
  id: string
  werkbon_id: string
  taak_id: string
  uploader_id: string | null
  storage_path: string
  bestandsnaam: string
  created_at: string
}

export interface Uitnodiging {
  id: string
  token: string
  aangemaakt_door: string | null
  gebruikt: boolean
  created_at: string
  verloopt_op: string | null
}

export interface Project {
  id: string
  naam: string
  adres: string
  opdrachtgever: string
  status: ProjectStatus
  voortgang: number
  startdatum: string
  einddatum: string
  medewerkers: Profile[]
  aantalWerkbonnen: number
  aantalTaken: number
  aantalTakenKlaar: number
  aantalFotos: number
  opmerkingen: string
}

export interface PlanningItem {
  id: string
  /** Startdatum; met `eind` erbij beslaat een klus vaak meerdere dagen. */
  datum: string
  eind: string
  projectId: string | null
  /** Leeg zolang klussen losse bonnen zijn en niet aan een project hangen. */
  projectnaam: string
  adres: string
  kluiscode: string | null
  punten: number
  puntenKlaar: number
  medewerkers: string[]
  status: ProjectStatus
}
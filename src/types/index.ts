export type Theme = 'light' | 'dark'
// Vijf rollen sinds migratie 008. In de database heet de uitvoerende
// rol `medewerker` — generiek, zodat er later een ander vak bij kan.
// Op het scherm staat "Zwamsaneerder"; zie ROL_LABEL in lib/utils.
export type Rol = 'eigenaar' | 'beheerder' | 'uitvoerder' | 'werkvoorbereider' | 'medewerker'
export type WerkbonStatus = 'open' | 'bezig' | 'voltooid'
export type ProjectStatus = 'actief' | 'niet_gestart' | 'op_schema' | 'vertraging' | 'afgerond'

export interface Profile {
  id: string
  naam: string
  rol: Rol
  /** Functietitel, los van het rechtenniveau. Bijv. "Operationeel Manager". */
  functie: string | null
  /** Gelijkgehouden met auth.users; nodig om een wachtwoordreset te kunnen sturen. */
  email: string | null
  actief: boolean
  created_at: string
}

export interface Werkbon {
  id: string
  bonnummer: string
  projectnaam: string
  adres: string
  opdrachtgever: string | null
  datum: string
  status: WerkbonStatus
  aangemaakt_door: string | null
  created_at: string
  updated_at: string
  taken?: Taak[]
  medewerkers?: Profile[]
}

export interface Taak {
  id: string
  werkbon_id: string
  titel: string
  omschrijving: string | null
  voltooid: boolean
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
  datum: string
  projectId: string
  projectnaam: string
  adres: string
  medewerkers: string[]
  status: ProjectStatus
}
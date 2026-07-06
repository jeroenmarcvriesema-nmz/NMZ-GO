export type Rol = 'beheerder' | 'medewerker'
export type WerkbonStatus = 'open' | 'bezig' | 'voltooid'

export interface Profile {
  id: string
  naam: string
  rol: Rol
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

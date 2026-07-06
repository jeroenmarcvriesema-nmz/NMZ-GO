import { useState, useEffect } from 'react'

// ── Mock types ─────────────────────────────────────────────────
// Koppeling aan Supabase: vervang de mock data door queries op
// werkbonnen, profielen en een toekomstige 'werkdag_logs' tabel.

export interface ProjectRegel {
  id: string
  projectnaam: string
  adres: string
  team: string[]
  status: 'gestart' | 'niet_gestart' | 'achter' | 'afgerond'
  voortgang: number          // 0-100
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
  tijd: string   // bijv. "07:03"
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

// ── Mock data — vervang later door Supabase queries ────────────
// Supabase koppeling:
//   actieveProjecten  → COUNT werkbonnen WHERE datum = today AND status != voltooid
//   vandaagGestart    → COUNT werkdag_logs WHERE datum = today AND start_tijd IS NOT NULL
//   nogNietGestart    → actieveProjecten - vandaagGestart
//   achterOpSchema    → werkbonnen WHERE voortgang < verwacht_pct - 10
//   projecten         → JOIN werkbonnen + taken + fotos + werkbon_medewerkers
//   meldingen         → berekend op basis van bovenstaande queries
//   activiteit        → werkdag_logs ORDER BY created_at DESC LIMIT 20

const MOCK: DashboardData = {
  actieveProjecten: 6,
  vandaagGestart: 4,
  nogNietGestart: 2,
  achterOpSchema: 1,
  vandaagAfgerond: 1,

  projecten: [
    {
      id: '1',
      projectnaam: 'Renovatie badkamer',
      adres: 'Kerkstraat 12, Amsterdam',
      team: ['Mike Jansen', 'Jeffrey de Groot'],
      status: 'gestart',
      voortgang: 65,
      aantalFotos: 8,
      aantalTaken: 6,
      aantalTakenKlaar: 4,
      laatsteUpdate: new Date(Date.now() - 23 * 60000).toISOString(),
    },
    {
      id: '2',
      projectnaam: 'CV ketel vervanging',
      adres: 'Hoofdweg 44, Haarlem',
      team: ['Lars Smit'],
      status: 'niet_gestart',
      voortgang: 0,
      aantalFotos: 0,
      aantalTaken: 4,
      aantalTakenKlaar: 0,
      laatsteUpdate: null,
    },
    {
      id: '3',
      projectnaam: 'Dakgoot reiniging',
      adres: 'Laan v. Meerdervoort 7, Den Haag',
      team: ['Marco Visser', 'Tom Brouwer'],
      status: 'achter',
      voortgang: 20,
      aantalFotos: 2,
      aantalTaken: 8,
      aantalTakenKlaar: 2,
      laatsteUpdate: new Date(Date.now() - 120 * 60000).toISOString(),
    },
    {
      id: '4',
      projectnaam: 'Vloerverwarming inspectie',
      adres: 'Bergweg 10, Leiden',
      team: ['Ahmed El Fassi'],
      status: 'gestart',
      voortgang: 50,
      aantalFotos: 4,
      aantalTaken: 4,
      aantalTakenKlaar: 2,
      laatsteUpdate: new Date(Date.now() - 45 * 60000).toISOString(),
    },
    {
      id: '5',
      projectnaam: 'Kitwerk badkamer',
      adres: 'Rijnstraat 22, Utrecht',
      team: ['Piet Bakker'],
      status: 'afgerond',
      voortgang: 100,
      aantalFotos: 12,
      aantalTaken: 5,
      aantalTakenKlaar: 5,
      laatsteUpdate: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    {
      id: '6',
      projectnaam: 'Radiatoren ontluchten',
      adres: 'Stationsplein 3, Rotterdam',
      team: ['Jan de Vries'],
      status: 'niet_gestart',
      voortgang: 0,
      aantalFotos: 0,
      aantalTaken: 3,
      aantalTakenKlaar: 0,
      laatsteUpdate: null,
    },
  ],

  meldingen: [
    { id: '1', type: 'niet_gestart', tekst: 'Nog niet gestart', project: 'Hoofdweg 44, Haarlem', tijd: '08:00' },
    { id: '2', type: 'niet_gestart', tekst: 'Nog niet gestart', project: 'Stationsplein 3, Rotterdam', tijd: '08:00' },
   { id: '3', type: 'geen_fotos', tekst: "Geen foto's ontvangen", project: 'Laan v. Meerdervoort 7, Den Haag', tijd: '09:30' },
    { id: '4', type: 'controle', tekst: 'Achter op schema', project: 'Laan v. Meerdervoort 7, Den Haag', tijd: '10:00' },
    { id: '5', type: 'afgerond', tekst: 'Werkbon afgerond', project: 'Rijnstraat 22, Utrecht', tijd: '11:42' },
  ],

  activiteit: [
    { id: '1', tijd: '07:03', tekst: 'Mike Jansen gestart op Kerkstraat 12', type: 'start' },
    { id: '2', tijd: '07:15', tekst: 'Jeffrey de Groot gestart op Kerkstraat 12', type: 'start' },
    { id: '3', tijd: '07:44', tekst: 'Ahmed El Fassi gestart op Bergweg 10', type: 'start' },
    { id: '4', tijd: '08:22', tekst: 'Marco Visser gestart op Laan v. Meerdervoort 7', type: 'start' },
    { id: '5', tijd: '09:11', tekst: "8 foto's toegevoegd – Kerkstraat 12", type: 'fotos' },
    { id: '6', tijd: '09:33', tekst: "2 foto's toegevoegd – Laan v. Meerdervoort 7", type: 'fotos' },
    { id: '7', tijd: '10:15', tekst: "4 foto's toegevoegd – Bergweg 10", type: 'fotos' },
    
    
    { id: '8', tijd: '11:42', tekst: 'Werkbon afgerond — Rijnstraat 22', type: 'afgerond' },
  ],
}

export function useDashboard(): { data: DashboardData; loading: boolean } {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData>(MOCK)

  useEffect(() => {
    // Simuleer laadtijd — vervang door echte Supabase queries
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  return { data, loading }
}

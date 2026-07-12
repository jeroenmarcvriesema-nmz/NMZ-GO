import { useState, useEffect } from 'react'
import type { Project, PlanningItem, ProjectStatus } from '@/types'

// ── Mock data — later vervangen door Supabase queries ──────────
// Supabase koppeling:
//   projecten     → SELECT * FROM werkbonnen GROUP BY projectnaam (of aparte projecten tabel)
//   voortgang     → COUNT taken WHERE voltooid / COUNT taken totaal
//   medewerkers   → JOIN werkbon_medewerkers + profiles
//   aantalFotos   → COUNT fotos WHERE werkbon_id IN project werkbonnen

const MOCK_MEDEWERKERS = [
  { id: 'u1', naam: 'Mike Jansen',      rol: 'medewerker' as const, actief: true, created_at: '' },
  { id: 'u2', naam: 'Jeffrey de Groot', rol: 'medewerker' as const, actief: true, created_at: '' },
  { id: 'u3', naam: 'Lars Smit',        rol: 'medewerker' as const, actief: true, created_at: '' },
  { id: 'u4', naam: 'Marco Visser',     rol: 'medewerker' as const, actief: true, created_at: '' },
  { id: 'u5', naam: 'Ahmed El Fassi',   rol: 'medewerker' as const, actief: true, created_at: '' },
  { id: 'u6', naam: 'Piet Bakker',      rol: 'medewerker' as const, actief: true, created_at: '' },
]

const MOCK_PROJECTEN: Project[] = [
  {
    id: 'p1',
    naam: 'Renovatie badkamer blok A',
    adres: 'Kerkstraat 12, Amsterdam',
    opdrachtgever: 'Woningstichting Eigen Haard',
    status: 'actief',
    voortgang: 65,
    startdatum: '2025-05-19',
    einddatum: '2025-05-30',
    medewerkers: [MOCK_MEDEWERKERS[0], MOCK_MEDEWERKERS[1]],
    aantalWerkbonnen: 3,
    aantalTaken: 18,
    aantalTakenKlaar: 12,
    aantalFotos: 24,
    opmerkingen: 'Klant is tevreden met voortgang. Let op waterleiding 2e verdieping.',
  },
  {
    id: 'p2',
    naam: 'CV ketel vervanging',
    adres: 'Hoofdweg 44, Haarlem',
    opdrachtgever: 'Particulier: J. Smit',
    status: 'niet_gestart',
    voortgang: 0,
    startdatum: '2025-05-26',
    einddatum: '2025-05-27',
    medewerkers: [MOCK_MEDEWERKERS[2]],
    aantalWerkbonnen: 1,
    aantalTaken: 6,
    aantalTakenKlaar: 0,
    aantalFotos: 0,
    opmerkingen: '',
  },
  {
    id: 'p3',
    naam: 'Dakgoot reiniging en herstel',
    adres: 'Laan v. Meerdervoort 7, Den Haag',
    opdrachtgever: 'VvE Meerdervoort',
    status: 'vertraging',
    voortgang: 20,
    startdatum: '2025-05-20',
    einddatum: '2025-05-23',
    medewerkers: [MOCK_MEDEWERKERS[3], MOCK_MEDEWERKERS[4]],
    aantalWerkbonnen: 2,
    aantalTaken: 12,
    aantalTakenKlaar: 3,
    aantalFotos: 4,
    opmerkingen: 'Vertraging door slecht weer. Nieuwe einddatum: 27 mei.',
  },
  {
    id: 'p4',
    naam: 'Vloerverwarming inspectie',
    adres: 'Bergweg 10, Leiden',
    opdrachtgever: 'Particulier: A. de Vries',
    status: 'op_schema',
    voortgang: 50,
    startdatum: '2025-05-22',
    einddatum: '2025-05-23',
    medewerkers: [MOCK_MEDEWERKERS[4]],
    aantalWerkbonnen: 1,
    aantalTaken: 8,
    aantalTakenKlaar: 4,
    aantalFotos: 8,
    opmerkingen: '',
  },
  {
    id: 'p5',
    naam: 'Badkamer kitwerk volledig',
    adres: 'Rijnstraat 22, Utrecht',
    opdrachtgever: 'Particulier: M. Bakker',
    status: 'afgerond',
    voortgang: 100,
    startdatum: '2025-05-15',
    einddatum: '2025-05-16',
    medewerkers: [MOCK_MEDEWERKERS[5]],
    aantalWerkbonnen: 1,
    aantalTaken: 8,
    aantalTakenKlaar: 8,
    aantalFotos: 18,
    opmerkingen: 'Opgeleverd en goedgekeurd door klant.',
  },
  {
    id: 'p6',
    naam: 'Radiatoren onderhoud complex',
    adres: 'Stationsplein 3, Rotterdam',
    opdrachtgever: 'Woningstichting Havenstede',
    status: 'niet_gestart',
    voortgang: 0,
    startdatum: '2025-05-27',
    einddatum: '2025-05-29',
    medewerkers: [MOCK_MEDEWERKERS[0]],
    aantalWerkbonnen: 2,
    aantalTaken: 10,
    aantalTakenKlaar: 0,
    aantalFotos: 0,
    opmerkingen: '',
  },
]

const MOCK_PLANNING: PlanningItem[] = [
  { id: 'pl1', datum: '2025-05-19', projectId: 'p1', projectnaam: 'Renovatie badkamer blok A', adres: 'Kerkstraat 12, Amsterdam', medewerkers: ['Mike Jansen', 'Jeffrey de Groot'], status: 'actief' },
  { id: 'pl2', datum: '2025-05-20', projectId: 'p1', projectnaam: 'Renovatie badkamer blok A', adres: 'Kerkstraat 12, Amsterdam', medewerkers: ['Mike Jansen', 'Jeffrey de Groot'], status: 'actief' },
  { id: 'pl3', datum: '2025-05-20', projectId: 'p3', projectnaam: 'Dakgoot reiniging en herstel', adres: 'Laan v. Meerdervoort 7', medewerkers: ['Marco Visser', 'Ahmed El Fassi'], status: 'vertraging' },
  { id: 'pl4', datum: '2025-05-21', projectId: 'p1', projectnaam: 'Renovatie badkamer blok A', adres: 'Kerkstraat 12, Amsterdam', medewerkers: ['Mike Jansen'], status: 'actief' },
  { id: 'pl5', datum: '2025-05-22', projectId: 'p4', projectnaam: 'Vloerverwarming inspectie', adres: 'Bergweg 10, Leiden', medewerkers: ['Ahmed El Fassi'], status: 'op_schema' },
  { id: 'pl6', datum: '2025-05-23', projectId: 'p4', projectnaam: 'Vloerverwarming inspectie', adres: 'Bergweg 10, Leiden', medewerkers: ['Ahmed El Fassi'], status: 'op_schema' },
  { id: 'pl7', datum: '2025-05-26', projectId: 'p2', projectnaam: 'CV ketel vervanging', adres: 'Hoofdweg 44, Haarlem', medewerkers: ['Lars Smit'], status: 'niet_gestart' },
  { id: 'pl8', datum: '2025-05-27', projectId: 'p6', projectnaam: 'Radiatoren onderhoud complex', adres: 'Stationsplein 3, Rotterdam', medewerkers: ['Mike Jansen'], status: 'niet_gestart' },
]

export function useProjecten() {
  const [projecten, setProjecten] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setProjecten(MOCK_PROJECTEN)
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [])

  return { projecten, loading }
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setProject(MOCK_PROJECTEN.find((p) => p.id === id) ?? null)
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [id])

  // Mock-only koppeling: werkt uitsluitend in-memory voor deze sessie.
  // Supabase-koppeling volgt zodra de echte 'projecten'-tabel er is (zie .ai/FEATURE_BACKLOG.md).
  const koppelMedewerkers = (medewerkerIds: string[]) => {
    setProject((prev) => {
      if (!prev) return prev
      const bestaandeIds = new Set(prev.medewerkers.map((m) => m.id))
      const nieuwe = MOCK_MEDEWERKERS.filter((m) => medewerkerIds.includes(m.id) && !bestaandeIds.has(m.id))
      const bijgewerkt: Project = { ...prev, medewerkers: [...prev.medewerkers, ...nieuwe] }
      const idx = MOCK_PROJECTEN.findIndex((p) => p.id === prev.id)
      if (idx !== -1) MOCK_PROJECTEN[idx] = bijgewerkt
      return bijgewerkt
    })
  }

  return { project, loading, koppelMedewerkers }
}

export function usePlanning() {
  const [planning, setPlanning] = useState<PlanningItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setPlanning(MOCK_PLANNING)
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [])

  return { planning, loading }
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

export { MOCK_MEDEWERKERS }

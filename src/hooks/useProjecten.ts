import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlanningItem, ProjectStatus } from '@/types'

// ============================================================
// Wat hier nog staat, en wat er weg is
// ============================================================
// Dit bestand hield ooit de tabel `projecten` bij. Die tabel heeft nul
// rijen en krijgt er nooit een bij: uit ClickUp komt één taak als één
// wérkbon, nooit als project. De projectenpagina is daarom herbouwd op
// klusgroepen (bonnen met hetzelfde opdrachtnummer), en de detailpagina
// `/projecten/:id` is verwijderd — daar wees niets meer naartoe en hij
// kon niets tonen.
//
// Wat overbleef is wat wél gebruikt wordt: de weekplanning, en de twee
// statushelpers die de projectenlijst gebruikt om een groep klussen een
// kleur en een label te geven.
// ============================================================

// De planning is afgeleid uit werkbonnen: elke werkbon met een datum is
// één regel in de weekplanning.
export function usePlanning() {
  const [planning, setPlanning] = useState<PlanningItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      // Géén project meer, in geen enkele vorm. Het filter erop is er
      // eerder al uit gegaan — sinds de klussen uit ClickUp komen hangt
      // geen enkele werkbon aan een project en was de planning leeg
      // terwijl er tweeëntwintig klussen stonden. De join zelf bleef
      // daarna nog staan en leverde bij elke rij een leeg `project` op,
      // want `projecten` heeft nul rijen en nul van de dertig
      // werkbonnen heeft een `project_id`. Nu weg, met `projectId` en
      // `projectnaam` erbij: die las niemand meer.
      const { data, error } = await supabase
        .from('werkbonnen')
        .select(`
          id, datum, adres, plaats, bonnummer, status, kluiscode,
          geplande_start, geplande_eind, stilgelegd_op, opgeleverd_op,
          taken ( id, voltooid ),
          werkbon_medewerkers ( persoon:personen(naam) )
        `)
        .order('datum', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setError(null)
        setPlanning(
          (data || []).map((w: any) => ({
            id: w.id,
            datum: w.geplande_start ?? w.datum,
            eind: w.geplande_eind ?? w.geplande_start ?? w.datum,
            adres: w.adres ?? '',
            plaats: w.plaats ?? null,
            bonnummer: w.bonnummer ?? null,
            kluiscode: w.kluiscode ?? null,
            punten: (w.taken ?? []).length,
            puntenKlaar: (w.taken ?? []).filter((t: any) => t.voltooid).length,
            medewerkers: (w.werkbon_medewerkers || [])
              .map((wm: any) => wm.persoon?.naam)
              .filter(Boolean),
            // De bon vertelt zelf hoe hij ervoor staat.
            status: (w.stilgelegd_op ? 'stilgelegd'
                   : w.opgeleverd_op || w.status === 'voltooid' ? 'afgerond'
                   : w.status === 'bezig' ? 'actief'
                   : 'niet_gestart') as ProjectStatus,
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
    stilgelegd: 'Ligt stil',
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
    stilgelegd: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/30',
  }
  return map[s]
}

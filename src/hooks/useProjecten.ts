import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { klussenMetLopendeWerkdag } from '@/lib/werkdagen'
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
// Wat overbleef is de weekplanning. De twee statushelpers die hier ook
// stonden — statusLabel en statusKleur, met "Actief" waar de rest van
// de app "Bezig" zegt — zijn weg: de projectenpagina haalt woord en
// kleur nu uit `lib/klusstand.ts`, net als elk ander scherm.
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
          geplande_start, geplande_eind, stilgelegd_op, opgeleverd_op, stilleg_reden,
          taken ( id, voltooid ),
          werkbon_medewerkers ( persoon:personen(naam) )
        `)
        .order('datum', { ascending: true })

      // Wie er nu geklokt staat, uit dezelfde bron als de andere
      // schermen. Zonder dit rekent de planning een andere stand uit
      // dan de tegel op het dashboard.
      const lopend = await klussenMetLopendeWerkdag()

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
            // Nodig om asbest van de rest te onderscheiden: dat krijgt
            // een eigen kleur, want er hangt een andere procedure aan.
            stillegReden: w.stilleg_reden ?? null,
            punten: (w.taken ?? []).length,
            puntenKlaar: (w.taken ?? []).filter((t: any) => t.voltooid).length,
            looptNu: lopend.has(w.id),
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

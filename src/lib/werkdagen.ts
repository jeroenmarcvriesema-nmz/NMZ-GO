// ============================================================
// NMZ GO — waar staat er nu iemand geklokt?
// ============================================================
// Eén vraag, één antwoord, voor elk scherm dat een stand berekent.
//
// Waarom dit bestaat: `klusstand()` telt een lopende werkdag als bewijs
// dat een klus bezig is — een monteur klokt in als hij aankomt en vinkt
// zijn eerste punt pas uren later af. Het dashboard gaf dat gegeven
// netjes mee, maar de werkbonnenlijst en de planning niet, want die
// haalden de werkdaglogs helemaal niet op.
//
// Gevolg: de tegel "bezig" telde een klus wél mee en de lijst waar je
// op uitkwam niet. Dezelfde vraag, twee antwoorden, en niemand die kon
// zien welke van de twee loog. Dat is nu drie keer voorgekomen op drie
// plekken; vandaar deze ene bron.
// ============================================================

import { supabase } from '@/lib/supabase'
import { isoDatum } from '@/lib/planning'

/**
 * De id's van de klussen waar vandaag iemand op geklokt staat en nog
 * niet gestopt is.
 *
 * Bij een fout een lege verzameling: dan valt de stand terug op de
 * afgevinkte punten, precies zoals vóór dit gegeven bestond. Een scherm
 * dat niet laadt omdat de werkdaglogs even niet meewerken is erger dan
 * een klus die "nog niet gestart" heet terwijl er iemand staat.
 */
export async function klussenMetLopendeWerkdag(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('werkdag_logs')
    .select('werkbon_id')
    .eq('datum', isoDatum())
    .is('stop_tijd', null)

  if (error) return new Set()

  return new Set(
    (data ?? [])
      .map((r) => (r as { werkbon_id?: string }).werkbon_id)
      .filter((id): id is string => Boolean(id)),
  )
}

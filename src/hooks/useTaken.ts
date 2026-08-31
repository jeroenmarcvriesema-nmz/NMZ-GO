import { supabase } from '@/lib/supabase'
import type { Taak } from '@/types'

export function useTaken() {
  /**
   * Een punt af- of uitvinken.
   *
   * Met `.select()` erachter, en dat is geen detail. Een update die
   * door RLS wordt tegengehouden levert bij PostgREST geen fout op maar
   * een geldig, leeg antwoord: nul rijen geraakt. Zonder deze toets
   * meldde het scherm dus "gelukt", haalde het de bon opnieuw op, en
   * stond het vinkje er alsnog niet — zonder dat er ergens iets stond
   * over waarom. Dat is de vorm waarin "ik kan niet afvinken" bij
   * kantoor binnenkomt, en er is geen enkele aanwijzing bij.
   *
   * Dezelfde behandeling die `voltooiWerkbon` in `Klusuitvoering` al
   * had; die had hem om precies dezelfde reden gekregen.
   */
  const toggleVoltooid = async (taak: Taak) => {
    const aan = !taak.voltooid
    const { data, error } = await supabase
      .from('taken')
      // Ook het moment, sinds migratie 034. Een punt wist of het af was
      // maar niet wannéér, en dat is precies wat een activiteitenfeed
      // nodig heeft: "om 10:14 afgevinkt" is een gebeurtenis, "afgevinkt"
      // is een toestand. Weer uitvinken haalt het stempel ook weg —
      // anders zou de feed een moment tonen dat niet meer klopt.
      .update({ voltooid: aan, voltooid_op: aan ? new Date().toISOString() : null })
      .eq('id', taak.id)
      .select('id')

    if (error) return { error }
    if (!data || data.length === 0) {
      // De twee gevallen die de policy uit migratie 014 overlaat: je
      // staat niet (meer) op de bon, of de bon is al voltooid. Welke
      // van de twee het is weten we hier niet — dat zou een extra
      // vraag aan de server kosten voor een antwoord dat in beide
      // gevallen op hetzelfde neerkomt: het gaat niet, en niet omdat
      // de app stuk is.
      return {
        error: {
          message:
            'Dit punt kon niet worden bijgewerkt. Je staat niet meer op deze '
            + 'werkbon, of de bon is al afgerond. Vraag je uitvoerder om je '
            + 'opnieuw in te plannen.',
        },
      }
    }
    return { error: null }
  }

  const voegToe = async (
    werkbon_id: string,
    titel: string,
    omschrijving: string,
    volgorde: number
  ) => {
    const { data, error } = await supabase
      .from('taken')
      .insert({ werkbon_id, titel, omschrijving, volgorde })
      .select()
      .single()
    return { data, error }
  }

  // Alleen een uitvoerder of hoger; de database weigert het van een
  // zwamsaneerder, ook als het scherm de knop per ongeluk zou tonen.
  const zetFotoVereist = async (id: string, foto_vereist: boolean) => {
    const { data, error } = await supabase
      .from('taken')
      .update({ foto_vereist })
      .eq('id', id)
      .select('id')
    if (error) return { error }
    if (!data || data.length === 0) return { error: { message: 'Geen rechten om de fotoplicht te wijzigen' } }
    return { error: null }
  }

  const verwijder = async (id: string) => {
    const { error } = await supabase.from('taken').delete().eq('id', id)
    return { error }
  }

  return { toggleVoltooid, voegToe, verwijder, zetFotoVereist }
}

import { supabase } from '@/lib/supabase'
import type { Taak } from '@/types'

export function useTaken() {
  const toggleVoltooid = async (taak: Taak) => {
    const aan = !taak.voltooid
    const { error } = await supabase
      .from('taken')
      // Ook het moment, sinds migratie 034. Een punt wist of het af was
      // maar niet wannéér, en dat is precies wat een activiteitenfeed
      // nodig heeft: "om 10:14 afgevinkt" is een gebeurtenis, "afgevinkt"
      // is een toestand. Weer uitvinken haalt het stempel ook weg —
      // anders zou de feed een moment tonen dat niet meer klopt.
      .update({ voltooid: aan, voltooid_op: aan ? new Date().toISOString() : null })
      .eq('id', taak.id)
    return { error }
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

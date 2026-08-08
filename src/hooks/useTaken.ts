import { supabase } from '@/lib/supabase'
import type { Taak } from '@/types'

export function useTaken() {
  const toggleVoltooid = async (taak: Taak) => {
    const { error } = await supabase
      .from('taken')
      .update({ voltooid: !taak.voltooid })
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

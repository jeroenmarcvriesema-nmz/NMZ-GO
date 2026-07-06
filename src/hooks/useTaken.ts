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

  const verwijder = async (id: string) => {
    const { error } = await supabase.from('taken').delete().eq('id', id)
    return { error }
  }

  return { toggleVoltooid, voegToe, verwijder }
}

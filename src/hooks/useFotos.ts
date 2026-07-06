import { supabase } from '@/lib/supabase'

export function useFotos() {
  const upload = async (
    werkbonId: string,
    taakId: string,
    uploaderId: string,
    file: File
  ) => {
    const timestamp = Date.now()
    const bestandsnaam = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const storagePath = `${werkbonId}/${taakId}/${bestandsnaam}`

    const { error: uploadError } = await supabase.storage
      .from('werkbon-fotos')
      .upload(storagePath, file, { upsert: false })

    if (uploadError) return { error: uploadError }

    const { error: dbError } = await supabase.from('fotos').insert({
      werkbon_id: werkbonId,
      taak_id: taakId,
      uploader_id: uploaderId,
      storage_path: storagePath,
      bestandsnaam,
    })

    return { error: dbError }
  }

  const getUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('werkbon-fotos')
      .getPublicUrl(storagePath)
    return data.publicUrl
  }

  return { upload, getUrl }
}

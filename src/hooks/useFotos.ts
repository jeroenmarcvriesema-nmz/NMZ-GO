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

  // Ondertekende URL in plaats van een publieke link. De bucket is
  // besloten (migratie 007): dit zijn foto's van de woningen van
  // bewoners, en een publieke link blijft voor altijd werken voor
  // iedereen die hem heeft. Deze link vervalt na een uur.
  const getUrl = async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('werkbon-fotos')
      .createSignedUrl(storagePath, 3600)
    if (error || !data) return null
    return data.signedUrl
  }

  return { upload, getUrl }
}

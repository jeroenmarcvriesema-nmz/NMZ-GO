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

  /**
   * Ondertekende links voor een hele reeks paden in één aanroep.
   *
   * Eén punt kan drie of vier foto's hebben en een werkbon vijftien
   * punten. Per foto een eigen aanroep is dan zestig ronden naar de
   * server voordat er iets op het scherm staat — op een telefoon met
   * een halve streep bereik is dat het verschil tussen "traag" en
   * "kapot".
   */
  const getUrls = async (paden: string[]): Promise<Record<string, string>> => {
    if (paden.length === 0) return {}
    const { data, error } = await supabase.storage
      .from('werkbon-fotos')
      .createSignedUrls(paden, 3600)
    if (error || !data) return {}

    const uit: Record<string, string> = {}
    for (const rij of data) {
      // `path` kan null zijn als één bestand niet bestaat. De rest van
      // de reeks hoort daar niet onder te lijden.
      if (rij.path && rij.signedUrl) uit[rij.path] = rij.signedUrl
    }
    return uit
  }

  return { upload, getUrl, getUrls }
}

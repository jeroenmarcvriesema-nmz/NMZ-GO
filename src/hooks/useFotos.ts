import { supabase } from '@/lib/supabase'
import { verkleinFoto } from '@/lib/afbeelding'

export function useFotos() {
  const upload = async (
    werkbonId: string,
    taakId: string,
    uploaderId: string,
    file: File
  ) => {
    // Eerst verkleinen. Een telefoonfoto van acht megabyte over 4G
    // vanuit een kruipruimte is een upload van minuten die op een
    // slechte verbinding halverwege strandt — en daarna moet diezelfde
    // acht megabyte terugkomen om een miniatuur te vullen.
    const bestand = await verkleinFoto(file)

    const timestamp = Date.now()
    const bestandsnaam = `${timestamp}_${bestand.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const storagePath = `${werkbonId}/${taakId}/${bestandsnaam}`

    const { error: uploadError } = await supabase.storage
      .from('werkbon-fotos')
      .upload(storagePath, bestand, { upsert: false })

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
  const getUrls = async (
    paden: string[]
  ): Promise<{ urls: Record<string, string>; fout: string | null }> => {
    if (paden.length === 0) return { urls: {}, fout: null }
    const { data, error } = await supabase.storage
      .from('werkbon-fotos')
      .createSignedUrls(paden, 3600)

    // De fout teruggeven en niet stilzwijgend een lege lijst: zonder dit
    // zag een mislukte ondertekening er precies hetzelfde uit als een
    // foto die nog aan het laden was — een grijs vakje, voor altijd.
    if (error || !data) return { urls: {}, fout: error?.message ?? 'onbekende fout' }

    const uit: Record<string, string> = {}
    for (const rij of data) {
      // `path` kan null zijn als één bestand niet bestaat. De rest van
      // de reeks hoort daar niet onder te lijden.
      if (rij.path && rij.signedUrl) uit[rij.path] = rij.signedUrl
    }
    return { urls: uit, fout: null }
  }

  return { upload, getUrl, getUrls }
}

import { supabase } from '@/lib/supabase'
import { verkleinFoto } from '@/lib/afbeelding'
import { duidUploadfout, type Uploadfout } from '@/lib/uploadfout'

export function useFotos() {
  /**
   * Waaróm het misging, niet alleen dát het misging.
   *
   * De sessie wordt hier pas opgehaald als er al iets mis is: bij een
   * geslaagde upload is het een netwerkrondje voor niets, en dat telt
   * op een halve streep bereik.
   */
  const duid = async (boodschap: string | null): Promise<Uploadfout> => {
    const { data } = await supabase.auth.getSession()
    return duidUploadfout(boodschap, navigator.onLine, !!data.session)
  }

  const upload = async (
    werkbonId: string,
    taakId: string,
    uploaderId: string,
    file: File
  ): Promise<{ error: unknown; fout: Uploadfout | null }> => {
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

    if (uploadError) return { error: uploadError, fout: await duid(uploadError.message) }

    const { error: dbError } = await supabase.from('fotos').insert({
      werkbon_id: werkbonId,
      taak_id: taakId,
      uploader_id: uploaderId,
      storage_path: storagePath,
      bestandsnaam,
    })

    // Het bestand staat er dan wél en de rij niet — dat is het geval
    // waarin niemand de foto ooit terugziet. Het opruimen van zulke
    // weesbestanden gebeurt in de nachtronde (migratie 027); hier telt
    // dat de gebruiker het weet en het opnieuw kan sturen.
    if (dbError) return { error: dbError, fout: await duid(dbError.message) }

    return { error: null, fout: null }
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

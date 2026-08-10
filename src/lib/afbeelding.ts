/**
 * Een foto kleiner maken vóór het uploaden.
 *
 * De eerste drie echte foto's waren 3,4 MB, 3,5 MB en 7,9 MB. Dat is
 * wat een moderne telefooncamera levert, en het is voor ons doel
 * onzinnig groot: acht megabyte over 4G vanuit een kruipruimte is een
 * upload die minuten duurt en op een slechte verbinding halverwege
 * strandt. Daarna moet diezelfde acht megabyte ook nog terugkomen om
 * een vakje van vierenzestig bij vierenzestig pixels te vullen.
 *
 * 2560 pixels aan de lange zijde is ruim voor een fotorapportage: dat
 * is scherper dan een A4 op 300 dpi. Een schimmelplek of een
 * aangetaste balk is daarop even goed te beoordelen als op het
 * origineel, en het bestand gaat van acht megabyte naar een halve.
 *
 * De kwaliteit staat bewust hoog. Dit zijn foto's die naar een
 * opdrachtgever gaan en waar bij een geschil naar teruggekeken wordt;
 * daar hoor je niet op te beknibbelen om nog wat kilobytes te winnen.
 *
 * Gaat er iets mis — een formaat dat de browser niet kent, een
 * canvas die niet wil — dan gaat het originele bestand alsnog omhoog.
 * Een foto die groot is, is oneindig veel beter dan geen foto.
 */

const MAX_ZIJDE = 2560
const KWALITEIT = 0.85

/** Onder deze grens loont verkleinen niet. */
const ONDERGRENS_BYTES = 1_000_000

export async function verkleinFoto(bestand: File): Promise<File> {
  if (!bestand.type.startsWith('image/')) return bestand
  if (bestand.size <= ONDERGRENS_BYTES) return bestand

  try {
    // `from-image` laat de browser de EXIF-oriëntatie toepassen. Zonder
    // dat komt een foto die staand is gemaakt liggend op het rapport —
    // de telefoon slaat hem liggend op met een draai-instructie ernaast.
    const bitmap = await createImageBitmap(bestand, { imageOrientation: 'from-image' })

    const schaal = Math.min(1, MAX_ZIJDE / Math.max(bitmap.width, bitmap.height))
    const breedte = Math.round(bitmap.width * schaal)
    const hoogte = Math.round(bitmap.height * schaal)

    const canvas = document.createElement('canvas')
    canvas.width = breedte
    canvas.height = hoogte

    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return bestand }
    ctx.drawImage(bitmap, 0, 0, breedte, hoogte)
    bitmap.close()

    const blob = await new Promise<Blob | null>((klaar) =>
      canvas.toBlob(klaar, 'image/jpeg', KWALITEIT)
    )
    if (!blob) return bestand

    // Zou het verkleinen niets opleveren — bij een foto die al goed is
    // ingepakt kan dat — dan houden we het origineel.
    if (blob.size >= bestand.size) return bestand

    const naam = bestand.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], naam, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return bestand
  }
}

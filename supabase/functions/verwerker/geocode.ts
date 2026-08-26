// ============================================================
// NMZ GO — van een adres naar een punt op de kaart
// ============================================================
// Nodig om te kunnen zeggen hoe ver iemand van de klus stond toen hij
// zich aanmeldde. De werkbon heeft alleen een adres als tekst; die moet
// dus eerst een coordinaat worden.
//
// PDOK, de locatieserver van het Kadaster: gratis, Nederlands, geen
// sleutel nodig, en het kent de BAG — dus ook "88HS" en "157 RD".
//
// De pure delen staan hier apart van de aanroep, zodat een test ze kan
// nalopen zonder het internet op te gaan. Dat is geen luxe: de adressen
// in dit bestand zijn met de hand ingetypt en zitten vol met vormen die
// een geocodeerder van zijn stuk brengen.
// ============================================================

/** Een gevonden plek. */
export interface Punt {
  lat: number
  lon: number
}

/**
 * Het adres opschonen tot iets waar PDOK raad mee weet.
 *
 * Wat er in de praktijk in staat, en waarom het moet wijken:
 *
 *   "Bonairestraat 88HS te Amsterdam"
 *      → " te " is Nederlands voor een komma, en PDOK leest het niet zo.
 *
 *   "Rembrandstraat 79 t/m 129 te Den Haag"
 *      → een reeks huisnummers is geen adres. We houden het eerste aan;
 *        dat is een deur die bestaat, en beter dan het midden van de
 *        straat.
 *
 *   "Klaas Katerstraat e.o. te Zaandam (Logchies)"
 *      → "e.o." en de aannemer tussen haakjes zeggen iets over het
 *        project en niets over de plek.
 *
 *   "1925 Bloem Fonteinstraat 8 te Haarlem"
 *      → een projectnummer vooraan. Cijfers vóór de straatnaam zijn
 *        nooit een huisnummer.
 */
export function schoonAdres(ruw: string | null | undefined): string {
  let s = String(ruw ?? '').trim()
  if (!s) return ''

  // Alles tussen haakjes eruit: dat is toelichting, geen adres.
  s = s.replace(/\([^)]*\)/g, ' ')

  // Een projectnummer vooraan ("1925 Bloem Fonteinstraat 8").
  s = s.replace(/^\s*\d{3,}\s+(?=[A-Za-z])/, '')

  // Een reeks huisnummers: alleen de eerste aanhouden.
  s = s.replace(/(\d+)\s*(?:t\/m|tot en met|-)\s*\d+/gi, '$1')

  // "e.o." en "eo" — en omstreken. De punt achteraan moet mee: met een
  // woordgrens aan het eind blijft hij staan en houd je "Klaas
  // Katerstraat ." over.
  s = s.replace(/\be\.?\s?o\.?(?=[\s,]|$)/gi, ' ')

  // Losse leestekens die van het opschonen zijn overgebleven.
  s = s.replace(/\s+\.(?=[\s,]|$)/g, '')

  // " te " als scheiding tussen adres en plaats.
  s = s.replace(/\s+te\s+/gi, ', ')

  // Dubbele spaties en komma's opruimen.
  s = s.replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ')
  return s.replace(/^[\s,]+|[\s,]+$/g, '')
}

/**
 * PDOK geeft een punt als `POINT(4.892 52.373)` — eerst de lengte, dan
 * de breedte. Die volgorde is precies andersom dan hoe iedereen een
 * coordinaat opschrijft, en het is een van de makkelijkste manieren om
 * per ongeluk in de Noordzee uit te komen.
 */
export function leesPunt(centroide: unknown): Punt | null {
  const m = /POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(String(centroide ?? ''))
  if (!m) return null
  const lon = Number(m[1])
  const lat = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

/**
 * Ligt dit punt in Nederland?
 *
 * Een geocodeerder die zijn adres niet vindt geeft soms iets terug wat
 * er wel uitziet als een coordinaat. Een grove doos om het land heen
 * vangt dat af — en een klus buiten die doos is sowieso geen klus van
 * dit bedrijf.
 */
export function inNederland(p: Punt): boolean {
  return p.lat > 50.5 && p.lat < 53.8 && p.lon > 3.2 && p.lon < 7.3
}

const PDOK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'

/**
 * Het adres opzoeken bij PDOK.
 *
 * `fq=type:adres` houdt straten en woonplaatsen buiten de deur: die
 * leveren een middelpunt op dat honderden meters van de voordeur kan
 * liggen, en dat is precies het getal waar hier conclusies aan hangen.
 * Liever niets dan een punt dat te goed van vertrouwen is.
 */
export async function zoekAdres(adres: string): Promise<Punt & { gevonden: string } | null> {
  const vraag = schoonAdres(adres)
  if (!vraag) return null

  const url = `${PDOK}?q=${encodeURIComponent(vraag)}&rows=1&fq=type:adres&fl=weergavenaam,centroide_ll`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`PDOK gaf ${res.status}`)

  const body = await res.json()
  const eerste = body?.response?.docs?.[0]
  if (!eerste) return null

  const punt = leesPunt(eerste.centroide_ll)
  if (!punt || !inNederland(punt)) return null

  return { ...punt, gevonden: String(eerste.weergavenaam ?? vraag) }
}

// ── De ronde ────────────────────────────────────────────────

/**
 * Een handvol werkbonnen zonder coordinaat opzoeken.
 *
 * In porties, om dezelfde reden als bij het rapport: dit zijn
 * netwerkaanroepen naar een dienst van iemand anders, en die hoor je
 * niet in één ronde honderd keer achter elkaar te doen.
 *
 * Een adres dat niet gevonden wordt krijgt een stempel zonder
 * coordinaat. Zonder dat stempel zou dezelfde onvindbare klus elke
 * ronde opnieuw aan de beurt komen en de rest voor zich uit schuiven.
 */
export async function geocodeerRonde(
  db: { from: (t: string) => any },
  tenantId: string,
  aantal = 10,
): Promise<Record<string, unknown>> {
  const { data: bonnen, error } = await db
    .from('werkbonnen')
    .select('id, adres')
    .eq('tenant_id', tenantId)
    .is('latitude', null)
    .is('geocode_op', null)
    .limit(aantal)

  if (error) throw new Error(`werkbonnen lezen mislukt: ${error.message}`)

  const teDoen = bonnen ?? []
  let gevonden = 0
  let nietGevonden = 0

  for (const bon of teDoen) {
    let punt: (Punt & { gevonden: string }) | null = null
    try {
      punt = await zoekAdres(bon.adres)
    } catch (e) {
      // Een storing bij PDOK is tijdelijk. Geen stempel zetten, dan
      // komt deze bon een volgende ronde vanzelf terug.
      throw new Error(`PDOK onbereikbaar: ${e instanceof Error ? e.message : String(e)}`)
    }

    const { error: schrijfFout } = await db
      .from('werkbonnen')
      .update({
        latitude: punt?.lat ?? null,
        longitude: punt?.lon ?? null,
        geocode_op: new Date().toISOString(),
        geocode_bron: punt ? `pdok: ${punt.gevonden}` : 'pdok: niet gevonden',
      })
      .eq('id', bon.id)

    if (schrijfFout) throw new Error(`coordinaat opslaan mislukt: ${schrijfFout.message}`)
    if (punt) gevonden++
    else nietGevonden++
  }

  return { bekeken: teDoen.length, gevonden, niet_gevonden: nietGevonden }
}

// ============================================================
// NMZ GO — werkopdracht-PDF lezen
// ============================================================
// Alleen het lezen van de PDF staat hier. Het ontleden van de tekst
// staat in `ontleden.ts`, zonder Deno-afhankelijkheden, zodat dat deel
// in een gewone testrunner te draaien is. Deze module blijft dun met
// opzet: hij doet iets wat je niet zonder echte PDF kunt testen.
//
// ── Over het teruglezen van regels ───────────────────────────
// Een PDF kent geen regels; hij kent stukjes tekst op coördinaten.
// extractText() plakt die stukjes achter elkaar en levert het hele
// document als één regel op — daarmee is het verschil tussen "nieuw
// punt" en "vervolg van de vorige zin" verdwenen, en dat verschil is
// hier precies wat telt. Daarom lezen we de tekstlaag zelf uit en
// groeperen we op y-positie: stukjes op dezelfde hoogte stonden op
// dezelfde regel. Dat geeft het document terug zoals de inspecteur
// het heeft opgeschreven.
// ============================================================

import { getDocumentProxy } from 'npm:unpdf@0.12.1'

export { ontleed, kopveld, ANKER_START, ANKER_EIND, PUNT } from './ontleden.ts'
export type { Werkopdracht } from './ontleden.ts'

// Regels op minder dan dit aantal punten hoogteverschil hoorden bij
// elkaar. Ruim genoeg voor een superscript (m²), krap genoeg om twee
// echte regels niet samen te trekken.
const ZELFDE_REGEL = 2

/**
 * Leest de PDF en geeft de tekst terug mét de oorspronkelijke
 * regelovergangen.
 */
export async function leesPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes)
  const regels: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p)
    const inhoud = await pagina.getTextContent()

    let hoogte: number | null = null
    let regel = ''

    for (const item of inhoud.items as any[]) {
      if (typeof item?.str !== 'string') continue
      const y = Math.round(item.transform[5])

      if (hoogte === null || Math.abs(y - hoogte) > ZELFDE_REGEL) {
        if (regel.trim()) regels.push(regel.trim())
        regel = item.str
        hoogte = y
      } else {
        regel += item.str
      }
    }
    if (regel.trim()) regels.push(regel.trim())
  }

  return regels.join('\n')
}

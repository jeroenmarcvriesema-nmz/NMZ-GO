// ============================================================
// NMZ GO — werkopdracht-parser
// ============================================================
// Leest een werkopdracht-PDF en haalt eruit wat een werkbon nodig
// heeft. Geen taalmodel: puur ankers en opsommingstekens, zodat de
// uitkomst voorspelbaar is en er niets verzonnen kan worden. Bij dit
// document is dat geen stijlkeuze — een verzonnen punt is werk dat
// een zwamsaneerder gaat uitvoeren.
//
// Opbouw van het sjabloon:
//
//   Opdrachtnummer : 7020
//   Inzake : <adres>
//   Inspecteur : <naam>
//   Telefoonnummer : <nummer>
//   ...werkvoorbereiding, compartimenten, preparaten...   <- naslag
//   Uit te voeren werkzaamheden S&M Nooitmeerzwam:        <- anker
//   o Punt een...                                         <- punten
//   o Punt twee...
//   Datum oplevering: ____                                <- einde
//
// De kopjes in het naslagdeel (Compartiment 1, Rechterkant, ...)
// verschillen per inspecteur en worden daarom niet ontleed maar als
// één blok bewaard.
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

// De echte kop eindigt op een dubbele punt en staat vlak voor de
// punten. Verderop in het document staat ook "...foto's maken van alle
// uit te voeren werkzaamheden" — die zin heeft geen dubbele punt
// dichtbij, dus de grens van 60 tekens houdt hem buiten. Voor de
// zekerheid nemen we altijd de laatste treffer.
const ANKER_START = /uit te voeren werkzaamheden[^:\n]{0,60}:/gi
const ANKER_EIND = /(Datum oplevering|Naam en handtekening)/i

// Een punt begint met een losse 'o' of met een nummer. Beide komen
// voor: de meeste opdrachten gebruiken het bolletje, de opdrachten voor
// alleen een bodemafsluiter zijn genummerd. Regels die er niet mee
// beginnen zijn een vervolg van het punt erboven.
const PUNT = /^(?:o|\d{1,2}\.)\s+(?=[A-Za-z])/

// Regels op minder dan dit aantal punten hoogteverschil hoorden bij
// elkaar. Ruim genoeg voor een superscript (m²), krap genoeg om twee
// echte regels niet samen te trekken.
const ZELFDE_REGEL = 2

export interface Werkopdracht {
  opdrachtnummer: string | null
  adres: string | null
  inspecteur: string | null
  inspecteurTelefoon: string | null
  kluiscode: string | null
  werkvoorbereiding: string
  punten: string[]
  weggelaten: string[]
}

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

/**
 * Waarde achter een kopveld. Een opsommingsteken ervoor mag ("●
 * Kluiscode 4444") en de dubbele punt is optioneel, want die staat er
 * niet altijd.
 */
function kopveld(tekst: string, veld: string): string | null {
  const m = tekst.match(new RegExp(`^[●•\\-\\s]*${veld}\\s*:?\\s*(.+)$`, 'im'))
  if (!m) return null

  // Staat het veld leeg, dan schuift het kopje eronder soms op dezelfde
  // regel — "● Kluiscode Werkvoorbereiding:". Een woord met een dubbele
  // punt erachter is het volgende kopje, geen waarde.
  const waarde = m[1].replace(/\s*[A-Z][A-Za-z]*\s*:\s*$/, '').trim()

  // Een leeg invulveld ("Datum aanvang: _______") is ook geen waarde.
  return /^[_\s.]*$/.test(waarde) ? null : waarde
}

export function ontleed(tekst: string, uitgesloten: string[]): Werkopdracht {
  const treffers = [...tekst.matchAll(ANKER_START)]
  const start = treffers.at(-1)

  if (!start || start.index === undefined) {
    throw new Error(
      'De kop "Uit te voeren werkzaamheden" staat niet in deze opdracht. ' +
      'Zonder die kop is niet vast te stellen welke punten afgevinkt moeten worden.',
    )
  }

  const naAnker = tekst.slice(start.index + start[0].length)
  const eind = naAnker.match(ANKER_EIND)
  const blok = eind && eind.index !== undefined ? naAnker.slice(0, eind.index) : naAnker

  // Een regel die niet met het opsommingsteken begint hoort bij het
  // punt erboven — dat is een afgebroken zin, geen nieuw punt.
  const ruw: string[] = []
  let huidig: string | null = null

  for (const regelRuw of blok.split('\n')) {
    const regel = regelRuw.trim()
    if (!regel) continue
    if (PUNT.test(regel)) {
      if (huidig) ruw.push(huidig)
      huidig = regel.replace(PUNT, '').trim()
    } else if (huidig) {
      huidig += ' ' + regel
    }
  }
  if (huidig) ruw.push(huidig)

  const punten = ruw.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)

  const houden: string[] = []
  const weg: string[] = []
  for (const p of punten) {
    const laag = p.toLowerCase()
    if (uitgesloten.some((u) => laag.includes(u.toLowerCase()))) weg.push(p)
    else houden.push(p)
  }

  if (houden.length === 0) {
    throw new Error(
      'Geen uit te voeren punten gevonden onder de kop. ' +
      'Waarschijnlijk wijkt deze opdracht af van het sjabloon.',
    )
  }

  return {
    opdrachtnummer: kopveld(tekst, 'Opdrachtnummer'),
    adres: kopveld(tekst, 'Inzake'),
    inspecteur: kopveld(tekst, 'Inspecteur'),
    inspecteurTelefoon: kopveld(tekst, 'Telefoonnummer'),
    kluiscode: kopveld(tekst, 'Kluiscode'),
    werkvoorbereiding: tekst.slice(0, start.index).trim(),
    punten: houden,
    weggelaten: weg,
  }
}

// ============================================================
// NMZ GO — het ontleden van een werkopdracht
// ============================================================
// Dit bestand bevat alleen de tekstverwerking: tekst in, werkbon uit.
// Geen PDF, geen netwerk, geen Deno. Dat is geen esthetiek maar een
// vereiste — hierdoor is dit stuk in een gewone testrunner te draaien,
// en het is precies het stuk waar de fouten zaten.
//
// `werkopdracht.ts` ernaast doet het lezen van de PDF en gebruikt wat
// hier staat.
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
// ============================================================

// De echte kop eindigt op een dubbele punt en staat vlak voor de
// punten. Verderop in het document staat ook "...foto's maken van alle
// uit te voeren werkzaamheden" — die zin heeft geen dubbele punt
// dichtbij, dus de grens van 60 tekens houdt hem buiten. Voor de
// zekerheid nemen we altijd de laatste treffer.
export const ANKER_START = /uit te voeren werkzaamheden[^:\n]{0,60}:/gi
export const ANKER_EIND = /(Datum oplevering|Naam en handtekening)/i

// Een punt begint met een losse 'o' of met een nummer. Beide komen
// voor: de meeste opdrachten gebruiken het bolletje, de opdrachten voor
// alleen een bodemafsluiter zijn genummerd. Regels die er niet mee
// beginnen zijn een vervolg van het punt erboven.
export const PUNT = /^(?:o|\d{1,2}\.)\s+(?=[A-Za-z])/

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
 * Waarde achter een kopveld. Een opsommingsteken ervoor mag ("●
 * Kluiscode 4444") en de dubbele punt is optioneel, want die staat er
 * niet altijd.
 */
export function kopveld(tekst: string, veld: string): string | null {
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
  // Altijd de laatste treffer: eerdere zinnen in de werkvoorbereiding
  // kunnen op dezelfde kop lijken. Geen `.at(-1)` — dat vereist een
  // nieuwere taalversie dan waar de rest van dit project op staat, en
  // die grens verleggen we niet voor één index.
  const treffers = [...tekst.matchAll(ANKER_START)]
  const start = treffers.length > 0 ? treffers[treffers.length - 1] : undefined

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

// ============================================================
// NMZ GO — container en dixi uit de werkvoorbereiding lezen
// ============================================================
// In de werkopdracht staat of er een container en een dixi nodig zijn,
// en bij de container hoeveel kuub. Die twee bepalen een bestelling bij
// een derde partij, met een leverdatum en een afmelddatum — en tot nu
// toe stond dat alleen in een lap tekst die niemand doorleest.
//
// De tekst is grillig, want hij is door mensen ingevuld in een sjabloon
// dat in de loop van de jaren is veranderd. Alles hieronder komt uit
// echte opdrachten:
//
//   ● Container? Ja 10m3            ● Dixi? Ja
//   ● Container Ja 6 m3             ● Dixi Nee
//   ● Container? Ja 6m3 open
//   ● Container 3m3 bouw/sloop op dag 1        (geen ja, wel een maat)
//   Container?\n6m3Dixi? Ja                    (aan elkaar geplakt)
//   Container? Nee puinzakkenDixi? Nee
//   ● Container? Ja of Nee incl. aantal m3. Nee puinzak voor pleisterwerk
//   ● Dixi? Ja of nee nee                      (sjabloontekst vóór het antwoord)
//
// Twee dingen die deze lezer daarom nadrukkelijk doet:
//
//   1. **Sjabloontekst wegstrepen.** "Ja of Nee incl. aantal m3." is de
//      vraag, niet het antwoord. Zonder dat weg te halen leest elke
//      opdracht als "ja".
//   2. **Stoppen bij het volgende veld.** De tekst loopt geregeld aan
//      elkaar ("Neebewoners tel.nr."), dus we knippen op het eerstvolgende
//      kopje in plaats van op een spatie of een regeleinde.
//
// Wat er niet staat, raden we niet. Een opdracht die er niets over zegt
// levert 'onbekend' op en geen 'nee' — het verschil tussen "er is geen
// container nodig" en "we weten het niet" is precies het verschil
// tussen wél en niet bellen.
// ============================================================

export type Antwoord = 'ja' | 'nee' | 'onbekend'

export interface Voorziening {
  nodig: Antwoord
  /** Alleen bij een container: 3, 6 of 10. Null als er geen maat staat. */
  kuub: number | null
  /**
   * Hoeveel er besteld moeten worden. Bijna altijd één, maar "Ja 2x
   * 10m3" en "10 m3 (2x)" komen echt voor — en dan is één container
   * bestellen een halve klus.
   */
  aantal: number
  /** Het stukje tekst waar dit uit komt, om te kunnen controleren. */
  ruw: string | null
}

export interface Voorzieningen {
  container: Voorziening
  dixi: Voorziening
}

const NIETS: Voorziening = { nodig: 'onbekend', kuub: null, aantal: 1, ruw: null }

/**
 * Kopjes waar het antwoord op een vraag ophoudt.
 *
 * Bewust ruim: elk woord dat in het sjabloon een eigen regel begint.
 * Te vroeg knippen kost hooguit een maat, te laat knippen levert het
 * antwoord van de volgende vraag op — en dat is erger.
 */
const GRENZEN = [
  'container', 'dixi', 'kluiscode', 'bewoner', 'werkvoorbereiding',
  'mandagen', 'voorkeursmedewerkers', 'balkmaten', 'zwaminspectie',
  'aantal zakken', 'evt.', 'naam:', 'emailadres', 'telefoon', 'tel.nr',
  'isolatie', 'gelijk isol',
]

/** De vraag zoals hij in het sjabloon staat, niet het antwoord erop. */
const SJABLOON = [
  /ja\s*of\s*nee\s*incl\.?\s*aantal\s*m3\.?/g,
  /ja\s*of\s*geen/g,
  /ja\s*of\s*nee/g,
  /ja\s*\/\s*nee/g,
]

/** Haakjes bevatten toelichting, en geregeld een maat die niet telt. */
function zonderHaakjes(tekst: string): string {
  return tekst.replace(/\([\s\S]*?\)/g, ' ')
}

/**
 * Het stuk tekst dat bij één vraag hoort.
 *
 * `vanaf` is het woord waar we op zoeken; `eigen` is datzelfde woord,
 * dat als grens niet mag meetellen — anders knipt "Container" zichzelf
 * meteen af.
 */
function segment(tekst: string, vanaf: string, eigen: string): string | null {
  const start = tekst.indexOf(vanaf)
  if (start === -1) return null

  const na = tekst.slice(start + vanaf.length)

  let eind = na.length
  for (const grens of GRENZEN) {
    if (grens === eigen) continue
    const plek = na.indexOf(grens)
    if (plek !== -1 && plek < eind) eind = plek
  }

  // Ruim genoeg voor "Ja of Nee incl. aantal m3.  JA 6m3", krap genoeg
  // om niet in de volgende alinea te belanden als er geen kopje volgt.
  return na.slice(0, Math.min(eind, 160))
}

function lees(tekst: string, woord: string): Voorziening {
  const stuk = segment(tekst, woord, woord)
  if (stuk === null) return NIETS

  // Het aantal staat geregeld juist tússen haakjes ("10 m3 (2x)"), dus
  // dat zoeken we vóór het wegstrepen. De maat en het ja/nee juist
  // daarna, want daar zit de toelichting in de weg.
  const keer = stuk.match(/(\d+)\s*x\b/)
  const aantal = keer ? Math.max(1, Number(keer[1])) : 1

  let schoon = zonderHaakjes(stuk)
  for (const patroon of SJABLOON) schoon = schoon.replace(patroon, ' ')

  const maat = schoon.match(/(\d+)\s*(?:m3|m³|kuub)/)
  const kuub = maat ? Number(maat[1]) : null

  const antwoord = schoon.match(/\b(ja|nee)\b/)

  // "Negatief; puin/afval meenemen" staat er ook, en dat is gewoon nee.
  const negatief = /\bnegatief\b/.test(schoon)

  // Geen ja of nee, wél een maat: dan is de maat het antwoord. "●
  // Container 3m3 bouw/sloop op dag 1" is een container van drie kuub,
  // ook al staat het woord "ja" er niet.
  const nodig: Antwoord = antwoord
    ? (antwoord[1] as Antwoord)
    : negatief ? 'nee'
    : kuub !== null ? 'ja' : 'onbekend'

  return { nodig, kuub, aantal, ruw: stuk.trim().slice(0, 120) || null }
}

/**
 * Leest container en dixi uit de werkvoorbereiding.
 *
 * Geeft altijd allebei terug; ontbreekt een vraag in de tekst, dan
 * staat er 'onbekend'.
 */
export function leesVoorzieningen(tekst: string | null | undefined): Voorzieningen {
  if (!tekst) return { container: NIETS, dixi: NIETS }

  // Bewust nog mét haakjes: die worden per vraag weggestreept, zodat
  // het aantal dat erin staat niet verloren gaat.
  const genormaliseerd = String(tekst).toLowerCase()

  return {
    container: lees(genormaliseerd, 'container'),
    dixi: lees(genormaliseerd, 'dixi'),
  }
}

/** Kort briefje voor op het scherm: "6 m³" of "ja" of "nee". */
export function omschrijf(v: Voorziening): string {
  if (v.nodig === 'nee') return 'nee'
  if (v.nodig === 'onbekend') return 'niet vermeld'
  const maat = v.kuub ? `${v.kuub} m³` : 'ja'
  return v.aantal > 1 ? `${v.aantal}× ${maat}` : maat
}

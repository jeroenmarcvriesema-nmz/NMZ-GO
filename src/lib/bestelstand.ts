// ============================================================
// NMZ GO — hoe dringend is een container of dixi
// ============================================================
// De tegenhanger van `klusstand.ts`, maar dan voor de spullen die bij
// een derde partij besteld worden. Eén tabel met woorden én kleuren,
// zodat "3 dagen over de datum" op het dashboard hetzelfde heet en
// hetzelfde kleurt als op het scherm eronder.
//
// Waarom dit een eigen bestand is en geen `if` in de kaart: de tekst
// zat verstopt in een ternary in het component, alles in hetzelfde
// grijs van elf pixels. Een regel die geld kost las daardoor precies
// zoals een regel die volgende week pas speelt. Losgetrokken is het
// bovendien te testen zonder een scherm te tekenen.
//
// De volgorde van de kleuren komt uit de rest van de app: rood is te
// laat, oranje is vandaag of morgen, blauw loopt, grijs wacht. Geel
// blijft van het merk (zie PRODUCT_VISION) en staat hier dus niet in.
// ============================================================

export type Stapel = 'afmelden' | 'bestellen' | 'staat_er'

export type Urgentie = 'te_laat' | 'vandaag' | 'morgen' | 'binnenkort' | 'later'

export interface Termijn {
  /** Dagen tot de eerste werkdag. Negatief betekent: al begonnen. */
  dagenTotStart: number
  /** Dagen sinds de opleverdatum. Negatief betekent: nog niet zover. */
  dagenNaEind: number
}

export interface Bestelstand {
  urgentie: Urgentie
  /** Wat er op het scherm staat, bv. "3 dagen over de datum". */
  tekst: string
}

/** Wat "binnenkort" is: hierbinnen kleurt een bestelling mee. */
const BINNENKORT = 3

function dagen(n: number): string {
  return `${n} ${n === 1 ? 'dag' : 'dagen'}`
}

/**
 * Hoe dringend deze regel is, en hoe dat heet.
 *
 * Per stapel anders, want het gaat om twee verschillende data. Bij
 * afmelden telt de opleverdatum: die is voorbij en de huur loopt door.
 * Bij bestellen telt de startdatum: het ding moet er staan vóór de
 * ploeg voor de deur staat.
 */
export function bestelstand(t: Termijn, stapel: Stapel): Bestelstand {
  if (stapel === 'afmelden') {
    if (t.dagenNaEind > 0) return { urgentie: 'te_laat', tekst: `${dagen(t.dagenNaEind)} over de datum` }
    if (t.dagenNaEind === 0) return { urgentie: 'vandaag', tekst: 'vandaag afmelden' }
    // Hoort niet in deze stapel te staan, maar een lege tekst is erger
    // dan een die klopt.
    return { urgentie: 'later', tekst: `nog ${dagen(-t.dagenNaEind)} nodig` }
  }

  if (stapel === 'bestellen') {
    if (t.dagenTotStart < 0) return { urgentie: 'te_laat', tekst: 'de klus is al begonnen' }
    if (t.dagenTotStart === 0) return { urgentie: 'vandaag', tekst: 'begint vandaag' }
    if (t.dagenTotStart === 1) return { urgentie: 'morgen', tekst: 'begint morgen' }
    return {
      urgentie: t.dagenTotStart <= BINNENKORT ? 'binnenkort' : 'later',
      tekst: `begint over ${dagen(t.dagenTotStart)}`,
    }
  }

  // Staat er en mag blijven staan. Alleen het einde is interessant:
  // daar wordt hij morgen een afmeldregel.
  if (t.dagenNaEind === -1) return { urgentie: 'morgen', tekst: 'morgen ophalen' }
  return { urgentie: 'later', tekst: `nog ${dagen(-t.dagenNaEind)} te gaan` }
}

export interface Urgentiekleur {
  /** Het streepje links van de regel. */
  rand: string
  /** Het vlak achter het pictogram. */
  vak: string
  /** Tekst- en pictogramkleur, ook voor het chipje. */
  tekst: string
  /** Achtergrond van het chipje. */
  chip: string
}

export const URGENTIES: Record<Urgentie, Urgentiekleur> = {
  te_laat: {
    rand: 'bg-red-500',
    vak: 'bg-red-50 dark:bg-red-500/10',
    tekst: 'text-red-700 dark:text-red-400',
    chip: 'bg-red-50 dark:bg-red-500/10',
  },
  vandaag: {
    rand: 'bg-orange-500',
    vak: 'bg-orange-50 dark:bg-orange-500/10',
    tekst: 'text-orange-700 dark:text-orange-400',
    chip: 'bg-orange-50 dark:bg-orange-500/10',
  },
  morgen: {
    rand: 'bg-orange-400',
    vak: 'bg-orange-50 dark:bg-orange-500/10',
    tekst: 'text-orange-700 dark:text-orange-400',
    chip: 'bg-orange-50 dark:bg-orange-500/10',
  },
  binnenkort: {
    rand: 'bg-blue-500',
    vak: 'bg-blue-50 dark:bg-blue-500/10',
    tekst: 'text-blue-700 dark:text-blue-400',
    chip: 'bg-blue-50 dark:bg-blue-500/10',
  },
  later: {
    rand: 'bg-gray-200 dark:bg-white/15',
    vak: 'bg-surface-2 dark:bg-white/5',
    tekst: 'text-gray-500 dark:text-white/50',
    chip: 'bg-surface-2 dark:bg-white/5',
  },
}

export function urgentiekleur(t: Termijn, stapel: Stapel): Urgentiekleur {
  return URGENTIES[bestelstand(t, stapel).urgentie]
}

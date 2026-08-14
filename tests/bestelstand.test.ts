import { describe, it, expect } from 'vitest'
import { bestelstand, urgentiekleur, URGENTIES, type Urgentie } from '@/lib/bestelstand'

// ============================================================
// Wat deze test bewaakt
// ============================================================
// De regels van de containerlijst stonden allemaal in hetzelfde grijs.
// "3 dagen over de datum" — huur die doorloopt — las precies zoals
// "begint over 8 dagen". De tekst en de kleur komen nu uit één tabel,
// en deze test houdt vast wélk geval welk woord en welke kleur krijgt.
//
// De grens tussen te laat en op tijd is waar het geld zit, dus die
// staat er met dag −1, 0 en 1 omheen in.
// ============================================================

describe('afmelden — de opleverdatum telt', () => {
  it('noemt een overschrijding in dagen en zet hem op rood', () => {
    const s = bestelstand({ dagenTotStart: -9, dagenNaEind: 3 }, 'afmelden')
    expect(s.urgentie).toBe('te_laat')
    expect(s.tekst).toBe('3 dagen over de datum')
  })

  it('houdt het enkelvoud heel', () => {
    expect(bestelstand({ dagenTotStart: -5, dagenNaEind: 1 }, 'afmelden').tekst)
      .toBe('1 dag over de datum')
  })

  it('zet de opleverdag zelf op oranje en niet op rood', () => {
    // Vandaag is de dag: bellen kan nog, dus dat is een waarschuwing en
    // geen alarm.
    const s = bestelstand({ dagenTotStart: -4, dagenNaEind: 0 }, 'afmelden')
    expect(s.urgentie).toBe('vandaag')
    expect(s.tekst).toBe('vandaag afmelden')
  })
})

describe('bestellen — de startdatum telt', () => {
  it('is te laat zodra de klus begonnen is', () => {
    const s = bestelstand({ dagenTotStart: -1, dagenNaEind: -4 }, 'bestellen')
    expect(s.urgentie).toBe('te_laat')
    expect(s.tekst).toBe('de klus is al begonnen')
  })

  it('onderscheidt vandaag, morgen en de dagen daarna', () => {
    expect(bestelstand({ dagenTotStart: 0, dagenNaEind: -5 }, 'bestellen').tekst).toBe('begint vandaag')
    expect(bestelstand({ dagenTotStart: 1, dagenNaEind: -6 }, 'bestellen').tekst).toBe('begint morgen')
    expect(bestelstand({ dagenTotStart: 2, dagenNaEind: -7 }, 'bestellen').tekst).toBe('begint over 2 dagen')
  })

  it('kleurt binnen drie dagen mee en daarbuiten niet', () => {
    expect(bestelstand({ dagenTotStart: 3, dagenNaEind: -8 }, 'bestellen').urgentie).toBe('binnenkort')
    expect(bestelstand({ dagenTotStart: 4, dagenNaEind: -9 }, 'bestellen').urgentie).toBe('later')
  })
})

describe('staat er — alleen het einde is nog interessant', () => {
  it('waarschuwt de dag ervoor', () => {
    const s = bestelstand({ dagenTotStart: -3, dagenNaEind: -1 }, 'staat_er')
    expect(s.urgentie).toBe('morgen')
    expect(s.tekst).toBe('morgen ophalen')
  })

  it('telt de resterende dagen af', () => {
    expect(bestelstand({ dagenTotStart: -2, dagenNaEind: -4 }, 'staat_er').tekst).toBe('nog 4 dagen te gaan')
    expect(bestelstand({ dagenTotStart: -2, dagenNaEind: -4 }, 'staat_er').urgentie).toBe('later')
  })
})

describe('de kleuren', () => {
  it('heeft voor elke urgentie een volledige set', () => {
    const alle: Urgentie[] = ['te_laat', 'vandaag', 'morgen', 'binnenkort', 'later']
    for (const u of alle) {
      const k = URGENTIES[u]
      expect(k.rand, `${u} heeft een rand`).toBeTruthy()
      expect(k.vak, `${u} heeft een vak`).toBeTruthy()
      expect(k.tekst, `${u} heeft een tekstkleur`).toBeTruthy()
      expect(k.chip, `${u} heeft een chipkleur`).toBeTruthy()
    }
  })

  it('geeft elke kleur ook een dark-variant, behalve de volle merkloze vlakken', () => {
    // Licht en donker zijn gelijkwaardig (zie .ai/CLAUDE.md). Een
    // `bg-red-500` is in beide thema's rood en heeft er geen nodig; een
    // tint van vijf procent wél, anders valt hij in het donker weg.
    for (const k of Object.values(URGENTIES)) {
      for (const klasse of [k.vak, k.tekst, k.chip]) {
        expect(klasse.includes('dark:'), `${klasse} mist een dark-variant`).toBe(true)
      }
    }
  })

  it('gebruikt geen geel — dat is van het merk', () => {
    // Geel zijn de knoppen, vandaag en de voortgang. Een dringende
    // container in dezelfde kleur als de primaire knop zou de betekenis
    // van beide slopen.
    for (const k of Object.values(URGENTIES)) {
      expect(JSON.stringify(k)).not.toMatch(/yellow|amber/)
    }
  })

  it('geeft de kleur die bij de stand hoort', () => {
    expect(urgentiekleur({ dagenTotStart: -9, dagenNaEind: 2 }, 'afmelden')).toBe(URGENTIES.te_laat)
    expect(urgentiekleur({ dagenTotStart: 8, dagenNaEind: -12 }, 'bestellen')).toBe(URGENTIES.later)
  })
})

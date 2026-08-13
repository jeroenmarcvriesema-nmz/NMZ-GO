import { describe, it, expect } from 'vitest'
import { leesVoorzieningen, omschrijf } from '../src/lib/voorzieningen'

// Elk fragment hieronder komt uit een échte werkopdracht in de
// database. Het sjabloon is in de loop van de jaren veranderd en wordt
// door verschillende inspecteurs ingevuld, dus de vormen lopen uiteen —
// en juist daarop moet deze lezer bestand zijn, want de uitkomst is een
// bestelling bij een derde partij.

describe('leesVoorzieningen', () => {
  it('leest de gewone vorm met vraagteken', () => {
    const t = '● Container? Ja 10m3\n● Dixi? Ja\n● Kluiscode 3666'
    const v = leesVoorzieningen(t)
    expect(v.container).toMatchObject({ nodig: 'ja', kuub: 10 })
    expect(v.dixi.nodig).toBe('ja')
  })

  it('leest de vorm zonder vraagteken en met spatie voor de maat', () => {
    const t = '● Container Ja 6 m3\n● Dixi Nee\n● Container op tijd bestellen!!'
    const v = leesVoorzieningen(t)
    expect(v.container).toMatchObject({ nodig: 'ja', kuub: 6 })
    expect(v.dixi.nodig).toBe('nee')
  })

  // Cabotstraat 1: de tekst is aan elkaar geplakt en er staat geen "ja",
  // alleen een maat. Een container van zes kuub is een container.
  it('leest een maat zonder ja als ja, ook als de tekst aan elkaar plakt', () => {
    const t = 'BELLEN!!!!Container?\n6m3Dixi? Ja Naam: Alvast B.V.'
    const v = leesVoorzieningen(t)
    expect(v.container).toMatchObject({ nodig: 'ja', kuub: 6 })
    expect(v.dixi.nodig).toBe('ja')
  })

  // Lekstraat 33HS: "Neebewoners" — zonder knippen op het volgende
  // kopje vindt \bnee\b hier niets.
  it('knipt op het volgende kopje, ook zonder spatie ertussen', () => {
    const t = 'Container? Nee puinzakkenDixi? Neebewoners tel.nr. 06-28187391'
    const v = leesVoorzieningen(t)
    expect(v.container.nodig).toBe('nee')
    expect(v.dixi.nodig).toBe('nee')
  })

  // Overtoom 339-341: de vraag staat in de tekst en het antwoord erachter.
  // Zonder de sjabloontekst weg te strepen leest dit als "ja".
  it('negeert de sjabloonvraag en leest het antwoord erachter', () => {
    const t = '● Container? Ja of Nee incl. aantal m3. Nee puinzak voor wat pleisterwerk\n'
            + '● Dixi? Ja of nee nee\n● Evt. andere informatie'
    const v = leesVoorzieningen(t)
    expect(v.container.nodig).toBe('nee')
    expect(v.container.kuub).toBeNull()
    expect(v.dixi.nodig).toBe('nee')
  })

  // Bonairestraat 88HS: tussen de vraag en het antwoord staat een lange
  // toelichting tussen haakjes — mét een maat die niet het antwoord is.
  it('slaat een maat tussen haakjes over en pakt het echte antwoord', () => {
    const t = '● Container? Ja of Nee incl. aantal m3. (bij een 10m3 is dit altijd een '
            + 'dichte container tenzij anders aangegeven, incl. welke dag!) JA 6m3\n'
            + '● Dixi? Ja of nee Nee'
    const v = leesVoorzieningen(t)
    expect(v.container).toMatchObject({ nodig: 'ja', kuub: 6 })
    expect(v.dixi.nodig).toBe('nee')
  })

  // Hertog Albrechtstraat 19: alleen een maat, en geen dixi-regel.
  it('zegt "onbekend" als er niets over staat, en gokt geen nee', () => {
    const t = '● Container 3m3 bouw/sloop op dag 1\n● Kluiscode 3019'
    const v = leesVoorzieningen(t)
    expect(v.container).toMatchObject({ nodig: 'ja', kuub: 3 })
    expect(v.dixi.nodig).toBe('onbekend')
  })

  it('houdt een tweede container-regel buiten het antwoord', () => {
    const t = '● Container Ja 6 m3\n● Dixi Nee\n● Container op tijd bestellen!! '
            + 'Is een klus van 2 dagen!!'
    expect(leesVoorzieningen(t).container.kuub).toBe(6)
  })

  // "Ja 2x 10m3" en "10 m3 (2x)" komen allebei voor. Eén container
  // bestellen waar er twee moeten staan is een halve klus.
  it('leest hoeveel containers er nodig zijn', () => {
    expect(leesVoorzieningen('● Container? Ja 2x 10m3\n● Dixi? Ja gezamelijk').container)
      .toMatchObject({ nodig: 'ja', kuub: 10, aantal: 2 })
    expect(leesVoorzieningen("● Container: 10 m3 (2x)\n● Dixi: Ja").container)
      .toMatchObject({ nodig: 'ja', kuub: 10, aantal: 2 })
  })

  it('houdt het aantal op één als er niets over staat', () => {
    expect(leesVoorzieningen('● Container? Ja 6m3').container.aantal).toBe(1)
  })

  it('leest "Negatief" als nee', () => {
    const v = leesVoorzieningen('● Container Negatief; puin/afval meenemen\n● Dixi? Nee')
    expect(v.container.nodig).toBe('nee')
  })

  it('geeft niets terug bij een lege werkvoorbereiding', () => {
    for (const leeg of [null, undefined, '']) {
      const v = leesVoorzieningen(leeg)
      expect(v.container.nodig).toBe('onbekend')
      expect(v.dixi.nodig).toBe('onbekend')
    }
  })
})

describe('omschrijf', () => {
  it('zet de maat voorop als die er is', () => {
    expect(omschrijf({ nodig: 'ja', kuub: 10, aantal: 1, ruw: null })).toBe('10 m³')
    expect(omschrijf({ nodig: 'ja', kuub: null, aantal: 1, ruw: null })).toBe('ja')
    expect(omschrijf({ nodig: 'nee', kuub: null, aantal: 1, ruw: null })).toBe('nee')
    expect(omschrijf({ nodig: 'ja', kuub: 10, aantal: 2, ruw: null })).toBe('2× 10 m³')
  })

  // "Niet vermeld" en "nee" mogen nooit hetzelfde woord krijgen: het
  // eerste vraagt om een telefoontje, het tweede juist niet.
  it('onderscheidt niet-vermeld van nee', () => {
    expect(omschrijf({ nodig: 'onbekend', kuub: null, aantal: 1, ruw: null })).toBe('niet vermeld')
  })
})

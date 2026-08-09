import { describe, it, expect } from 'vitest'
import { naarCsv } from '@/lib/export'

// De export gaat naar Excel op een Nederlandse Windows-machine. Gaat
// het scheidingsteken of de codering mis, dan staat alles in één kolom
// of zijn de accenten onleesbaar — en dan belt kantoor over een
// "kapotte export" terwijl de gegevens kloppen.

describe('naarCsv', () => {
  it('scheidt met puntkomma en begint met een BOM', () => {
    const csv = naarCsv(['a', 'b'], [[1, 2]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('a;b')
    expect(csv).toContain('1;2')
  })

  it('gebruikt regeleindes die Excel begrijpt', () => {
    expect(naarCsv(['a'], [['x']])).toContain('\r\n')
  })

  it('omsluit een adres met een puntkomma erin', () => {
    // "Rembrandstraat 79 t/m 129; achterzijde" zou anders twee kolommen
    // worden en de hele rij verschuiven.
    const csv = naarCsv(['adres'], [['Kerkstraat 3; achterzijde']])
    expect(csv).toContain('"Kerkstraat 3; achterzijde"')
  })

  it('verdubbelt aanhalingstekens in de tekst', () => {
    const csv = naarCsv(['reden'], [['bewoner zei "niet thuis"']])
    expect(csv).toContain('"bewoner zei ""niet thuis"""')
  })

  it('omsluit een veld met een regelovergang', () => {
    const csv = naarCsv(['notitie'], [['regel een\nregel twee']])
    expect(csv).toContain('"regel een\nregel twee"')
  })

  it('maakt van leeg en ontbrekend een lege cel, niet "null"', () => {
    const csv = naarCsv(['a', 'b', 'c'], [[null, undefined, '']])
    expect(csv.split('\r\n')[1]).toBe(';;')
  })
})

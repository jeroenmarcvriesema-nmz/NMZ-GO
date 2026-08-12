import { describe, it, expect } from 'vitest'
import { herkenPunten, verwerkAntwoord } from '../src/lib/opdracht'

// Wat hier getest wordt is het deel dat zonder netwerk werkt: de
// herkenning van losse punten en het omzetten van het antwoord van de
// edge function. Het lezen van de PDF zelf gebeurt in die functie en
// wordt getest via tests/ontleden.test.ts — dezelfde parser.

describe('herkenPunten', () => {
  it('herkent genummerde regels', () => {
    expect(herkenPunten('1. CV-ketel controleren\n2) Radiatoren ontluchten\n3 Kruipruimte'))
      .toEqual(['CV-ketel controleren', 'Radiatoren ontluchten', 'Kruipruimte'])
  })

  it('herkent opsommingstekens', () => {
    expect(herkenPunten('- Lekkage inspectie\n• Bodemafsluiter\n* Kelder\n→ Zolder'))
      .toEqual(['Lekkage inspectie', 'Bodemafsluiter', 'Kelder', 'Zolder'])
  })

  it('slaat regels zonder teken over, zodat een tussenkop geen taak wordt', () => {
    const tekst = 'Uit te voeren werkzaamheden:\n- Balklaag behandelen\nVervolg van de zin\n- Vloer terugleggen'
    expect(herkenPunten(tekst)).toEqual(['Balklaag behandelen', 'Vloer terugleggen'])
  })

  it('geeft een lege lijst bij tekst zonder opsomming', () => {
    expect(herkenPunten('Gewoon een alinea zonder punten.')).toEqual([])
  })
})

describe('verwerkAntwoord', () => {
  it('neemt de punten en de kopvelden over bij een herkend sjabloon', () => {
    const { opdracht, fout } = verwerkAntwoord({
      sjabloon: true,
      punten: ['Balklaag behandelen', 'Vloer terugleggen'],
      weggelaten: ['Parkeerkosten'],
      werkvoorbereiding: 'Compartiment 1',
      opdrachtnummer: '7020',
      adres: 'Bentinckstraat 12, Den Haag',
      inspecteur: 'R. de Vries',
      inspecteurTelefoon: '06-12345678',
      kluiscode: '4444',
    })

    expect(fout).toBeNull()
    expect(opdracht?.sjabloon).toBe(true)
    expect(opdracht?.punten).toHaveLength(2)
    expect(opdracht?.weggelaten).toEqual(['Parkeerkosten'])
    expect(opdracht?.kluiscode).toBe('4444')
    expect(opdracht?.reden).toBeNull()
  })

  it('valt terug op de opsommingsherkenning als het sjabloon niet klopt', () => {
    const { opdracht, fout } = verwerkAntwoord({
      sjabloon: false,
      reden: 'De kop "Uit te voeren werkzaamheden" staat niet in deze opdracht.',
      regels: ['Werkzaamheden', '1. Dakgoot reinigen', '2. Kozijn schilderen'],
    })

    expect(fout).toBeNull()
    expect(opdracht?.sjabloon).toBe(false)
    expect(opdracht?.punten).toEqual(['Dakgoot reinigen', 'Kozijn schilderen'])
    // Geen sjabloon betekent geen kopvelden: die zou je anders uit een
    // willekeurig document overnemen op de bon.
    expect(opdracht?.kluiscode).toBeNull()
    expect(opdracht?.werkvoorbereiding).toBeNull()
    expect(opdracht?.reden).toContain('Uit te voeren werkzaamheden')
  })

  it('geeft een fout als ook de terugval niets oplevert', () => {
    const { opdracht, fout } = verwerkAntwoord({
      sjabloon: false,
      reden: 'Waarschijnlijk wijkt deze opdracht af van het sjabloon.',
      regels: ['Een brief zonder opsomming.', 'Nog een regel.'],
    })

    expect(opdracht).toBeNull()
    expect(fout).toContain('geen punten herkend')
  })

  it('geeft de fout van de functie door', () => {
    const { opdracht, fout } = verwerkAntwoord({ fout: 'Deze PDF is niet te lezen.' })
    expect(opdracht).toBeNull()
    expect(fout).toBe('Deze PDF is niet te lezen.')
  })

  it('valt niet om zonder antwoord', () => {
    const { opdracht, fout } = verwerkAntwoord(null)
    expect(opdracht).toBeNull()
    expect(fout).toBeTruthy()
  })
})

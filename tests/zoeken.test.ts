import { describe, it, expect } from 'vitest'
import { zoektMee, filterOpZoek, type Doorzoekbaar } from '@/lib/zoeken'

// ============================================================
// Wat deze test bewaakt
// ============================================================
// Het zoekveld op de werkbonnenpagina keek naar adres, projectnaam en
// medewerker. Twee daarvan zijn in de praktijk leeg: sinds de klussen
// uit ClickUp komen heeft geen enkele bon een projectnaam, en de
// meeste bonnen hebben nog geen ploeg. Er bleef één veld over.
//
// Gevolg: zoeken op de plaats ("Assendelft"), op een postcode, op een
// bonnummer of op het opdrachtnummer dat de opdrachtgever noemt gaf
// nul resultaten terwijl de klus er gewoon stond. Die velden bestaan
// allemaal in de database — er werd alleen niet in gekeken.
// ============================================================

const KLUS: Doorzoekbaar = {
  adres: 'Scheibeekstraat 9',
  plaats: 'Assendelft',
  postcode: '1566 AB',
  projectnaam: '',
  opdrachtnummer: 'C515',
  bonnummer: '2024-0187',
  opdrachtgever: 'Parteon',
  kluiscode: '4821',
  inspecteur: 'Mario',
  medewerkers: [{ naam: 'Anthony' }, { naam: 'Youssef' }],
}

describe('zoektMee', () => {
  it('vindt op straatnaam', () => {
    expect(zoektMee(KLUS, 'scheibeek')).toBe(true)
  })

  // Dit is het geval waar het om begon. De plaats staat in een eigen
  // kolom en niet in `adres`, dus de oude filter kon hem nooit vinden.
  it('vindt op plaats', () => {
    expect(zoektMee(KLUS, 'Assendelft')).toBe(true)
  })

  // In de database staat "1566 AB", op het briefje in de bus staat
  // "1566AB". Allebei hoort te werken.
  it('vindt een postcode met en zonder spatie', () => {
    expect(zoektMee(KLUS, '1566 AB')).toBe(true)
    expect(zoektMee(KLUS, '1566ab')).toBe(true)
  })

  it('vindt op bonnummer en op opdrachtnummer', () => {
    expect(zoektMee(KLUS, '2024-0187')).toBe(true)
    expect(zoektMee(KLUS, 'c515')).toBe(true)
  })

  it('vindt op opdrachtgever, kluiscode en inspecteur', () => {
    expect(zoektMee(KLUS, 'parteon')).toBe(true)
    expect(zoektMee(KLUS, '4821')).toBe(true)
    expect(zoektMee(KLUS, 'mario')).toBe(true)
  })

  it('vindt op de naam van iemand uit de ploeg', () => {
    expect(zoektMee(KLUS, 'youssef')).toBe(true)
  })

  // Twee woorden brengen een lijst terug tot één regel. Ze hoeven niet
  // in hetzelfde veld te staan — "assendelft anthony" is plaats plus
  // man, en dat is precies hoe iemand het opzoekt.
  it('eist bij meerdere woorden dat ze allemaal voorkomen', () => {
    expect(zoektMee(KLUS, 'assendelft anthony')).toBe(true)
    expect(zoektMee(KLUS, 'assendelft bakker')).toBe(false)
  })

  it('trekt zich niets aan van hoofdletters', () => {
    expect(zoektMee(KLUS, 'ASSENDELFT')).toBe(true)
  })

  it('geeft niets terug wat er niet is', () => {
    expect(zoektMee(KLUS, 'zaandam')).toBe(false)
  })

  // Geen zoekterm is geen filter — anders verdwijnt de hele lijst
  // zodra iemand het veld leegmaakt.
  it('laat alles staan bij een lege zoekterm', () => {
    expect(zoektMee(KLUS, '')).toBe(true)
    expect(zoektMee(KLUS, '   ')).toBe(true)
  })

  // Een halfgevulde bon is bij ons de normale toestand: van de dertig
  // klussen heeft er geen één een postcode. Dat mag niet klappen.
  it('overleeft lege en ontbrekende velden', () => {
    const kaal: Doorzoekbaar = { adres: 'Kerkstraat 1', plaats: null, postcode: null }
    expect(zoektMee(kaal, 'kerkstraat')).toBe(true)
    expect(zoektMee(kaal, 'assendelft')).toBe(false)
    expect(zoektMee({}, 'kerkstraat')).toBe(false)
  })
})

describe('filterOpZoek', () => {
  const lijst: Doorzoekbaar[] = [
    KLUS,
    { adres: 'Kerkstraat 1', plaats: 'Zaandam' },
    { adres: 'Dorpsstraat 12', plaats: 'Assendelft' },
  ]

  it('filtert op plaats', () => {
    expect(filterOpZoek(lijst, 'assendelft')).toHaveLength(2)
  })

  it('houdt de lijst intact zonder zoekterm', () => {
    expect(filterOpZoek(lijst, '')).toBe(lijst)
  })
})

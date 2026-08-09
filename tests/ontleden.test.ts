import { describe, it, expect } from 'vitest'
import { ontleed, kopveld } from '../supabase/functions/verwerker/ontleden'

// De opdrachten zelf staan in Supabase Storage en zijn hier niet
// bereikbaar. Wat hieronder staat is het sjabloon zoals het uit de
// tekstlaag komt: regels op y-positie hersteld, opsommingstekens als
// losse 'o', en de eigenaardigheden die echte opdrachten vertonen.
//
// Elke test hieronder hoort bij een fout die daadwerkelijk is
// voorgekomen. Dat is de reden dat ze bestaan: niet om dekking te
// halen, maar om te voorkomen dat een van deze zes dingen opnieuw
// gebeurt zonder dat iemand het merkt.

const UITGESLOTEN = ['parkeerkosten', 'brandstoftoeslag', 'klein materiaal']

const OPDRACHT = [
  'Opdrachtnummer : 7020',
  'Inzake : Bentinckstraat 12, Den Haag',
  'Inspecteur : R. de Vries',
  'Telefoonnummer : 06-12345678',
  '● Kluiscode 4444',
  'Werkvoorbereiding:',
  'Compartiment 1',
  'Rechterkant kruipruimte, bereikbaar via het luik in de hal.',
  'Preparaat: Boracol 20',
  'Let op: foto\'s van alle uit te voeren werkzaamheden maken, zie bijlage:',
  'Uit te voeren werkzaamheden S&M Nooitmeerzwam:',
  'o Kruipruimte volledig ontruimen en puin afvoeren',
  'o Aangetast hout verwijderen en afvoeren, inclusief de balkkoppen aan',
  'de rechterzijde van het compartiment',
  'o Metselwerk behandelen met Boracol 20',
  'o Parkeerkosten',
  'Datum oplevering: _______',
  'Naam en handtekening',
].join('\n')

describe('ontleed — een gewone werkopdracht', () => {
  const uit = ontleed(OPDRACHT, UITGESLOTEN)

  it('leest de kopvelden', () => {
    expect(uit.opdrachtnummer).toBe('7020')
    expect(uit.adres).toBe('Bentinckstraat 12, Den Haag')
    expect(uit.inspecteur).toBe('R. de Vries')
    expect(uit.inspecteurTelefoon).toBe('06-12345678')
    expect(uit.kluiscode).toBe('4444')
  })

  it('houdt de punten over die uitgevoerd moeten worden', () => {
    expect(uit.punten).toHaveLength(3)
    expect(uit.punten[0]).toBe('Kruipruimte volledig ontruimen en puin afvoeren')
    expect(uit.punten[2]).toBe('Metselwerk behandelen met Boracol 20')
  })

  it('plakt een afgebroken zin aan het punt erboven', () => {
    // Zonder deze regel werd "de rechterzijde van het compartiment"
    // een eigen afvinkpunt, en dat is geen werk maar een halve zin.
    expect(uit.punten[1]).toBe(
      'Aangetast hout verwijderen en afvoeren, inclusief de balkkoppen aan de rechterzijde van het compartiment',
    )
  })

  it('laat administratieve regels weg maar verzwijgt ze niet', () => {
    expect(uit.punten).not.toContain('Parkeerkosten')
    expect(uit.weggelaten).toEqual(['Parkeerkosten'])
  })

  it('neemt de láátste kop, niet de eerste die erop lijkt', () => {
    // "Let op: foto's van alle uit te voeren werkzaamheden ... bijlage:"
    // voldoet aan hetzelfde patroon. Nam de parser de eerste treffer,
    // dan begonnen de punten midden in de werkvoorbereiding en kwamen
    // er regels als afvinkpunt op de bon die dat niet zijn.
    expect(uit.punten.some((p) => p.includes('Compartiment'))).toBe(false)
    expect(uit.werkvoorbereiding).toContain('Rechterkant kruipruimte')
    expect(uit.werkvoorbereiding).toContain('Let op:')
  })

  it('stopt bij de ondertekening', () => {
    expect(uit.punten.some((p) => p.includes('Datum oplevering'))).toBe(false)
    expect(uit.punten.some((p) => p.includes('handtekening'))).toBe(false)
  })
})

describe('ontleed — opdrachten die afwijken', () => {
  it('herkent genummerde punten', () => {
    // De opdrachten voor alleen een bodemafsluiter gebruiken 1. 2. 3.
    // in plaats van bolletjes. Met alleen het bolletje-patroon leverde
    // dat nul punten op en viel de taak eruit als onleesbaar.
    const genummerd = [
      'Opdrachtnummer : 7099',
      'Inzake : Kerkstraat 3',
      'Uit te voeren werkzaamheden:',
      '1. Bodemafsluiter aanbrengen',
      '2. Naden afkitten',
      '10. Eindcontrole uitvoeren',
      'Datum oplevering:',
    ].join('\n')

    const uit = ontleed(genummerd, UITGESLOTEN)
    expect(uit.punten).toEqual([
      'Bodemafsluiter aanbrengen',
      'Naden afkitten',
      'Eindcontrole uitvoeren',
    ])
  })

  it('leest geen kopje als kluiscode wanneer het veld leeg is', () => {
    // Uit de tekstlaag komt een leeg veld terug als "● Kluiscode
    // Werkvoorbereiding:" — het kopje eronder schuift mee omhoog. De
    // bon kreeg dan "Werkvoorbereiding:" als kluiscode, en daar staat
    // een zwamsaneerder mee voor een kluisje.
    const leeg = [
      '● Kluiscode Werkvoorbereiding:',
      'Uit te voeren werkzaamheden:',
      'o Iets doen',
    ].join('\n')

    expect(ontleed(leeg, UITGESLOTEN).kluiscode).toBeNull()
  })

  it('geeft een leeg invulveld niet door als waarde', () => {
    expect(kopveld('Datum aanvang: _______', 'Datum aanvang')).toBeNull()
    expect(kopveld('Opdrachtnummer:   ', 'Opdrachtnummer')).toBeNull()
  })

  it('weigert een opdracht zonder de kop, met uitleg', () => {
    const zonder = 'Opdrachtnummer : 1\nInzake : Ergens\no Iets doen'
    expect(() => ontleed(zonder, UITGESLOTEN)).toThrow(/Uit te voeren werkzaamheden/)
  })

  it('weigert een opdracht waarvan alles is uitgesloten', () => {
    // Stil doorgaan zou een lege werkbon opleveren; die komt op maandag
    // bij iemand terecht die niet weet wat hij moet doen.
    const leeg = 'Uit te voeren werkzaamheden:\no Parkeerkosten\no Klein materiaal'
    expect(() => ontleed(leeg, UITGESLOTEN)).toThrow(/Geen uit te voeren punten/)
  })

  it('is hoofdletterongevoelig op de kop', () => {
    const raar = 'UIT TE VOEREN WERKZAAMHEDEN S&M:\no Iets doen'
    expect(ontleed(raar, UITGESLOTEN).punten).toEqual(['Iets doen'])
  })
})

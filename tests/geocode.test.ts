import { describe, it, expect } from 'vitest'
import { schoonAdres, leesPunt, inNederland } from '../supabase/functions/verwerker/geocode'

// De adressen hieronder staan letterlijk zo in de database. Elk van
// deze vormen brengt een geocodeerder van zijn stuk, en een adres dat
// niet gevonden wordt betekent geen afstandscontrole op die klus.

describe('schoonAdres', () => {
  it('maakt van " te " een komma', () => {
    expect(schoonAdres('Bonairestraat 88HS te Amsterdam')).toBe('Bonairestraat 88HS, Amsterdam')
  })

  it('houdt bij een reeks huisnummers het eerste aan', () => {
    // Een reeks is geen adres. Het eerste nummer is een deur die
    // bestaat; het midden van de straat is dat niet.
    expect(schoonAdres('Rembrandstraat 79 t/m 129 te Den Haag'))
      .toBe('Rembrandstraat 79, Den Haag')
    expect(schoonAdres('Transvaalkade 111 A/B te Amsterdam'))
      .toContain('Transvaalkade 111')
  })

  it('haalt toelichting tussen haakjes en "e.o." weg', () => {
    expect(schoonAdres('Klaas Katerstraat e.o. te Zaandam (Logchies)'))
      .toBe('Klaas Katerstraat, Zaandam')
  })

  it('haalt een projectnummer vooraan weg', () => {
    // "1925" is het project, niet het huisnummer.
    expect(schoonAdres('1925 Bloem Fonteinstraat 8 te Haarlem'))
      .toBe('Bloem Fonteinstraat 8, Haarlem')
  })

  it('laat een adres dat al goed staat met rust', () => {
    expect(schoonAdres('Grote Bickersstraat 28-A, Amsterdam'))
      .toBe('Grote Bickersstraat 28-A, Amsterdam')
    expect(schoonAdres('Amsteldijk 157 HS te Amsterdam'))
      .toBe('Amsteldijk 157 HS, Amsterdam')
  })

  it('geeft niets terug bij niets', () => {
    expect(schoonAdres(null)).toBe('')
    expect(schoonAdres('   ')).toBe('')
  })
})

describe('leesPunt', () => {
  it('leest lengte en breedte in de volgorde van PDOK', () => {
    // POINT zet de lengtegraad eerst. Omdraaien zet de Dam ergens in
    // de Noordzee, en dat is een fout die er plausibel uitziet.
    const p = leesPunt('POINT(4.892 52.373)')
    expect(p).toEqual({ lat: 52.373, lon: 4.892 })
  })

  it('geeft niets terug bij onzin', () => {
    expect(leesPunt(null)).toBeNull()
    expect(leesPunt('ergens in Amsterdam')).toBeNull()
    expect(leesPunt('POINT(a b)')).toBeNull()
  })
})

describe('inNederland', () => {
  it('herkent een punt binnen en buiten het land', () => {
    expect(inNederland({ lat: 52.373, lon: 4.892 })).toBe(true)
    expect(inNederland({ lat: 48.858, lon: 2.294 })).toBe(false)
    // De klassieke omgedraaide coordinaat.
    expect(inNederland({ lat: 4.892, lon: 52.373 })).toBe(false)
  })
})

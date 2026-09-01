import { describe, it, expect } from 'vitest'
import { openStandaardpunt, magAfvinkenOpVolgorde } from '@/lib/standaardpunt'

// Deze regel bestaat om een veiligheidsreden en niet om een
// administratieve: het rode gevarenblad hoort op de deur voordat er
// binnen met middelen wordt gewerkt. Een test die alleen "de gelukkige
// route" afdekt is hier te weinig — het gaat juist om de gevallen
// waarin iemand dénkt dat hij verder mag.

const blad = (voltooid: boolean) => ({ voltooid, standaard: true, titel: 'veiligheidsblad' })
const punt = (voltooid = false) => ({ voltooid, standaard: false, titel: 'gewoon punt' })

describe('standaardpunt', () => {
  it('vindt het openstaande standaardpunt', () => {
    const punten = [blad(false), punt()]
    expect(openStandaardpunt(punten)).toBe(punten[0])
  })

  it('geeft null zodra het standaardpunt af is', () => {
    expect(openStandaardpunt([blad(true), punt()])).toBeNull()
  })

  it('geeft null op een bon zonder standaardpunt', () => {
    // De bonnen van vóór migratie 045. Die houden niets tegen.
    expect(openStandaardpunt([punt(), punt(true)])).toBeNull()
  })

  it('houdt een gewoon punt tegen zolang het blad openstaat', () => {
    const punten = [blad(false), punt()]
    expect(magAfvinkenOpVolgorde(punten[1], punten)).toBe(false)
  })

  // De kern van de melding: foto's spelen een punt niet vrij.
  it('houdt een gewoon punt óók tegen als er foto’s onder staan', () => {
    const metFotos = { ...punt(), fotos: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }
    const punten = [blad(false), metFotos]
    expect(magAfvinkenOpVolgorde(metFotos, punten)).toBe(false)
  })

  it('laat een gewoon punt door zodra het blad af is', () => {
    const punten = [blad(true), punt()]
    expect(magAfvinkenOpVolgorde(punten[1], punten)).toBe(true)
  })

  it('houdt het standaardpunt nooit tegen door zichzelf', () => {
    const punten = [blad(false), punt()]
    expect(magAfvinkenOpVolgorde(punten[0], punten)).toBe(true)
  })

  it('houdt niets tegen op een bon zonder standaardpunt', () => {
    const punten = [punt(), punt()]
    expect(magAfvinkenOpVolgorde(punten[0], punten)).toBe(true)
  })

  // Een ontbrekende kolom is geen open standaardpunt. Sommige
  // lijstschermen halen alleen de kolommen op die ze tekenen.
  it('leest een ontbrekende vlag als "geen standaardpunt"', () => {
    const punten = [{ voltooid: false }, { voltooid: false }]
    expect(openStandaardpunt(punten)).toBeNull()
    expect(magAfvinkenOpVolgorde(punten[0], punten)).toBe(true)
  })
})

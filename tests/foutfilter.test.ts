import { describe, it, expect } from 'vitest'
import { vanOnsZelf } from '@/lib/foutfilter'

// De storingenlijst op het dashboard is alleen iets waard als alles wat
// erin staat ook echt van ons is. Loopt hij vol met meldingen van
// browserextensies, dan kijkt niemand er ooit nog naar — en dan is het
// net zo blind als vóór de foutmonitoring.

describe('vanOnsZelf', () => {
  it('laat een echte fout uit onze eigen code door', () => {
    expect(vanOnsZelf('Cannot read properties of null (reading \'taken\')')).toBe(true)
    expect(vanOnsZelf('werkbon aanmaken mislukt: duplicate key')).toBe(true)
    expect(vanOnsZelf('[werkbon] onbekende status')).toBe(true)
  })

  it('houdt wallet-extensies buiten de deur', () => {
    // Dit is de melding die echt binnenkwam.
    expect(vanOnsZelf('Failed to connect to MetaMask')).toBe(false)
    expect(vanOnsZelf('ethereum is not defined')).toBe(false)
    expect(vanOnsZelf('Cannot redefine property: web3')).toBe(false)
    expect(vanOnsZelf('Phantom provider not found')).toBe(false)
  })

  it('houdt alles buiten dat uit een extensie komt', () => {
    expect(vanOnsZelf('TypeError: x is undefined', 'at chrome-extension://abcdef/inject.js:1')).toBe(false)
    expect(vanOnsZelf('TypeError', 'at moz-extension://1234/content.js:9')).toBe(false)
  })

  it('negeert een inhoudsloze scriptfout van een ander domein', () => {
    // Zonder inhoud valt er niets mee te beginnen, en het zegt niets
    // over onze code.
    expect(vanOnsZelf('Script error.')).toBe(false)
    expect(vanOnsZelf('Script error')).toBe(false)
  })

  it('negeert een afgebroken verzoek', () => {
    // Gebeurt de hele dag: iemand navigeert weg of doet zijn scherm op
    // slot terwijl een foto aan het uploaden is.
    expect(vanOnsZelf('The operation was aborted')).toBe(false)
  })

  it('laat een fout door die toevallig een van die woorden bevat in ons eigen pad', () => {
    // "aborted" in een echte foutmelding van ons blijft staan zolang
    // het niet de standaardzin van de browser is.
    expect(vanOnsZelf('upload mislukt: verbinding viel weg')).toBe(true)
  })
})

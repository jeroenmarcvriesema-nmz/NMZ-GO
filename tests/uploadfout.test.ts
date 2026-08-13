import { describe, it, expect } from 'vitest'
import { duidUploadfout } from '../src/lib/uploadfout'
import { isVersiefout } from '../src/lib/versie'

// Deze twee bestanden bestaan om dezelfde reden: wat er misgaat op een
// telefoon in een kruipruimte is niet na te spelen achter een bureau.
// Elke test hieronder hoort bij een melding die daadwerkelijk is
// voorgekomen of bij een tak die anders nooit uitgeprobeerd wordt.

describe('duidUploadfout', () => {
  it('noemt geen bereik geen serverfout', () => {
    const f = duidUploadfout('Failed to fetch', false, true)
    expect(f.soort).toBe('offline')
    expect(f.opnieuw).toBe(true)
    expect(f.tekst).toContain('bereik')
  })

  it('herkent een weggevallen verbinding ook als de telefoon zegt online te zijn', () => {
    // navigator.onLine liegt: hij staat op waar zolang er wifi is,
    // ook als daar niets achter zit.
    const f = duidUploadfout('TypeError: NetworkError when attempting to fetch resource.', true, true)
    expect(f.soort).toBe('offline')
    expect(f.opnieuw).toBe(true)
  })

  it('herkent een verlopen sessie en zegt dat opnieuw proberen niet helpt', () => {
    const f = duidUploadfout('new row violates row-level security policy', true, true)
    expect(f.soort).toBe('sessie')
    expect(f.opnieuw).toBe(false)
    expect(f.tekst).toContain('uitgelogd')
  })

  it('noemt een ontbrekende sessie altijd sessie, wat de boodschap ook zegt', () => {
    const f = duidUploadfout('iets onbekends', true, false)
    expect(f.soort).toBe('sessie')
  })

  it('geen sessie maar ook geen verbinding: eerst het bereik', () => {
    // Een telefoon zonder bereik kan zijn sessie niet verversen. Zeggen
    // "je bent uitgelogd" stuurt iemand naar een inlogscherm dat het
    // net zo min doet.
    const f = duidUploadfout(null, false, false)
    expect(f.soort).toBe('offline')
  })

  it('valt terug op een serverfout als niets anders past', () => {
    const f = duidUploadfout('Bucket not found', true, true)
    expect(f.soort).toBe('server')
    expect(f.opnieuw).toBe(true)
    expect(f.tekst).toContain('kantoor')
  })
})

describe('isVersiefout', () => {
  it('herkent de twee meldingen die op 12 augustus in het logboek stonden', () => {
    expect(isVersiefout(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true)
    expect(isVersiefout(new Error(
      'Failed to fetch dynamically imported module: https://nmz-go.netlify.app/assets/Planning-Bc50nEjv.js',
    ))).toBe(true)
  })

  it('herkent de varianten van andere browsers', () => {
    expect(isVersiefout(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isVersiefout(new Error('Importing a module script failed.'))).toBe(true)
    expect(isVersiefout('ChunkLoadError: Loading chunk 12 failed.')).toBe(true)
  })

  it('houdt een echte fout een echte fout', () => {
    // Anders herlaadt de app zichzelf bij een programmeerfout, en dan
    // is er geen foutscherm meer waar iemand iets aan heeft.
    expect(isVersiefout(new Error("Cannot read properties of undefined (reading 'naam')"))).toBe(false)
    expect(isVersiefout(new Error('werkbon niet gevonden'))).toBe(false)
    expect(isVersiefout(null)).toBe(false)
    expect(isVersiefout(undefined)).toBe(false)
  })
})

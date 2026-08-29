import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ALLE_ROLLEN, WERKBEHEER, GEBRUIKERSBEHEER,
  magWerkBeheren, magGebruikersBeheren, isEigenaar, magBijPad, startPad, ROUTE_SLOT,
} from '@/lib/rollen'
import type { Rol } from '@/types'

// ============================================================
// Wat deze test bewaakt
// ============================================================
// Er stond een knop "Team" in de mobiele balk die aan uitvoerders en
// werkvoorbereiders werd getoond, terwijl die route alleen voor
// eigenaar en beheerder openstaat. Erop tikken gooide je terug naar het
// dashboard. Op de laptop was niets te zien, want de zijbalk deed het
// wél goed — dat is waarom het maanden onopgemerkt bleef.
//
// De oorzaak was dat de rollijsten op twee plekken stonden. Die staan nu
// op één plek, en de tests hieronder lezen de menubestanden uit en
// houden elk pad dat erin staat tegen het slot van de route. Een menu
// dat iemand wegstuurt kan daarmee niet meer ontstaan zonder dat de
// test rood wordt.
// ============================================================

// Zes rollen. Planner is Anthony's vak: hij zet de week in elkaar en
// heeft dezelfde bevoegdheden als een uitvoerder — alles rond het werk,
// niets rond accounts.
const KANTOOR: Rol[] = ['eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner']

function lees(bestand: string): string {
  return readFileSync(resolve(__dirname, '..', bestand), 'utf8')
}

/** Alle `to="/pad"` uit een navigatiebestand. */
function padenUit(bron: string): string[] {
  return [...bron.matchAll(/to="(\/[^"]*)"/g)].map((m) => m[1])
}

/**
 * Alles waar de mobiele navigatie heen kan: de tabs onderin (`to="/pad"`)
 * plus de regels in het "Meer"-blad, die met `ga('/pad')` navigeren.
 */
function mobielePaden(bron: string): string[] {
  return [
    ...padenUit(bron),
    ...[...bron.matchAll(/ga\('(\/[^']*)'\)/g)].map((m) => m[1]),
  ]
}

describe('bevoegdheden', () => {
  it('geeft kantoor werkbeheer en de zwamsaneerder niet', () => {
    for (const rol of KANTOOR) expect(magWerkBeheren(rol)).toBe(true)
    expect(magWerkBeheren('medewerker')).toBe(false)
  })

  it('geeft alleen eigenaar en beheerder het gebruikersbeheer', () => {
    expect(magGebruikersBeheren('eigenaar')).toBe(true)
    expect(magGebruikersBeheren('beheerder')).toBe(true)
    expect(magGebruikersBeheren('uitvoerder')).toBe(false)
    expect(magGebruikersBeheren('werkvoorbereider')).toBe(false)
    expect(magGebruikersBeheren('planner')).toBe(false)
    expect(magGebruikersBeheren('medewerker')).toBe(false)
  })

  it('laat niemand door zonder rol', () => {
    expect(magWerkBeheren(null)).toBe(false)
    expect(magWerkBeheren(undefined)).toBe(false)
    expect(magGebruikersBeheren(null)).toBe(false)
  })

  it('houdt gebruikersbeheer strenger dan werkbeheer', () => {
    // Wie gebruikers mag beheren mag ook het werk beheren. Andersom niet.
    for (const rol of GEBRUIKERSBEHEER) expect(WERKBEHEER).toContain(rol)
    expect(GEBRUIKERSBEHEER.length).toBeLessThan(WERKBEHEER.length)
  })

  it('laat de storingen alleen aan de eigenaar zien', () => {
    // De crashes van de app zelf. Stonden op het dashboard en waren
    // daarmee zichtbaar voor alle vijf de kantoorrollen; er staat in
    // wat er misging op het toestel van een collega.
    expect(isEigenaar('eigenaar')).toBe(true)
    expect(magBijPad('eigenaar', '/storingen')).toBe(true)

    for (const rol of ALLE_ROLLEN.filter((r) => r !== 'eigenaar')) {
      expect(isEigenaar(rol), `${rol} is geen eigenaar`).toBe(false)
      expect(magBijPad(rol, '/storingen'), `${rol} mag niet bij de storingen`).toBe(false)
    }
    expect(isEigenaar(null)).toBe(false)
  })

  it('houdt het eigenaarslot strenger dan gebruikersbeheer', () => {
    // Wie de storingen mag zien mag ook alles daaronder. Andersom niet:
    // een beheerder beheert gebruikers maar leest geen stacktraces.
    expect(magGebruikersBeheren('eigenaar')).toBe(true)
    expect(magBijPad('beheerder', '/medewerkers')).toBe(true)
    expect(magBijPad('beheerder', '/storingen')).toBe(false)
  })

  it('brengt iedereen op een startpagina die hij mag zien', () => {
    for (const rol of ALLE_ROLLEN) {
      expect(magBijPad(rol, startPad(rol))).toBe(true)
    }
  })
})

describe('de zijbalk stuurt niemand weg', () => {
  const bron = lees('src/components/layout/Sidebar.tsx')
  const paden = padenUit(bron)

  it('verwijst alleen naar routes die bestaan', () => {
    expect(paden.length).toBeGreaterThan(0)
    for (const pad of paden) {
      expect(ROUTE_SLOT, `zijbalk verwijst naar onbekend pad ${pad}`).toHaveProperty(pad)
    }
  })

  it('zet de storingen achter isEigenaar', () => {
    // Het slot dat telt zit in de database (migratie 030), maar een
    // menuknop die de helft van kantoor naar een leeg scherm stuurt is
    // precies de fout waarvoor dit testbestand bestaat.
    const eigenaarPaden = Object.entries(ROUTE_SLOT)
      .filter(([, slot]) => slot === 'eigenaar')
      .map(([pad]) => pad)

    expect(eigenaarPaden.length).toBeGreaterThan(0)
    for (const pad of eigenaarPaden) {
      if (!paden.includes(pad)) continue
      const regel = bron.split('\n').find((r) => r.includes(`to="${pad}"`)) ?? ''
      const blok = bron.slice(0, bron.indexOf(regel))
      expect(
        blok.includes('isEigenaar'),
        `${pad} staat in de zijbalk zonder isEigenaar ervoor`,
      ).toBe(true)
    }
  })

  it('toont het medewerkersbeheer achter de juiste voorwaarde', () => {
    // Alles achter `magGebruikersBeheren &&` mag strenger zijn dan de
    // rest van het kantoorblok; het omgekeerde is de fout die we hadden.
    const strengePaden = Object.entries(ROUTE_SLOT)
      .filter(([, slot]) => slot === 'gebruikersbeheer')
      .map(([pad]) => pad)

    for (const pad of strengePaden) {
      if (!paden.includes(pad)) continue
      const regel = bron.split('\n').find((r) => r.includes(`to="${pad}"`)) ?? ''
      const blok = bron.slice(0, bron.indexOf(regel))
      expect(
        blok.includes('magGebruikersBeheren'),
        `${pad} staat in de zijbalk zonder magGebruikersBeheren ervoor`,
      ).toBe(true)
    }
  })
})

describe('de mobiele balk stuurt niemand weg', () => {
  const bron = lees('src/components/layout/MobileNav.tsx')
  const paden = padenUit(bron)

  it('zet de storingen achter isEigenaar', () => {
    // De mobiele balk navigeert met ga('/pad') en niet met to="/pad",
    // dus die vangt `padenUit` niet. Wel apart nakijken: hier zat de
    // oorspronkelijke fout.
    const regel = bron.split('\n').find((r) => r.includes("ga('/storingen')")) ?? ''
    if (regel) {
      const blok = bron.slice(0, bron.indexOf(regel))
      expect(blok.includes('isEigenaar'), '/storingen staat in de mobiele balk zonder isEigenaar').toBe(true)
    }
  })

  it('verwijst alleen naar routes die bestaan', () => {
    expect(paden.length).toBeGreaterThan(0)
    for (const pad of paden) {
      expect(ROUTE_SLOT, `mobiele balk verwijst naar onbekend pad ${pad}`).toHaveProperty(pad)
    }
  })

  /**
   * De omgekeerde vraag, en de reden dat deze erbij komt.
   *
   * De tests hierboven controleren of elk pad in een menu naar een
   * bestaande route wijst. Ze stellen niet de andere vraag: is elke
   * route eigenlijk érgens aan te tikken? `/lopend` was dat niet — hij
   * stond alleen in de zijbalk, en die is `hidden md:block`. Op een
   * telefoon kon je er dus niet komen, terwijl "wie staat er nu op welke
   * klus" juist het scherm is dat een uitvoerder onderweg wil.
   *
   * Een route zonder ingang is geen fout die je opmerkt: er gebeurt
   * niets, er gaat niets stuk, hij is er gewoon niet. Precies het soort
   * ding dat een test moet vangen.
   */
  const ZONDER_EIGEN_KNOP: string[] = [
    // Zit als knop in de balk bovenin op /werkbonnen en op het
    // dashboard, en hoort geen eigen regel in het "Meer"-blad te
    // krijgen — dat is een lijst om iets op te zoeken, niet om iets aan
    // te maken.
    '/werkbonnen/nieuw',
  ]

  it('elke kantoorroute is op een telefoon te bereiken', () => {
    const bereikbaar = mobielePaden(bron)
    for (const [pad, slot] of Object.entries(ROUTE_SLOT)) {
      if (slot !== 'kantoor' || pad.includes(':')) continue
      if (ZONDER_EIGEN_KNOP.includes(pad)) continue
      expect(
        bereikbaar,
        `${pad} staat in geen enkele mobiele navigatie — op een telefoon is dat scherm niet te bereiken`,
      ).toContain(pad)
    }
  })

  it('zet geen gebruikersbeheer-route in het kantoorblok zonder extra slot', () => {
    // Dit is precies de fout die er zat: "Team" stond in het blok dat
    // aan élke kantoorrol wordt getoond.
    for (const [pad, slot] of Object.entries(ROUTE_SLOT)) {
      if (slot !== 'gebruikersbeheer' || !paden.includes(pad)) continue
      const regel = bron.split('\n').find((r) => r.includes(`to="${pad}"`)) ?? ''
      const blok = bron.slice(0, bron.indexOf(regel))
      expect(
        blok.includes('magGebruikersBeheren'),
        `${pad} staat in de mobiele balk zonder magGebruikersBeheren ervoor`,
      ).toBe(true)
    }
  })

  it('geeft kantoor op een telefoon toegang tot de werkbonnen', () => {
    // Werkbonnen stond hier niet in. Kantoor kon op een telefoon dus
    // niet bij de weekkiezer, de syncknop en het importeren van een
    // losse taak — precies de dingen die je onderweg nodig hebt.
    expect(paden).toContain('/werkbonnen')
  })

  it('geeft de zwamsaneerder zijn drie schermen', () => {
    expect(paden).toContain('/mijn-werkbonnen')
    expect(paden).toContain('/mijn-week')
    expect(paden).toContain('/mijn-bonnen')
  })
})

describe('elke route in App.tsx heeft een slot dat we kennen', () => {
  const bron = lees('src/App.tsx')

  it('kent geen route zonder guard behalve de openbare', () => {
    const openbaar = ['/login', '/registreer', '/wachtwoord-vergeten', '/wachtwoord-herstellen', '/', '*']
    const routes = [...bron.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1])

    for (const pad of routes) {
      if (openbaar.includes(pad)) continue
      // Routes met een parameter (/werkbonnen/:id) vallen onder het pad
      // erboven; die staan bewust niet los in de tabel.
      if (pad.includes(':')) continue
      expect(ROUTE_SLOT, `route ${pad} staat niet in ROUTE_SLOT`).toHaveProperty(pad)
    }
  })

  it('zet elk kantoorpad achter de KantoorGuard', () => {
    for (const [pad, slot] of Object.entries(ROUTE_SLOT)) {
      const regel = bron.split('\n').find((r) => r.includes(`path="${pad}"`))
      if (!regel) continue
      if (slot === 'kantoor') expect(regel).toContain('KantoorGuard')
      if (slot === 'gebruikersbeheer') expect(regel).toContain('GebruikersbeheerGuard')
      if (slot === 'ingelogd') expect(regel).toContain('AuthGuard')
    }
  })
})

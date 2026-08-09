import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ALLE_ROLLEN, WERKBEHEER, GEBRUIKERSBEHEER,
  magWerkBeheren, magGebruikersBeheren, magBijPad, startPad, ROUTE_SLOT,
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

const KANTOOR: Rol[] = ['eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider']

function lees(bestand: string): string {
  return readFileSync(resolve(__dirname, '..', bestand), 'utf8')
}

/** Alle `to="/pad"` uit een navigatiebestand. */
function padenUit(bron: string): string[] {
  return [...bron.matchAll(/to="(\/[^"]*)"/g)].map((m) => m[1])
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

  it('verwijst alleen naar routes die bestaan', () => {
    expect(paden.length).toBeGreaterThan(0)
    for (const pad of paden) {
      expect(ROUTE_SLOT, `mobiele balk verwijst naar onbekend pad ${pad}`).toHaveProperty(pad)
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

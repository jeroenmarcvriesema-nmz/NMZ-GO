import { describe, it, expect } from 'vitest'
import { klusstand, standkleur, STANDEN } from '../src/lib/klusstand'

// De fout waar deze tests bij horen: alle dertig werkbonnen stonden op
// `status = 'open'`, ook Gaaspstraat 46 met zeven afgevinkte punten en
// elf foto's. Niets zet die kolom ooit op 'bezig' — de ClickUp-sync
// raakt hem niet aan en de handmatige knop op de werkbon gebruikt
// niemand. Elk scherm noemde dat werk dus "nog niet gestart", en de
// kleur blauw kwam nergens voor.

const punten = (klaar: number, totaal: number) =>
  Array.from({ length: totaal }, (_, i) => ({ voltooid: i < klaar }))

describe('klusstand', () => {
  it('noemt een bon met afgevinkte punten bezig, ook als de kolom "open" zegt', () => {
    expect(klusstand({ status: 'open', taken: punten(7, 23) })).toBe('bezig')
  })

  it('gelooft de kolom wél als die "bezig" zegt', () => {
    expect(klusstand({ status: 'bezig', taken: punten(0, 12) })).toBe('bezig')
  })

  it('noemt een bon zonder afgevinkt punt niet gestart', () => {
    expect(klusstand({ status: 'open', taken: punten(0, 16) })).toBe('niet_gestart')
  })

  it('een bon zonder punten is niet gestart, niet bezig', () => {
    // Een verse bon uit ClickUp waarvan de werkopdracht nog niet is
    // ontleed. Nul van nul is geen voortgang.
    expect(klusstand({ status: 'open', taken: [] })).toBe('niet_gestart')
    expect(klusstand({ status: 'open' })).toBe('niet_gestart')
  })

  it('stilgelegd wint van alles', () => {
    // Ook van opgeleverd: ligt er iets stil, dan is dát wat je moet
    // weten, want dat is het enige dat een telefoontje vraagt.
    expect(klusstand({ status: 'voltooid', stilgelegd_op: '2026-08-01', taken: punten(12, 12) })).toBe('stilgelegd')
    expect(klusstand({ stilgelegd_op: '2026-08-01', opgeleverd_op: '2026-08-02' })).toBe('stilgelegd')
  })

  it('opgeleverd wint van afgerond', () => {
    expect(klusstand({ status: 'voltooid', opgeleverd_op: '2026-08-04' })).toBe('opgeleverd')
    expect(klusstand({ status: 'voltooid' })).toBe('afgerond')
  })

  it('rekent met puntenKlaar als een scherm al geteld heeft', () => {
    // De weekplanning krijgt aantallen binnen, geen punten. Dan telt
    // dat getal, en niet een lege takenlijst die er niet is.
    expect(klusstand({ status: 'open', puntenKlaar: 3 })).toBe('bezig')
    expect(klusstand({ status: 'open', puntenKlaar: 0 })).toBe('niet_gestart')
  })

  it('laat puntenKlaar voorgaan op de takenlijst', () => {
    expect(klusstand({ status: 'open', puntenKlaar: 0, taken: punten(4, 9) })).toBe('niet_gestart')
  })
})

describe('standkleur', () => {
  it('geeft blauw voor bezig en groen voor klaar', () => {
    expect(standkleur({ status: 'open', puntenKlaar: 1 }).badge).toBe('blue')
    expect(standkleur({ status: 'voltooid' }).badge).toBe('green')
    expect(standkleur({ opgeleverd_op: '2026-08-04' }).badge).toBe('green')
    expect(standkleur({ stilgelegd_op: '2026-08-01' }).badge).toBe('red')
    expect(standkleur({ status: 'open' }).badge).toBe('gray')
  })

  it('geeft elke stand een woord — kleur is nooit het enige signaal', () => {
    for (const stand of Object.values(STANDEN)) {
      expect(stand.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('gebruikt nergens geel: dat is van het merk, niet van een status', () => {
    for (const stand of Object.values(STANDEN)) {
      const alles = [stand.rand, stand.bol, stand.vlak, stand.omlijsting, stand.balkbed, stand.tekst].join(' ')
      expect(alles).not.toMatch(/yellow|amber/)
    }
  })
})

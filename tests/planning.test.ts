import { describe, it, expect } from 'vitest'
import {
  isoDatum, maandagVan, weekDagen, kiesVandaag, looptOp, dagenUitloop,
  weeknummer, weekLabel, maandagVerschoven, inWeek,
} from '@/lib/planning'

// Een minimale bon: precies de velden waar het rekenwerk naar kijkt.
const bon = (o: Partial<Parameters<typeof kiesVandaag>[0][number]> & { id: string }) => ({
  datum: '2026-08-10',
  geplande_start: null,
  geplande_eind: null,
  status: 'open',
  opgeleverd_op: null,
  ...o,
})

describe('isoDatum', () => {
  it('rekent in de tijdzone van de gebruiker, niet in UTC', () => {
    // 10 augustus, half één 's nachts Nederlandse tijd. toISOString()
    // maakt daar 9 augustus van, want dat is 22:30 UTC. Iemand die om
    // half één zijn app opent hoort de klus van vandaag te zien.
    const nacht = new Date(2026, 7, 10, 0, 30)
    expect(isoDatum(nacht)).toBe('2026-08-10')
  })

  it('zet maand en dag met een voorloopnul', () => {
    expect(isoDatum(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('maandagVan en weekDagen', () => {
  it('geeft de maandag van dezelfde week', () => {
    // 12 augustus 2026 is een woensdag.
    expect(isoDatum(maandagVan(new Date(2026, 7, 12)))).toBe('2026-08-10')
  })

  it('rekent zondag bij de week ervóór', () => {
    // Zondag 16 augustus hoort bij de week die op 10 augustus begon —
    // niet bij de week die de dag erna start.
    expect(isoDatum(maandagVan(new Date(2026, 7, 16)))).toBe('2026-08-10')
  })

  it('een maandag blijft zichzelf', () => {
    expect(isoDatum(maandagVan(new Date(2026, 7, 10)))).toBe('2026-08-10')
  })

  it('geeft vijf werkdagen vanaf maandag', () => {
    const dagen = weekDagen(maandagVan(new Date(2026, 7, 12))).map((d) => isoDatum(d))
    expect(dagen).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
    ])
  })

  it('werkt over een maandgrens heen', () => {
    const dagen = weekDagen(maandagVan(new Date(2026, 7, 31))).map((d) => isoDatum(d))
    expect(dagen[0]).toBe('2026-08-31')
    expect(dagen[4]).toBe('2026-09-04')
  })
})

describe('looptOp', () => {
  it('telt een meerdaagse klus op elke dag mee', () => {
    const b = bon({ id: 'a', geplande_start: '2026-08-10', geplande_eind: '2026-08-13' })
    expect(looptOp(b, '2026-08-10')).toBe(true)
    expect(looptOp(b, '2026-08-12')).toBe(true)
    expect(looptOp(b, '2026-08-13')).toBe(true)
    expect(looptOp(b, '2026-08-14')).toBe(false)
  })

  it('valt terug op datum als er geen planning staat', () => {
    const b = bon({ id: 'a', datum: '2026-08-11' })
    expect(looptOp(b, '2026-08-11')).toBe(true)
    expect(looptOp(b, '2026-08-12')).toBe(false)
  })
})

describe('kiesVandaag', () => {
  it('geeft niets terug als er niets openstaat', () => {
    expect(kiesVandaag([], '2026-08-12')).toBeNull()
    expect(kiesVandaag([bon({ id: 'a', status: 'voltooid' })], '2026-08-12')).toBeNull()
    expect(kiesVandaag([bon({ id: 'a', opgeleverd_op: '2026-08-11' })], '2026-08-12')).toBeNull()
  })

  it('kiest de klus die vandaag loopt, niet die het verst weg ligt', () => {
    // Dit is de fout die echt is voorgekomen. De lijst kwam
    // datum-aflopend binnen, en "de eerste open bon" was daarmee de
    // klus die het verst in de toekomst lag. Iemand kreeg 's ochtends
    // het adres van volgende week te zien.
    const lijst = [
      bon({ id: 'ver',    geplande_start: '2026-08-24', geplande_eind: '2026-08-28' }),
      bon({ id: 'later',  geplande_start: '2026-08-17', geplande_eind: '2026-08-21' }),
      bon({ id: 'vandaag', geplande_start: '2026-08-10', geplande_eind: '2026-08-14' }),
    ]
    expect(kiesVandaag(lijst, '2026-08-12')?.id).toBe('vandaag')
  })

  it('pakt bij twee klussen op één dag de vroegst begonnen', () => {
    // Dit gebeurt echt: ma/di/wo op de ene klus, donderdag verder op de
    // andere. Beide lopen dan op donderdag.
    const lijst = [
      bon({ id: 'nieuw', geplande_start: '2026-08-13', geplande_eind: '2026-08-14' }),
      bon({ id: 'lopend', geplande_start: '2026-08-10', geplande_eind: '2026-08-13' }),
    ]
    expect(kiesVandaag(lijst, '2026-08-13')?.id).toBe('lopend')
  })

  it('kijkt vooruit als er vandaag niets loopt', () => {
    const lijst = [
      bon({ id: 'ver',      geplande_start: '2026-08-24' }),
      bon({ id: 'volgende', geplande_start: '2026-08-17' }),
    ]
    expect(kiesVandaag(lijst, '2026-08-12')?.id).toBe('volgende')
  })

  it('zet uitgelopen werk bovenaan als er niets anders staat', () => {
    // Alles ligt in het verleden en is niet af. Dan is het werk
    // uitgelopen en hoort de laatste bon juist in beeld te komen, niet
    // te verdwijnen.
    const lijst = [
      bon({ id: 'oud',    geplande_start: '2026-07-01', geplande_eind: '2026-07-03' }),
      bon({ id: 'recent', geplande_start: '2026-08-03', geplande_eind: '2026-08-07' }),
    ]
    expect(kiesVandaag(lijst, '2026-08-12')?.id).toBe('recent')
  })
})

describe('dagenUitloop', () => {
  it('is nul zolang de klus binnen zijn planning valt', () => {
    const b = bon({ id: 'a', geplande_start: '2026-08-10', geplande_eind: '2026-08-14' })
    expect(dagenUitloop(b, '2026-08-12')).toBe(0)
    expect(dagenUitloop(b, '2026-08-14')).toBe(0)
  })

  it('telt de dagen die over de planning heen lopen', () => {
    const b = bon({ id: 'a', geplande_start: '2026-08-10', geplande_eind: '2026-08-14' })
    expect(dagenUitloop(b, '2026-08-17')).toBe(3)
  })

  it('rekent een afgeronde klus nooit als uitloop', () => {
    const af = bon({ id: 'a', geplande_eind: '2026-07-01', status: 'voltooid' })
    const op = bon({ id: 'b', geplande_eind: '2026-07-01', opgeleverd_op: '2026-07-05' })
    expect(dagenUitloop(af, '2026-08-12')).toBe(0)
    expect(dagenUitloop(op, '2026-08-12')).toBe(0)
  })
})

describe('weeknummer', () => {
  // Het weeknummer is waar in Nederland mee gepland wordt en waar de
  // planning in ClickUp op staat. Zit hij er één naast, dan rijdt er
  // iemand een week te vroeg of te laat.
  it('rekent een gewone week goed', () => {
    // Maandag 10 augustus 2026 valt in week 33.
    expect(weeknummer(new Date(2026, 7, 10))).toBe(33)
    expect(weeknummer(new Date(2026, 7, 16))).toBe(33) // zondag hoort er nog bij
    expect(weeknummer(new Date(2026, 7, 17))).toBe(34)
  })

  it('geeft elke dag van dezelfde week hetzelfde nummer', () => {
    const nummers = weekDagen(maandagVan(new Date(2026, 7, 12)))
      .map((d) => weeknummer(d))
    expect(new Set(nummers).size).toBe(1)
  })

  it('rekent de jaarwisseling volgens ISO 8601', () => {
    // 1 januari 2027 is een vrijdag en hoort nog bij week 53 van 2026.
    expect(weeknummer(new Date(2027, 0, 1))).toBe(53)
    // 4 januari 2027 is de maandag van week 1.
    expect(weeknummer(new Date(2027, 0, 4))).toBe(1)
    // 1 januari 2026 is een donderdag: dat is week 1.
    expect(weeknummer(new Date(2026, 0, 1))).toBe(1)
  })

  it('rekent een jaar met 53 weken goed uit', () => {
    // 2020 had er 53; 28 december 2020 is de maandag van week 53.
    expect(weeknummer(new Date(2020, 11, 28))).toBe(53)
    expect(weeknummer(new Date(2021, 0, 4))).toBe(1)
  })
})

describe('weekLabel', () => {
  it('gebruikt de woorden die iedereen gebruikt', () => {
    expect(weekLabel(0)).toBe('Deze week')
    expect(weekLabel(1)).toBe('Volgende week')
    expect(weekLabel(-1)).toBe('Vorige week')
  })

  it('valt terug op tellen zodra dat niets meer zegt', () => {
    expect(weekLabel(3)).toBe('Over 3 weken')
    expect(weekLabel(-2)).toBe('2 weken terug')
  })
})

describe('maandagVerschoven', () => {
  it('telt hele weken op vanaf de maandag van nu', () => {
    const donderdag = new Date(2026, 7, 13)
    expect(isoDatum(maandagVerschoven(0, donderdag))).toBe('2026-08-10')
    expect(isoDatum(maandagVerschoven(1, donderdag))).toBe('2026-08-17')
    expect(isoDatum(maandagVerschoven(-1, donderdag))).toBe('2026-08-03')
  })

  it('stapt over een maandgrens heen', () => {
    expect(isoDatum(maandagVerschoven(1, new Date(2026, 7, 26)))).toBe('2026-08-31')
  })
})

describe('inWeek', () => {
  const maandag = new Date(2026, 7, 10) // week 33

  it('neemt een klus mee die in de week begint', () => {
    expect(inWeek(bon({ id: 'a', geplande_start: '2026-08-12', geplande_eind: '2026-08-12' }), maandag)).toBe(true)
  })

  it('neemt een klus mee die uit de week ervóór doorloopt', () => {
    // Dit is het geval waar het om gaat: een klus van drie weken hoort
    // in alle drie die weken te staan, niet alleen in de week waarin
    // hij begon.
    expect(inWeek(bon({ id: 'a', geplande_start: '2026-08-03', geplande_eind: '2026-08-19' }), maandag)).toBe(true)
  })

  it('laat weg wat ervoor of erna ligt', () => {
    expect(inWeek(bon({ id: 'a', geplande_start: '2026-08-03', geplande_eind: '2026-08-07' }), maandag)).toBe(false)
    expect(inWeek(bon({ id: 'b', geplande_start: '2026-08-17', geplande_eind: '2026-08-21' }), maandag)).toBe(false)
  })

  it('telt het weekend niet als losse week', () => {
    // Zaterdag 15 augustus valt buiten de vijf werkdagen, maar een klus
    // die tot en met zaterdag loopt hoort wél bij week 33.
    expect(inWeek(bon({ id: 'a', geplande_start: '2026-08-14', geplande_eind: '2026-08-15' }), maandag)).toBe(true)
    // Een klus die pas op zondag begint hoort bij de week erna.
    expect(inWeek(bon({ id: 'b', geplande_start: '2026-08-16', geplande_eind: '2026-08-16' }), maandag)).toBe(false)
  })

  it('valt terug op datum als er geen planning staat', () => {
    expect(inWeek(bon({ id: 'a', datum: '2026-08-11' }), maandag)).toBe(true)
    expect(inWeek(bon({ id: 'b', datum: '2026-09-01' }), maandag)).toBe(false)
  })
})

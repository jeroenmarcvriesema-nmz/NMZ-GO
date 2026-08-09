import { describe, it, expect } from 'vitest'
import {
  isoDatum, maandagVan, weekDagen, kiesVandaag, looptOp, dagenUitloop,
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

import { describe, it, expect } from 'vitest'
import {
  isoDatum, maandagVan, weekDagen, kiesVandaag, looptVandaag, looptOp, dagenUitloop, uitgelopenWerk,
  dagInKlus, duurLabel,
  weeknummer, weekLabel, maandagVerschoven, inWeek,
  maandagVanWerkweek, groepeerPerWeek,
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

  it('geeft zes werkdagen vanaf maandag, zaterdag erbij', () => {
    // Zaterdag wordt gebruikt om dingen af te maken en voor
    // garantiewerk. Die dag hoort in de planning, niet in een
    // uitzondering.
    const dagen = weekDagen(maandagVan(new Date(2026, 7, 12))).map((d) => isoDatum(d))
    expect(dagen).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12',
      '2026-08-13', '2026-08-14', '2026-08-15',
    ])
  })

  it('laat zondag erbuiten', () => {
    const dagen = weekDagen(maandagVan(new Date(2026, 7, 12))).map((d) => isoDatum(d))
    expect(dagen).not.toContain('2026-08-16')
  })

  it('werkt over een maandgrens heen', () => {
    const dagen = weekDagen(maandagVan(new Date(2026, 7, 31))).map((d) => isoDatum(d))
    expect(dagen[0]).toBe('2026-08-31')
    expect(dagen[dagen.length - 1]).toBe('2026-09-05')
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

  // Dit is de klacht uit de uitvoering: iemand staat vijf dagen op een
  // klus en er komt één dag een klusje tussendoor. Op begindatum
  // sorteren gaf altijd de meerdaagse klus, en de tussendoorklus stond
  // nergens — terwijl dat de enige is die vandáág af moet.
  it('kiest de klus die vandaag af moet boven de klus die de hele week loopt', () => {
    const lijst = [
      bon({ id: 'weekklus',    geplande_start: '2026-08-24', geplande_eind: '2026-08-28' }),
      bon({ id: 'tussendoor', geplande_start: '2026-08-26', geplande_eind: '2026-08-26' }),
    ]
    expect(kiesVandaag(lijst, '2026-08-26')?.id).toBe('tussendoor')
  })

  // Waar je geklokt staat ben je, en dat weegt zwaarder dan wat de
  // planning zegt. Kantoor drukt om tien uur een spoedje ertussen; dan
  // hoort de kaart onder de man niet weg te springen terwijl zijn
  // werkdag op de andere klus loopt.
  it('houdt de klus waarop je geklokt staat bovenaan', () => {
    const lijst = [
      bon({ id: 'weekklus', geplande_start: '2026-09-01', geplande_eind: '2026-09-10' }),
      bon({ id: 'spoedje',  geplande_start: '2026-09-02', geplande_eind: '2026-09-02' }),
    ]
    // Zonder klok wint het spoedje: dat moet vandaag af.
    expect(kiesVandaag(lijst, '2026-09-02')?.id).toBe('spoedje')
    // Geklokt op de weekklus: dan blijft die de klus van vandaag.
    expect(kiesVandaag(lijst, '2026-09-02', 'weekklus')?.id).toBe('weekklus')
  })

  it('valt terug op de planning als de klok naar een afgeronde klus wijst', () => {
    const lijst = [
      bon({ id: 'af',      geplande_start: '2026-09-01', geplande_eind: '2026-09-02', status: 'voltooid' }),
      bon({ id: 'spoedje', geplande_start: '2026-09-02', geplande_eind: '2026-09-02' }),
    ]
    expect(kiesVandaag(lijst, '2026-09-02', 'af')?.id).toBe('spoedje')
  })

  it('valt terug op de planning bij een onbekende klok', () => {
    const lijst = [bon({ id: 'spoedje', geplande_start: '2026-09-02', geplande_eind: '2026-09-02' })]
    expect(kiesVandaag(lijst, '2026-09-02', 'bestaat-niet')?.id).toBe('spoedje')
    expect(kiesVandaag(lijst, '2026-09-02', null)?.id).toBe('spoedje')
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

  it('laat werk dat gisteren niet af kwam voorgaan op werk van volgende week', () => {
    // Dit leverde de meeste vragen op van de hele app. Een klus liep
    // uit, en 's ochtends stond er de volgende klus op het scherm van
    // de ploeg — of niets. Ze stonden nog op de steiger van gisteren.
    const lijst = [
      bon({ id: 'volgende-week', geplande_start: '2026-08-24', geplande_eind: '2026-08-28' }),
      bon({ id: 'niet-af',       geplande_start: '2026-08-10', geplande_eind: '2026-08-11' }),
    ]
    expect(kiesVandaag(lijst, '2026-08-12')?.id).toBe('niet-af')
  })

  it('laat een klus die vandaag loopt wel voorgaan op uitgelopen werk', () => {
    // Uitgelopen werk weegt zwaar, maar niet zwaarder dan de klus waar
    // hij vandaag daadwerkelijk staat ingepland.
    const lijst = [
      bon({ id: 'niet-af', geplande_start: '2026-08-10', geplande_eind: '2026-08-11' }),
      bon({ id: 'vandaag', geplande_start: '2026-08-12', geplande_eind: '2026-08-14' }),
    ]
    expect(kiesVandaag(lijst, '2026-08-12')?.id).toBe('vandaag')
  })
})

describe('dagInKlus en duurLabel', () => {
  // Het scenario uit de uitvoering: een klus van 1 t/m 10 september met
  // een spoedje van twee dagen ertussendoor. Op de tweede september
  // moet een zwamsaneerder in één oogopslag zien welke van de twee die
  // dag af moet.
  const lang = bon({ id: 'lang', geplande_start: '2026-09-01', geplande_eind: '2026-09-10' })
  const spoed = bon({ id: 'spoed', geplande_start: '2026-09-02', geplande_eind: '2026-09-03' })

  it('telt de dag binnen de klus', () => {
    expect(dagInKlus(lang, '2026-09-02')).toEqual({ dag: 2, totaal: 10 })
    expect(dagInKlus(spoed, '2026-09-02')).toEqual({ dag: 1, totaal: 2 })
  })

  it('zet de lange klus en het spoedje uit elkaar op dezelfde dag', () => {
    expect(duurLabel(lang, '2026-09-02')).toBe('dag 2 van 10')
    expect(duurLabel(spoed, '2026-09-02')).toBe('dag 1 van 2')
  })

  // Eendaags is het sterkste signaal: hier is één dag voor.
  it('noemt een klus van één dag "alleen vandaag"', () => {
    const kort = bon({ id: 'kort', geplande_start: '2026-09-02', geplande_eind: '2026-09-02' })
    expect(duurLabel(kort, '2026-09-02')).toBe('alleen vandaag')
  })

  it('noemt de laatste dag ook zo', () => {
    expect(duurLabel(spoed, '2026-09-03')).toBe('laatste dag van 2')
    expect(duurLabel(lang, '2026-09-10')).toBe('laatste dag van 10')
  })

  // Een klus die uitloopt heeft zijn eigen blok op het scherm; daar
  // hoort geen "dag 12 van 10" bij te staan.
  it('klemt buiten de periode in plaats van door te tellen', () => {
    expect(dagInKlus(lang, '2026-09-20')).toEqual({ dag: 10, totaal: 10 })
    expect(dagInKlus(lang, '2026-08-20')).toEqual({ dag: 1, totaal: 10 })
  })

  // Een bon zonder einddatum is een klus van één dag, niet een klus van
  // nul dagen die nergens op staat.
  it('valt terug op de startdatum als er geen einddatum is', () => {
    const los = bon({ id: 'los', geplande_start: '2026-09-02', geplande_eind: null })
    expect(duurLabel(los, '2026-09-02')).toBe('alleen vandaag')
  })
})

describe('looptVandaag', () => {
  // De ploeg moet alles zien wat vandaag voor ze staat, niet alleen de
  // klus die het scherm bovenaan zet. Eén klus onzichtbaar is één klus
  // die niet gedaan wordt.
  it('geeft alle klussen die vandaag lopen, wat vandaag af moet eerst', () => {
    const lijst = [
      bon({ id: 'weekklus',   geplande_start: '2026-08-24', geplande_eind: '2026-08-28' }),
      bon({ id: 'tussendoor', geplande_start: '2026-08-26', geplande_eind: '2026-08-26' }),
      bon({ id: 'morgen',     geplande_start: '2026-08-27', geplande_eind: '2026-08-27' }),
    ]
    expect(looptVandaag(lijst, '2026-08-26').map((w) => w.id)).toEqual([
      'tussendoor',
      'weekklus',
    ])
  })

  it('laat afgeronde en opgeleverde klussen weg', () => {
    const lijst = [
      bon({ id: 'af',  geplande_start: '2026-08-26', geplande_eind: '2026-08-26', status: 'voltooid' }),
      bon({ id: 'op',  geplande_start: '2026-08-26', geplande_eind: '2026-08-26', opgeleverd_op: '2026-08-26' }),
      bon({ id: 'nog', geplande_start: '2026-08-26', geplande_eind: '2026-08-26' }),
    ]
    expect(looptVandaag(lijst, '2026-08-26').map((w) => w.id)).toEqual(['nog'])
  })

  // Bij een gelijke einddatum wint de klus die het langst loopt: daar
  // staat de ploeg al, en die hoort niet ineens tweede te worden.
  it('zet bij dezelfde einddatum de langstlopende vooraan', () => {
    const lijst = [
      bon({ id: 'kort', geplande_start: '2026-08-26', geplande_eind: '2026-08-26' }),
      bon({ id: 'lang', geplande_start: '2026-08-20', geplande_eind: '2026-08-26' }),
    ]
    expect(looptVandaag(lijst, '2026-08-26').map((w) => w.id)).toEqual(['lang', 'kort'])
  })

  it('geeft niets terug als er vandaag niets loopt', () => {
    const lijst = [bon({ id: 'later', geplande_start: '2026-09-01', geplande_eind: '2026-09-03' })]
    expect(looptVandaag(lijst, '2026-08-26')).toEqual([])
  })
})

describe('uitgelopenWerk', () => {
  it('geeft alles wat niet af is en over zijn datum heen', () => {
    const lijst = [
      bon({ id: 'vandaag', geplande_start: '2026-08-12', geplande_eind: '2026-08-14' }),
      bon({ id: 'oud',     geplande_start: '2026-07-01', geplande_eind: '2026-07-03' }),
      bon({ id: 'gisteren', geplande_start: '2026-08-10', geplande_eind: '2026-08-11' }),
    ]
    // Nieuwste eind eerst: wat gisteren afliep vóór wat in juli afliep.
    expect(uitgelopenWerk(lijst, '2026-08-12').map((b) => b.id)).toEqual(['gisteren', 'oud'])
  })

  it('telt afgerond en opgeleverd werk niet mee', () => {
    const lijst = [
      bon({ id: 'af',         geplande_eind: '2026-08-01', status: 'voltooid' }),
      bon({ id: 'opgeleverd', geplande_eind: '2026-08-01', opgeleverd_op: '2026-08-02' }),
      bon({ id: 'open',       geplande_eind: '2026-08-01' }),
    ]
    expect(uitgelopenWerk(lijst, '2026-08-12').map((b) => b.id)).toEqual(['open'])
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
  // Altijd met een vaste dag: het label hangt af van of het weekend is,
  // en een test die op zaterdag omvalt is geen test maar een verrassing.
  const woensdag = new Date(2026, 7, 12)

  it('gebruikt de woorden die iedereen gebruikt', () => {
    expect(weekLabel(0, woensdag)).toBe('Deze week')
    expect(weekLabel(1, woensdag)).toBe('Volgende week')
    expect(weekLabel(-1, woensdag)).toBe('Vorige week')
  })

  it('valt terug op tellen zodra dat niets meer zegt', () => {
    expect(weekLabel(3, woensdag)).toBe('Over 3 weken')
    expect(weekLabel(-2, woensdag)).toBe('2 weken terug')
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

  it('rekent zaterdag mee en zondag niet', () => {
    // Zaterdag 15 augustus is een werkdag en hoort bij week 33.
    expect(inWeek(bon({ id: 'a', geplande_start: '2026-08-15', geplande_eind: '2026-08-15' }), maandag)).toBe(true)
    // Een klus die pas op zondag begint hoort bij de week erna.
    expect(inWeek(bon({ id: 'b', geplande_start: '2026-08-16', geplande_eind: '2026-08-16' }), maandag)).toBe(false)
  })

  it('valt terug op datum als er geen planning staat', () => {
    expect(inWeek(bon({ id: 'a', datum: '2026-08-11' }), maandag)).toBe(true)
    expect(inWeek(bon({ id: 'b', datum: '2026-09-01' }), maandag)).toBe(false)
  })
})

describe('maandagVanWerkweek', () => {
  // Dit was een echte fout. Op zondag 9 augustus opende de planning op
  // de week van 3 t/m 7 augustus — de week die vrijdag was geëindigd —
  // terwijl al het werk in de week erna stond. Het leek daardoor alsof
  // er niets was ingepland.
  it('rolt op zondag door naar de week die eraan komt', () => {
    const zondag = new Date(2026, 7, 9)
    expect(isoDatum(maandagVanWerkweek(zondag))).toBe('2026-08-10')
  })

  it('laat zaterdag met rust, want dat is een werkdag', () => {
    // Wie op zaterdag kijkt wil zíjn dag zien, niet die van overmorgen.
    const zaterdag = new Date(2026, 7, 15)
    expect(isoDatum(maandagVanWerkweek(zaterdag))).toBe('2026-08-10')
  })

  it('laat een doordeweekse dag met rust', () => {
    for (const dag of [10, 11, 12, 13, 14, 15]) {
      expect(isoDatum(maandagVanWerkweek(new Date(2026, 7, dag)))).toBe('2026-08-10')
    }
  })

  it('wijkt bewust af van de ISO-regel die maandagVan volgt', () => {
    // maandagVan blijft zuiver ISO — die wordt voor het weeknummer
    // gebruikt en daar hoort zondag wél bij de week ervoor.
    const zondag = new Date(2026, 7, 9)
    expect(isoDatum(maandagVan(zondag))).toBe('2026-08-03')
    expect(isoDatum(maandagVanWerkweek(zondag))).toBe('2026-08-10')
  })
})

describe('maandagVerschoven in het weekend', () => {
  it('rekent vanaf de komende week, niet vanaf de afgelopen', () => {
    const zondag = new Date(2026, 7, 9)
    expect(isoDatum(maandagVerschoven(0, zondag))).toBe('2026-08-10')
    expect(isoDatum(maandagVerschoven(1, zondag))).toBe('2026-08-17')
    expect(isoDatum(maandagVerschoven(-1, zondag))).toBe('2026-08-03')
  })
})

describe('weekLabel in het weekend', () => {
  it('noemt de komende week niet "deze week"', () => {
    // Op zondag sta je nog niet in die week; hem "deze week" noemen
    // leest als de week die net voorbij is.
    const zondag = new Date(2026, 7, 9)
    expect(weekLabel(0, zondag)).toBe('Komende week')
    expect(weekLabel(1, zondag)).toBe('De week daarna')
    expect(weekLabel(-1, zondag)).toBe('Afgelopen week')
  })

  it('gebruikt doordeweeks de gewone woorden', () => {
    const woensdag = new Date(2026, 7, 12)
    expect(weekLabel(0, woensdag)).toBe('Deze week')
    expect(weekLabel(1, woensdag)).toBe('Volgende week')
  })
})

describe('groepeerPerWeek', () => {
  const ids = (blok: { items: { bon: { id: string } }[] }) => blok.items.map((i) => i.bon.id)

  it('zet een klus in de week waarin hij valt', () => {
    const blokken = groepeerPerWeek([
      bon({ id: 'a', geplande_start: '2026-08-11', geplande_eind: '2026-08-13' }),
      bon({ id: 'b', geplande_start: '2026-08-04', geplande_eind: '2026-08-06' }),
      bon({ id: 'c', geplande_start: '2026-08-12', geplande_eind: '2026-08-12' }),
    ])

    expect(blokken).toHaveLength(2)
    // Nieuwste week bovenaan: de vraag gaat over wat eraan komt.
    expect(blokken[0].nummer).toBe(33)
    expect(ids(blokken[0])).toEqual(['a', 'c'])
    expect(blokken[1].nummer).toBe(32)
    expect(ids(blokken[1])).toEqual(['b'])
  })

  it('zet een klus van meerdere weken in élke week waarin hij loopt', () => {
    // Dit is het Bentinckstraat-geval: 24 juli tot 14 augustus. Alleen
    // onder de beginweek zetten betekent dat je hem in week 33 niet
    // ziet en denkt dat de ploeg vrij is.
    const blokken = groepeerPerWeek([
      bon({ id: 'lang', geplande_start: '2026-07-27', geplande_eind: '2026-08-14' }),
    ])

    expect(blokken.map((b) => b.nummer)).toEqual([33, 32, 31])
    for (const blok of blokken) expect(ids(blok)).toEqual(['lang'])
  })

  it('markeert waar een doorlopende klus begint en eindigt', () => {
    const blokken = groepeerPerWeek([
      bon({ id: 'lang', geplande_start: '2026-08-03', geplande_eind: '2026-08-19' }),
    ])

    // Oudste week onderaan; daar begint hij.
    const eerste = blokken[blokken.length - 1]
    const laatste = blokken[0]

    expect(eerste.items[0].begintHier).toBe(true)
    expect(eerste.items[0].eindigtHier).toBe(false)
    expect(laatste.items[0].begintHier).toBe(false)
    expect(laatste.items[0].eindigtHier).toBe(true)
    // De week ertussen is puur doorloop.
    expect(blokken[1].items[0].begintHier).toBe(false)
    expect(blokken[1].items[0].eindigtHier).toBe(false)
  })

  it('sorteert binnen een week op startdatum', () => {
    const blokken = groepeerPerWeek([
      bon({ id: 'laat',  geplande_start: '2026-08-13' }),
      bon({ id: 'vroeg', geplande_start: '2026-08-10' }),
    ])
    expect(ids(blokken[0])).toEqual(['vroeg', 'laat'])
  })

  it('loopt niet oneindig door op onzinnige data', () => {
    // Een einddatum jaren na de start is een fout in de bron, geen klus.
    const blokken = groepeerPerWeek([
      bon({ id: 'kapot', geplande_start: '2026-01-01', geplande_eind: '2030-01-01' }),
    ])
    expect(blokken.length).toBeLessThanOrEqual(26)
  })

  it('geeft een lege lijst terug bij niets', () => {
    expect(groepeerPerWeek([])).toEqual([])
  })
})

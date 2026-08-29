import { describe, it, expect } from 'vitest'
import {
  standUitStatus, statusUitReden,
  type Standregels, type Statussen,
} from '../supabase/functions/verwerker/statusregels'

// Dezelfde namen als in clickup_instellingen staan.
const S: Statussen = {
  status_opgeleverd: 'opgeleverd',
  status_wacht_op_fotos: "wacht op foto's",
  status_stilgelegd: 'on hold',
  status_asbest: 'onhold door asbest',
  status_spuiten_isoleren: 'nog spuiten/isoleren',
  status_opnieuw_inplannen: 'opnieuw inplannen/later',
}

// Er is bewust géén keuzelijst bij het stilleggen: wie een klus
// stillegt heeft haast en typt wat er is. Deze regel vertaalt die zin
// naar de juiste kolom in ClickUp. Gaat dat mis, dan staat een
// asbestmelding als gewone "on hold" op het planbord en pakt iemand hem
// verkeerd op.

describe('statusUitReden', () => {
  it('herkent asbest', () => {
    expect(statusUitReden('asbest aangetroffen in de kruipruimte', S)).toBe('onhold door asbest')
    expect(statusUitReden('ASBESTVERDENKING', S)).toBe('onhold door asbest')
  })

  it('herkent opnieuw inplannen, in beide schrijfwijzen', () => {
    expect(statusUitReden('bewoner niet thuis, opnieuw inplannen', S)).toBe('opnieuw inplannen/later')
    expect(statusUitReden('moet opnieuw plannen volgende week', S)).toBe('opnieuw inplannen/later')
  })

  it('laat asbest voorgaan op opnieuw inplannen', () => {
    // "asbest gevonden, moet opnieuw ingepland" is één zin met twee
    // signalen. Asbest is het feit waar een aparte procedure aan hangt.
    expect(statusUitReden('asbest gevonden, opnieuw inplannen', S)).toBe('onhold door asbest')
  })

  it('valt terug op gewoon stilgelegd bij alles wat het niet herkent', () => {
    // Geen gok, geen lege status: gewoon on hold. De reden zelf staat
    // als opmerking bij de taak, dus de informatie gaat niet verloren.
    expect(statusUitReden('ziekte', S)).toBe('on hold')
    expect(statusUitReden('materiaal niet geleverd', S)).toBe('on hold')
    expect(statusUitReden('weer te slecht', S)).toBe('on hold')
  })

  it('valt terug op "on hold" als een tenant de status niet heeft ingevuld', () => {
    const leeg: Statussen = {
      status_opgeleverd: null, status_wacht_op_fotos: null,
      status_stilgelegd: null, status_asbest: null, status_opnieuw_inplannen: null,
      status_spuiten_isoleren: null,
    }
    expect(statusUitReden('asbest', leeg)).toBe('on hold')
    expect(statusUitReden('ziekte', leeg)).toBe('on hold')
  })

  it('gebruikt de gewone stilleg-status als alleen de bijzondere ontbreekt', () => {
    const deels: Statussen = { ...S, status_asbest: null }
    expect(statusUitReden('asbest', deels)).toBe('on hold')
  })
})

// ── Nog spuiten/isoleren ─────────────────────────────────────
//
// De ClickUp-lijst kent deze status al lang; NMZ GO kende hem niet en
// liet zulke klussen terugvallen op het algemene "on hold". Juist deze
// status zegt wélk werk er nog ligt, en dus wie er ingepland moet
// worden — dat is precies wat je van het planbord wilt aflezen.

describe('statusUitReden — nog spuiten/isoleren', () => {
  it('herkent de knoptekst', () => {
    expect(statusUitReden('Nog spuiten/isoleren: preparaat is op', S))
      .toBe('nog spuiten/isoleren')
  })

  it('herkent ook een vrij getypte reden met maar één van de twee', () => {
    expect(statusUitReden('moet nog geïsoleerd worden', S)).toBe('nog spuiten/isoleren')
    expect(statusUitReden('kan pas spuiten als de vloer droog is', S))
      .toBe('nog spuiten/isoleren')
  })

  // Asbest gaat overal voor: daar hangt een inventarisatie aan en
  // mogelijk een gecertificeerde saneerder. Wat er verder nog moet
  // gebeuren verandert dat niet.
  it('laat asbest winnen als allebei genoemd worden', () => {
    expect(statusUitReden('asbest gevonden, nog spuiten', S)).toBe('onhold door asbest')
  })

  // "Later" zegt wanneer, "nog spuiten" zegt wat. Dat tweede bepaalt
  // wie je inplant, dus dat weegt zwaarder.
  it('laat spuiten winnen van opnieuw inplannen', () => {
    expect(statusUitReden('opnieuw inplannen, moet nog gespoten', S))
      .toBe('nog spuiten/isoleren')
  })

  it('valt terug op stilgelegd als de status niet is ingesteld', () => {
    expect(statusUitReden('nog spuiten', { ...S, status_spuiten_isoleren: null }))
      .toBe(S.status_stilgelegd)
  })
})

// ── De andere kant op ─────────────────────────────────────────
// Dit is de regel waar de negen bonnen op stukliepen: ClickUp zei
// "opgeleverd", NMZ GO zei "nog niet gestart", en niemand vertaalde
// het een naar het ander. Gaat deze regel te ver, dan overschrijft de
// koppeling werk dat iemand in de app heeft vastgelegd; gaat hij niet
// ver genoeg, dan blijft het bord liegen.

const R: Standregels = {
  ...S,
  trigger_status: 'deze week',
  trigger_statussen: ['volgende week', 'deze week'],
}

describe('standUitStatus', () => {
  it('herkent de statussen die over de uitvoering gaan', () => {
    expect(standUitStatus('opgeleverd', R)).toBe('opgeleverd')
    expect(standUitStatus('on hold', R)).toBe('stilgelegd')
    expect(standUitStatus('nog spuiten/isoleren', R)).toBe('spuiten_isoleren')
    expect(standUitStatus('opnieuw inplannen/later', R)).toBe('opnieuw_inplannen')
  })

  // Asbest is in ClickUp een eigen status, maar NMZ GO kent alleen
  // "ligt stil" met een reden erbij. De reden houdt het woord asbest
  // vast, zodat `statusUitReden` hem later weer op de juiste kolom
  // terugzet als de klus alsnog via de app loopt.
  it('vertaalt asbest naar stilgelegd', () => {
    expect(standUitStatus('onhold door asbest', R)).toBe('stilgelegd')
  })

  it('noemt de triggerstatussen "loopt"', () => {
    expect(standUitStatus('deze week', R)).toBe('loopt')
    expect(standUitStatus('volgende week', R)).toBe('loopt')
  })

  // Dit is de belangrijkste test van het stel. Zonder deze regel leest
  // NMZ GO zijn eigen echo terug: bij het opleveren zonder fotobewijs
  // zet GO deze status zélf op het bord.
  it("leest \"wacht op foto's\" niet terug", () => {
    expect(standUitStatus("wacht op foto's", R)).toBeNull()
  })

  it("trekt zich niets aan van een kromme apostrof", () => {
    expect(standUitStatus('wacht op foto’s', R)).toBeNull()
  })

  // De lijst heeft veertien statussen. De negen die hier niet in staan
  // zijn planning van kantoor en zeggen niets over de uitvoering.
  // `null` betekent: laat de werkbon met rust. Een gok is hier erger
  // dan geen antwoord.
  it('laat de planningsstatussen met rust', () => {
    for (const s of ['toekomst', 'niet af', 'update vereist', 'lopende projecten',
                     'afmaken prio', 'nog isoleren', '']) {
      expect(standUitStatus(s, R)).toBeNull()
    }
  })

  it('kijkt niet naar hoofdletters of losse spaties', () => {
    expect(standUitStatus('  OPGELEVERD ', R)).toBe('opgeleverd')
    expect(standUitStatus('On  Hold', R)).toBe('stilgelegd')
  })

  it('negeert een status die deze tenant niet heeft ingevuld', () => {
    // Een lege kolom is geen status. Zonder deze controle zou een taak
    // zonder status ('' ) op elke lege instelling matchen en zou de
    // eerste de beste bon worden stilgelegd.
    expect(standUitStatus('', { ...R, status_stilgelegd: null })).toBeNull()
    expect(standUitStatus('on hold', { ...R, status_stilgelegd: null })).toBeNull()
  })

  it('valt terug op de enkele triggerstatus als er geen lijst is', () => {
    expect(standUitStatus('deze week', { ...R, trigger_statussen: null })).toBe('loopt')
    expect(standUitStatus('volgende week', { ...R, trigger_statussen: null })).toBeNull()
  })
})

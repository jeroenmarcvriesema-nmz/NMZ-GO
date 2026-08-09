import { describe, it, expect } from 'vitest'
import { statusUitReden, type Statussen } from '../supabase/functions/verwerker/statusregels'

// Dezelfde namen als in clickup_instellingen staan.
const S: Statussen = {
  status_opgeleverd: 'opgeleverd',
  status_wacht_op_fotos: "wacht op foto's",
  status_stilgelegd: 'on hold',
  status_asbest: 'onhold door asbest',
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
    }
    expect(statusUitReden('asbest', leeg)).toBe('on hold')
    expect(statusUitReden('ziekte', leeg)).toBe('on hold')
  })

  it('gebruikt de gewone stilleg-status als alleen de bijzondere ontbreekt', () => {
    const deels: Statussen = { ...S, status_asbest: null }
    expect(statusUitReden('asbest', deels)).toBe('on hold')
  })
})

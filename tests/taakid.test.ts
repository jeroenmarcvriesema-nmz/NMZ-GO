import { describe, it, expect } from 'vitest'
import { taakIdUit } from '@/lib/clickup'

// Kantoor plakt wat er in het klembord zit. Dat is bijna nooit een kaal
// id: het is de adresbalk, of "copy link" uit ClickUp. Haalt dit er het
// verkeerde uit, dan komt er een foutmelding over een taak die niet
// bestaat en zoekt iemand in de verkeerde hoek.

describe('taakIdUit', () => {
  it('haalt het id uit een gewone taaklink', () => {
    expect(taakIdUit('https://app.clickup.com/t/86cayvbnd')).toBe('86cayvbnd')
  })

  it('haalt het id uit een link met werkruimte ervoor', () => {
    expect(taakIdUit('https://app.clickup.com/t/9012345/86cayvbnd')).toBe('86cayvbnd')
  })

  it('negeert wat er achter een vraagteken of hekje staat', () => {
    expect(taakIdUit('https://app.clickup.com/t/86cayvbnd?comment=123')).toBe('86cayvbnd')
    expect(taakIdUit('https://app.clickup.com/t/86cayvbnd#activity')).toBe('86cayvbnd')
  })

  it('neemt een kaal id zoals het is', () => {
    expect(taakIdUit('86cayvbnd')).toBe('86cayvbnd')
  })

  it('trekt spaties eromheen weg', () => {
    expect(taakIdUit('  86cayvbnd \n')).toBe('86cayvbnd')
  })

  it('geeft niets terug bij iets wat geen taak is', () => {
    expect(taakIdUit('')).toBeNull()
    expect(taakIdUit('   ')).toBeNull()
    expect(taakIdUit('kort')).toBeNull()
    expect(taakIdUit('Bentinckstraat 63')).toBeNull()
    expect(taakIdUit('https://app.clickup.com/9012345/v/li/901234')).toBeNull()
  })
})

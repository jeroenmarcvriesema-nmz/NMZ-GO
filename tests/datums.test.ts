import { describe, it, expect } from 'vitest'
import { datumInWerkzone } from '../supabase/functions/verwerker/datums'

// Elke test hieronder hoort bij een klus die in de planning op de
// verkeerde dag stond.

describe('datumInWerkzone', () => {
  it('leest een datumveld dat op middernacht Amsterdamse tijd staat', () => {
    // Belgradostraat 13: de opdracht zegt "10-08-2026 08:00 uur".
    // ClickUp bewaart dat veld op 1786312800000 — 22:00 UTC op de
    // negende. Afkappen in UTC maakte er 9 augustus van, en dan staat
    // de ploeg een dag te vroeg voor de deur.
    expect(datumInWerkzone(1786312800000)).toBe('2026-08-10')
    expect(datumInWerkzone(1786399200000)).toBe('2026-08-11')
  })

  it('laat een tijdstempel midden op de dag met rust', () => {
    // De taakdatum van ClickUp staat op 02:00 UTC. Die gaf in UTC al
    // het goede antwoord en hoort dat te blijven geven.
    expect(datumInWerkzone(1786327200000)).toBe('2026-08-10')
    expect(datumInWerkzone(1786932000000)).toBe('2026-08-17')
  })

  it('rekent met zomertijd en wintertijd', () => {
    // Eind oktober gaat de klok een uur terug. Middernacht Amsterdam
    // is in de zomer 22:00 UTC en in de winter 23:00 UTC; met de hand
    // twee uur aftrekken werkt dus een half jaar en daarna niet meer.
    // 31 december 2026 00:00 Amsterdam = 30 december 23:00 UTC.
    expect(datumInWerkzone(Date.parse('2026-12-30T23:00:00Z'))).toBe('2026-12-31')
    // 1 juli 2026 00:00 Amsterdam = 30 juni 22:00 UTC.
    expect(datumInWerkzone(Date.parse('2026-06-30T22:00:00Z'))).toBe('2026-07-01')
  })

  it('geeft niets terug bij niets of onzin', () => {
    expect(datumInWerkzone(null)).toBeNull()
    expect(datumInWerkzone(undefined)).toBeNull()
    expect(datumInWerkzone('')).toBeNull()
    expect(datumInWerkzone('geen getal')).toBeNull()
  })

  it('neemt een tijdstempel als tekst ook aan', () => {
    // ClickUp levert custom fields als string, de taakdatums als getal.
    expect(datumInWerkzone('1786312800000')).toBe('2026-08-10')
  })
})

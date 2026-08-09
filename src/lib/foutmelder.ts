import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// ============================================================
// NMZ GO — fouten melden
// ============================================================
// Onze jongens werken op hun werktelefoon, in een kruipruimte, met
// slecht bereik. Ging daar iets stuk, dan zag kantoor daar niets van:
// een wit scherm, een telefoontje, en niets om op terug te kijken.
//
// Dit meldt een crash naar de `fouten`-tabel. Bewust met de hand
// geschreven in plaats van een monitoringdienst: er gaat geen data van
// klanten naar een derde partij, het kost niets, en wat we nodig hebben
// is niet meer dan "wat, waar, wie, wanneer".
//
// Drie regels die dit bestand aanhoudt:
//   1. Melden mag nooit de oorzaak van een tweede fout zijn. Alles
//      hieronder faalt stil.
//   2. Dezelfde fout twee keer achter elkaar is één melding. Een
//      renderlus zou anders honderden regels wegschrijven.
//   3. Geen sessie, geen melding. De tabel is niet schrijfbaar zonder
//      inlog en dat houden we zo.
// ============================================================

/** Hoe lang dezelfde boodschap onderdrukt blijft. */
const STILTE_MS = 30_000

const laatst = new Map<string, number>()

export type FoutBron = 'render' | 'belofte' | 'venster'

function ontdubbel(sleutel: string): boolean {
  const nu = Date.now()
  const vorige = laatst.get(sleutel)
  if (vorige && nu - vorige < STILTE_MS) return false
  laatst.set(sleutel, nu)
  return true
}

/**
 * Meldt een fout. Geeft niets terug en gooit nooit — de aanroeper is
 * altijd al bezig met iets ergers.
 */
export async function meldFout(fout: unknown, bron: FoutBron = 'render'): Promise<void> {
  try {
    const boodschap =
      fout instanceof Error ? fout.message
      : typeof fout === 'string' ? fout
      : JSON.stringify(fout)?.slice(0, 500) ?? 'Onbekende fout'

    const stack = fout instanceof Error ? fout.stack ?? null : null

    // Altijd ook in de console: wie erbij staat met een laptop ziet hem
    // meteen, zonder de database te hoeven openen.
    console.error(`[NMZ GO/${bron}]`, fout)

    if (!ontdubbel(`${bron}:${boodschap}`)) return

    const profile = useAuthStore.getState().profile
    if (!profile?.tenant_id) return

    await supabase.from('fouten').insert({
      tenant_id: profile.tenant_id,
      profile_id: profile.id,
      boodschap: boodschap.slice(0, 2000),
      stack: stack ? stack.slice(0, 8000) : null,
      pad: window.location.pathname + window.location.search,
      useragent: navigator.userAgent.slice(0, 500),
      bron,
    })
  } catch {
    // Met opzet leeg. Een melding die zelf klapt maakt het alleen erger.
  }
}

/**
 * Vangt wat er buiten React omvalt: een afgewezen belofte zonder catch
 * en een losse scriptfout. Die twee komen niet bij een ErrorBoundary
 * terecht en waren daarom tot nu toe volledig onzichtbaar.
 */
export function luisterOpFouten(): void {
  window.addEventListener('unhandledrejection', (e) => {
    void meldFout(e.reason, 'belofte')
  })
  window.addEventListener('error', (e) => {
    void meldFout(e.error ?? e.message, 'venster')
  })
}

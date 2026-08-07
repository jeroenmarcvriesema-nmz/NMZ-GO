// ============================================================
// NMZ GO — Edge Function: verwerker
// ============================================================
// Fase 1 van Epic 4. Haalt een batch taken uit de wachtrij, voert
// ze uit en schrijft het resultaat terug. Aangeroepen door pg_cron
// (elke minuut) of handmatig vanaf het beheerdersscherm.
//
// Bewust nog zonder ClickUp. Fase 2 hoeft alleen een handler aan
// HANDLERS toe te voegen; aan de lus hieronder verandert niets.
//
// Twee regels die uit het architectuurdocument komen en die elke
// nieuwe handler moet aanhouden:
//   1. Idempotent — twee keer uitvoeren geeft hetzelfde resultaat
//      als één keer. Zonder dat wordt elke storing handwerk.
//   2. Het onderscheid tijdelijk/blijvend is aan de handler. Gooi
//      OnverwerkbaarError bij een blijvende fout (verwijderd item,
//      ongeldige verwijzing); al het andere telt als tijdelijk en
//      wordt opnieuw geprobeerd met oplopende wachttijd.
// ============================================================

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Een fout die niet opnieuw geprobeerd moet worden.
class OnverwerkbaarError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnverwerkbaarError'
  }
}

interface Taak {
  id: string
  soort: string
  payload: Record<string, unknown>
  pogingen: number
  volgnummer: string
}

type Handler = (taak: Taak, db: SupabaseClient) => Promise<Record<string, unknown>>

// ── Taaksoorten ──────────────────────────────────────────────

const HANDLERS: Record<string, Handler> = {
  // Slaagt, eventueel na een vertraging. Bewijst de gelukkige route.
  'test.echo': async (taak) => {
    const vertraging = Number(taak.payload.vertraging_ms ?? 0)
    if (vertraging > 0) {
      await new Promise((r) => setTimeout(r, Math.min(vertraging, 5000)))
    }
    return { echo: taak.payload, vertraagd_ms: vertraging }
  },

  // Mislukt altijd. Bewijst de herhaling met oplopende wachttijd en,
  // zodra de pogingen op zijn, de overgang naar onverwerkbaar.
  'test.faalt': async (taak) => {
    throw new Error(
      String(taak.payload.reden ?? 'testfout, opzettelijk') + ` (poging ${taak.pogingen})`,
    )
  },

  // Mislukt blijvend. Bewijst dat een handler herhaling kan overslaan.
  'test.onverwerkbaar': async () => {
    throw new OnverwerkbaarError('testfout die niet opnieuw geprobeerd hoort te worden')
  },

  // De eerste echte gebruiker van de wachtrij: uitnodigingen waarvan
  // de vervaldatum voorbij is, worden op gebruikt gezet zodat ze niet
  // meer inwisselbaar zijn.
  //
  // Idempotent doordat de where-clausule al verlopen-en-nog-niet-
  // gebruikt selecteert: een tweede ronde vindt niets meer.
  'onderhoud.uitnodigingen_opschonen': async (_taak, db) => {
    const { data, error } = await db
      .from('uitnodigingen')
      .update({ gebruikt: true })
      .lt('verloopt_op', new Date().toISOString())
      .eq('gebruikt', false)
      .select('id')

    if (error) throw new Error(`opschonen mislukt: ${error.message}`)
    return { opgeschoond: data?.length ?? 0 }
  },
}

// ── De lus ───────────────────────────────────────────────────

const BATCH = 10

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !key) {
    return json({ fout: 'SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt' }, 500)
  }

  const db = createClient(url, key, { auth: { persistSession: false } })

  let aanleiding = 'cron'
  try {
    const body = await req.json()
    if (body?.aanleiding === 'handmatig') aanleiding = 'handmatig'
  } catch {
    // Geen body is prima — dan is het een cron-aanroep.
  }

  const start = Date.now()
  const { data: ronde } = await db
    .from('verwerkingsronden')
    .insert({ aanleiding })
    .select('id')
    .single()

  let bekeken = 0
  let geslaagd = 0
  let mislukt = 0
  let rondeFout: string | null = null

  try {
    const { data: taken, error } = await db.rpc('claim_verwerkingstaken', { aantal: BATCH })
    if (error) throw new Error(`claimen mislukt: ${error.message}`)

    for (const taak of (taken ?? []) as Taak[]) {
      bekeken++
      const handler = HANDLERS[taak.soort]

      // Een onbekende soort is geen tijdelijke storing — opnieuw
      // proberen levert hetzelfde op.
      if (!handler) {
        await db.rpc('taak_onverwerkbaar', {
          taak_id: taak.id,
          reden: `onbekende taaksoort: ${taak.soort}`,
        })
        mislukt++
        continue
      }

      try {
        const resultaat = await handler(taak, db)
        await db.rpc('taak_geslaagd', { taak_id: taak.id, uitkomst: resultaat })
        geslaagd++
      } catch (e) {
        const reden = e instanceof Error ? e.message : String(e)
        const rpc = e instanceof OnverwerkbaarError ? 'taak_onverwerkbaar' : 'taak_mislukt'
        await db.rpc(rpc, { taak_id: taak.id, reden })
        mislukt++
      }
    }
  } catch (e) {
    rondeFout = e instanceof Error ? e.message : String(e)
  }

  if (ronde?.id) {
    await db
      .from('verwerkingsronden')
      .update({
        geeindigd_op: new Date().toISOString(),
        bekeken,
        geslaagd,
        mislukt,
        duur_ms: Date.now() - start,
        fout: rondeFout,
      })
      .eq('id', ronde.id)
  }

  return json({ aanleiding, bekeken, geslaagd, mislukt, fout: rondeFout }, rondeFout ? 500 : 200)
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

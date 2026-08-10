// ============================================================
// NMZ GO — Edge Function: verwerker
// ============================================================
// Haalt een batch taken uit de wachtrij, voert ze uit en schrijft het
// resultaat terug. Aangeroepen door pg_cron (elke minuut) of handmatig
// vanaf het beheerdersscherm.
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
import {
  fotosUploaden,
  importeerTaak,
  statusBijwerken,
  synchroniseer,
  tekstproef,
} from './clickup.ts'

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
  prioriteit: number
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

  // Taken uit ClickUp omzetten naar werkbonnen.
  //
  // Staat de synchronisatie op niet-actief, dan draait deze handler
  // droog: hij rapporteert wat hij zou doen en schrijft niets weg.
  // Dat is de afspraak dat er niets naar productie gaat voordat de
  // terugkoppeling naar ClickUp werkt.
  'clickup.synchroniseren': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    if (!tenantId) {
      throw new OnverwerkbaarError('tenant_id ontbreekt in de payload')
    }
    return await synchroniseer(db, tenantId)
  },

  // Eén taak met de hand binnenhalen, ongeacht status.
  //
  // De ronde hierboven kijkt alleen naar "deze week" en "volgende
  // week". Wat daarbuiten valt — werk dat tussendoor komt, een taak die
  // per ongeluk op een andere status stond — kon alleen binnenkomen
  // door in ClickUp de status te verzetten, en dat verandert het
  // planbord voor iedereen alleen om iets in NMZ GO te krijgen.
  //
  // Loopt langs precies dezelfde weg als de automatische ronde, dus ook
  // idempotent: een tweede keer importeren geeft geen tweede bon.
  'clickup.taak_importeren': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    const clickupTaakId = String(taak.payload.clickup_taak_id ?? '')
    if (!tenantId || !clickupTaakId) {
      throw new OnverwerkbaarError('tenant_id en clickup_taak_id zijn allebei nodig')
    }
    return await importeerTaak(db, tenantId, clickupTaakId)
  },

  // Diagnose van één opdracht: wat leest de parser er precies uit?
  // Zonder deze ingang is een overgeslagen opdracht niet na te lopen —
  // de bijlage-URL's van ClickUp zijn kortlevend en alleen deze functie
  // komt erbij.
  'clickup.tekstproef': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    const clickupTaakId = String(taak.payload.clickup_taak_id ?? '')
    if (!tenantId || !clickupTaakId) {
      throw new OnverwerkbaarError('tenant_id en clickup_taak_id zijn allebei nodig')
    }
    return await tekstproef(db, tenantId, clickupTaakId)
  },

  // De foto's van een werkbon als bijlage bij de ClickUp-taak.
  //
  // Staat vóór de statuswijziging in de wachtrij (prioriteit 50 tegen
  // 100), zodat de bijlagen er staan op het moment dat de status naar
  // "opgeleverd" springt. Idempotent via een stempel per foto: wat al
  // bij ClickUp staat gaat niet nog een keer.
  'clickup.fotos_uploaden': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    const werkbonId = String(taak.payload.werkbon_id ?? '')
    if (!tenantId || !werkbonId) {
      throw new OnverwerkbaarError('tenant_id en werkbon_id zijn allebei nodig')
    }
    return await fotosUploaden(db, tenantId, werkbonId)
  },

  // Terugkoppeling naar ClickUp: stilgelegd, hervat of opgeleverd.
  //
  // Via de wachtrij en niet rechtstreeks vanuit de database, zodat een
  // storing bij ClickUp het stilleggen zelf nooit tegenhoudt. Ligt
  // ClickUp eruit, dan blijft de taak staan en volgt hij later.
  'clickup.status_bijwerken': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    const werkbonId = String(taak.payload.werkbon_id ?? '')
    const soort = String(taak.payload.soort ?? '')

    if (!tenantId || !werkbonId) {
      throw new OnverwerkbaarError('tenant_id en werkbon_id zijn allebei nodig')
    }
    if (soort !== 'stilgelegd' && soort !== 'hervat' && soort !== 'opgeleverd') {
      throw new OnverwerkbaarError(`onbekende soort statuswijziging: ${soort}`)
    }
    return await statusBijwerken(db, tenantId, werkbonId, soort)
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

    // De claim kiest op prioriteit, maar de volgorde waarin hij de
    // rijen teruggeeft is die van het queryplan en niet van de
    // sortering. Voor twee taken uit dezelfde gebeurtenis is dat het
    // verschil tussen "de foto's staan er als de status springt" en
    // "meestal wel" — dus sorteren we hier zelf.
    const batch = [...((taken ?? []) as Taak[])].sort((a, b) => a.prioriteit - b.prioriteit)

    for (const taak of batch) {
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

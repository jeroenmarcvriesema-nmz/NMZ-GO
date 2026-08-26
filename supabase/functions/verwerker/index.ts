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
  werkbonBijwerken,
} from './clickup.ts'
import { fotosOpruimen } from './opruimen.ts'
import { bouwOpleverrapport, meldRapportMislukt } from './rapport.ts'
import { geocodeerRonde } from './geocode.ts'

// Een fout die niet opnieuw geprobeerd moet worden.
class OnverwerkbaarError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnverwerkbaarError'
  }
}

/**
 * Is dit een blijvende fout?
 *
 * Op naam en niet op klasse. Een handler in een eigen bestand kan deze
 * klasse niet importeren zonder een kringverwijzing te maken, dus die
 * gooien een eigen fout met dezelfde naam. Met alleen `instanceof` zou
 * zo'n fout stilletjes als tijdelijk gelden en vijf keer opnieuw
 * worden geprobeerd — vijf keer hetzelfde antwoord, en pas daarna de
 * conclusie die er meteen al was.
 */
function isBlijvend(e: unknown): boolean {
  return e instanceof OnverwerkbaarError
    || (e instanceof Error && e.name === 'OnverwerkbaarError')
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

  // De bucket opruimen: bestanden waarvan het bewijs inmiddels bij
  // ClickUp staat, en bestanden waar geen enkele rij meer naar wijst.
  //
  // Wélke bestanden weg mogen bepaalt de database; deze handler wist
  // alleen wat hij aangereikt krijgt. Eerst het bestand, dan het
  // stempel — andersom zou een rij kunnen beweren dat hij is opgeruimd
  // terwijl het bestand er nog staat.
  'onderhoud.fotos_opruimen': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    if (!tenantId) {
      throw new OnverwerkbaarError('tenant_id ontbreekt in de payload')
    }
    return await fotosOpruimen(db, tenantId, Number(taak.payload.wachttijd_dagen ?? 14))
  },

  // Een wijziging uit NMZ GO terug naar ClickUp: de ploeg of de
  // planning.
  //
  // Kantoor wijzigt tijdens een lopende klus wie erop staat en wanneer
  // hij af moet. Blijft dat in NMZ GO hangen, dan klopt het planbord
  // niet meer — en de synchronisatieronde zou de ploeg binnen vijf
  // minuten terugzetten naar wat ClickUp nog dacht.
  'clickup.werkbon_bijwerken': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    const werkbonId = String(taak.payload.werkbon_id ?? '')
    const soort = String(taak.payload.soort ?? '')

    if (!tenantId || !werkbonId) {
      throw new OnverwerkbaarError('tenant_id en werkbon_id zijn allebei nodig')
    }
    if (soort !== 'ploeg' && soort !== 'planning') {
      throw new OnverwerkbaarError(`onbekende soort wijziging: ${soort}`)
    }
    return await werkbonBijwerken(db, tenantId, werkbonId, soort)
  },

  // Terugkoppeling naar ClickUp: stilgelegd, hervat, opgeleverd, of een
  // van de twee soorten vervolgwerk (migratie 035 — die laatste twee
  // zetten wél een status op het bord maar leggen de klus niet stil).
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
    const bekend = ['stilgelegd', 'hervat', 'opgeleverd', 'spuiten_isoleren', 'opnieuw_inplannen'] as const
    if (!(bekend as readonly string[]).includes(soort)) {
      throw new OnverwerkbaarError(`onbekende soort statuswijziging: ${soort}`)
    }
    return await statusBijwerken(db, tenantId, werkbonId, soort as typeof bekend[number])
  },

  // Het opleverrapport bouwen: het enige document dat NMZ GO naar
  // buiten stuurt.
  //
  // De knop die dit aanvraagt staat sinds migratie 025 live, maar deze
  // taaksoort had geen handler — elke aanvraag liep zijn pogingen leeg
  // en werd onverwerkbaar. Kantoor drukte op een knop die niets deed.
  //
  // Wie een rapport mág maken is op dit moment al beslist door
  // `rapportage_aanvragen()`: uitvoerder of hoger, en minstens één
  // foto. Hier wordt alleen nog uitgevoerd wat daar is goedgekeurd.
  // Adressen omzetten naar een punt op de kaart. Nodig om te kunnen
  // zeggen hoe ver iemand van de klus stond toen hij zich aanmeldde;
  // de werkbon heeft alleen een adres als tekst.
  //
  // Als losse ronde en niet in de synchronisatie: dat is een aanroep
  // naar een dienst van iemand anders, en die hoort de invoer van
  // nieuwe klussen niet op te houden als hij traag is.
  'onderhoud.geocoderen': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    if (!tenantId) {
      throw new OnverwerkbaarError('tenant_id ontbreekt in de payload')
    }
    return await geocodeerRonde(db, tenantId, Number(taak.payload.aantal ?? 10))
  },

  'rapportage.genereren': async (taak, db) => {
    const tenantId = String(taak.payload.tenant_id ?? '')
    const werkbonId = String(taak.payload.werkbon_id ?? '')
    const rapportageId = String(taak.payload.rapportage_id ?? '')

    if (!tenantId || !werkbonId || !rapportageId) {
      throw new OnverwerkbaarError('tenant_id, werkbon_id en rapportage_id zijn alle drie nodig')
    }

    try {
      return await bouwOpleverrapport(db, tenantId, werkbonId, rapportageId)
    } catch (e) {
      // De aanvraag pas op mislukt zetten als er niets meer volgt.
      // Bij een tijdelijke storing komt er nog een poging, en dan is
      // "mislukt" op het scherm een leugen die vanzelf weer klopt —
      // maar kantoor heeft hem intussen wel gelezen.
      const reden = e instanceof Error ? e.message : String(e)
      const laatste = isBlijvend(e) || taak.pogingen >= LAATSTE_POGING
      if (laatste) await meldRapportMislukt(db, rapportageId, reden)
      throw e
    }
  },
}

/**
 * Vanaf deze poging volgt er niets meer.
 *
 * `verwerkingstaken.max_pogingen` staat standaard op vijf (migratie
 * 004) en `pogingen` telt de mislukte rondes. Zit hij op vier, dan is
 * de ronde die nu draait de laatste.
 */
const LAATSTE_POGING = 4

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
    // Eerst opruimen wat is blijven hangen. Een handler die door de
    // runtime wordt afgekapt — te veel processortijd, een herstart —
    // laat zijn taak op 'bezig' staan, en `claim_verwerkingstaken`
    // kijkt daar niet naar. Zonder deze stap is zo'n taak voorgoed
    // onzichtbaar: geen fout, geen herhaling, geen spoor. Zie migratie
    // 036; de rapportgenerator was de eerste die er zwaar genoeg voor was.
    const { data: teruggezet } = await db.rpc('taken_terugzetten', {
      p_ouder_dan: '10 minutes',
    })
    if (teruggezet) console.log(`${teruggezet} vastgelopen taken teruggezet`)

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
        const rpc = isBlijvend(e) ? 'taak_onverwerkbaar' : 'taak_mislukt'
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

// ============================================================
// NMZ GO — de bucket opruimen
// ============================================================
// Derde stap van de fotoketen. Zodra ClickUp de foto's heeft, is
// Supabase Storage nog maar een doorgeefluik.
//
// Deze module bedenkt zelf niets. Wélke bestanden weg mogen staat in
// de database (`fotos_op_te_ruimen`), met vier voorwaarden die alle
// vier waar moeten zijn: het uploadstempel is gevuld, de klus is
// opgeleverd, de wachttijd is voorbij, en er ligt geen opleverrapport
// te wachten dat dezelfde foto's nodig heeft. Hier staat alleen het
// wissen zelf, want alleen de Edge Function komt bij Storage.
//
// De volgorde is niet vrij: eerst het bestand weg, dán het stempel.
// Andersom zou een rij kunnen beweren dat hij is opgeruimd terwijl het
// bestand er nog staat — en dan staat er iets in de opslag waar niets
// meer naar kijkt.

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'werkbon-fotos'

/** Storage neemt niet onbeperkt paden tegelijk aan. */
const PER_KEER = 100

interface OpTeRuimen {
  id: string
  storage_path: string
  werkbon_id: string
}

/** Wist een reeks paden in blokken en geeft terug wat er weg is. */
async function wis(
  db: SupabaseClient,
  paden: string[],
): Promise<{ gewist: string[]; mislukt: { pad: string; reden: string }[] }> {
  const gewist: string[] = []
  const mislukt: { pad: string; reden: string }[] = []

  for (let n = 0; n < paden.length; n += PER_KEER) {
    const blok = paden.slice(n, n + PER_KEER)
    const { data, error } = await db.storage.from(BUCKET).remove(blok)

    if (error) {
      // Het hele blok telt als niet-gewist. Niets stempelen dus; de
      // volgende ronde probeert het opnieuw.
      for (const pad of blok) mislukt.push({ pad, reden: error.message })
      continue
    }

    // Storage geeft terug wat hij daadwerkelijk kwijt is. Een pad dat
    // er niet tussen staat is niet gewist — bijvoorbeeld omdat het al
    // weg was. Dat laatste is geen fout, maar we stempelen het niet op
    // gezag van onze eigen aanname.
    const weg = new Set((data ?? []).map((o) => o.name))
    for (const pad of blok) {
      if (weg.has(pad)) gewist.push(pad)
      else mislukt.push({ pad, reden: 'Storage gaf dit pad niet terug als gewist' })
    }
  }

  return { gewist, mislukt }
}

/**
 * Eén opruimronde voor één tenant.
 *
 * Idempotent: wat opgeruimd is heeft een stempel en komt niet meer in
 * de lijst. Een tweede ronde vindt niets.
 *
 * Laat een mislukking niet de hele ronde omgooien. Wat wél is gewist
 * krijgt zijn stempel, en de rest komt terug in het resultaat en in de
 * volgende ronde. Een storing in Storage is geen reden om de opruiming
 * van veertien dagen geleden opnieuw over te doen.
 */
export async function fotosOpruimen(
  db: SupabaseClient,
  tenantId: string,
  wachttijdDagen: number,
): Promise<Record<string, unknown>> {
  const dagen = Number.isFinite(wachttijdDagen) ? Math.max(Math.trunc(wachttijdDagen), 1) : 14

  const { data: lijst, error } = await db.rpc('fotos_op_te_ruimen', {
    p_tenant: tenantId,
    p_dagen: dagen,
  })
  if (error) throw new Error(`op te ruimen foto's opvragen mislukt: ${error.message}`)

  const teRuimen = (lijst ?? []) as OpTeRuimen[]
  let gestempeld = 0
  const problemen: { pad: string; reden: string }[] = []

  if (teRuimen.length > 0) {
    const uitkomst = await wis(db, teRuimen.map((f) => f.storage_path))
    problemen.push(...uitkomst.mislukt)

    const weg = new Set(uitkomst.gewist)
    const ids = teRuimen.filter((f) => weg.has(f.storage_path)).map((f) => f.id)

    if (ids.length > 0) {
      const { data: aantal, error: stempelFout } = await db.rpc('fotos_opgeruimd_stempelen', {
        p_tenant: tenantId,
        p_ids: ids,
        p_dagen: dagen,
      })
      if (stempelFout) {
        throw new Error(
          `bestanden zijn gewist maar het stempel is niet weggeschreven: ${stempelFout.message}`,
        )
      }
      gestempeld = Number(aantal ?? 0)
    }
  }

  // Weesbestanden: een foto verwijderen haalde de databaserij weg en
  // liet het bestand staan. Er verwijst niets meer naar, dus niemand
  // ziet ze ooit terug — behalve de teller van het opslagverbruik.
  const { data: wezen, error: weesFout } = await db.rpc('fotos_weesbestanden', {
    p_tenant: tenantId,
    p_dagen: dagen,
  })
  if (weesFout) throw new Error(`weesbestanden opvragen mislukt: ${weesFout.message}`)

  const weesPaden = ((wezen ?? []) as { pad: string }[]).map((w) => w.pad)
  let wezenGewist = 0
  if (weesPaden.length > 0) {
    const uitkomst = await wis(db, weesPaden)
    wezenGewist = uitkomst.gewist.length
    problemen.push(...uitkomst.mislukt)
  }

  return {
    wachttijd_dagen: dagen,
    in_aanmerking: teRuimen.length,
    opgeruimd: gestempeld,
    weesbestanden_gewist: wezenGewist,
    ...(problemen.length > 0 ? { niet_gelukt: problemen.slice(0, 20) } : {}),
  }
}

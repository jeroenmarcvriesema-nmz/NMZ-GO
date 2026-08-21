// NMZ GO — het opleverrapport bouwen en wegzetten
//
// De aanvraagknop staat sinds migratie 025 live en maakt een rij in
// `rapportages` plus een wachtrijtaak `rapportage.genereren`. Die
// taaksoort had geen handler, dus elke aanvraag bleef op 'wachtend'
// staan. Dit is die handler.
//
// Twee regels van de verwerker gelden ook hier:
//
//   1. Idempotent. Het pad is afgeleid van de rapportage-id en de
//      upload gaat met `upsert`, dus twee keer draaien geeft één
//      bestand en geen tweede rapport dat ook naar ClickUp zou gaan.
//   2. Tijdelijk of blijvend. Een verdwenen werkbon is blijvend en
//      hoort niet opnieuw geprobeerd te worden; een hik in Storage is
//      tijdelijk en komt vanzelf terug.
//
// De foto's gaan als data-URI het document in. Dat maakt het bestand
// groot, maar het maakt het ook één bestand: opdrachtgevers krijgen het
// per mail doorgestuurd, en een rapport waarvan de foto's na een week
// verlopen omdat het signed URL's waren is geen rapport.

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { bouwRapport, type RapportFoto, type Rapportgegevens } from './rapportsjabloon.ts'

const BUCKET = 'werkbon-documenten'
const FOTOBUCKET = 'werkbon-fotos'

/** Zelfde soort fout als in index.ts: hier niet opnieuw proberen. */
class OnverwerkbaarError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnverwerkbaarError'
  }
}

/** Bytes naar een data-URI, in stukjes zodat een grote foto de stack niet omgooit. */
function naarDataUri(bytes: Uint8Array, type: string): string {
  let binair = ''
  const stap = 0x8000
  for (let i = 0; i < bytes.length; i += stap) {
    binair += String.fromCharCode(...bytes.subarray(i, i + stap))
  }
  return `data:${type || 'image/jpeg'};base64,${btoa(binair)}`
}

function typeUitPad(pad: string): string {
  const ext = pad.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  return 'image/jpeg'
}

/**
 * Het rapport maken voor één werkbon.
 *
 * Mislukt het, dan zet de handler de rij op 'mislukt' met de reden
 * erbij — dat is wat het scherm laat zien. Zonder dat blijft er een
 * aanvraag hangen waarvan niemand weet waarom hij niets doet.
 */
export async function rapportGenereren(
  db: SupabaseClient,
  tenantId: string,
  werkbonId: string,
  rapportageId: string,
): Promise<Record<string, unknown>> {
  try {
    const gegevens = await gegevensOphalen(db, tenantId, werkbonId)
    const html = bouwRapport(gegevens)

    // Vast pad per rapportage: opnieuw draaien overschrijft en stapelt
    // geen bestanden op in de bucket.
    const pad = `${werkbonId}/opleverrapport-${rapportageId.slice(0, 8)}.html`

    const { error: uploadFout } = await db.storage.from(BUCKET).upload(
      pad,
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      { contentType: 'text/html;charset=utf-8', upsert: true },
    )
    if (uploadFout) throw new Error(`rapport uploaden mislukt: ${uploadFout.message}`)

    const { error: bijwerkFout } = await db
      .from('rapportages')
      .update({ status: 'klaar', bestandspad: pad, fout: null, gegenereerd_op: new Date().toISOString() })
      .eq('id', rapportageId)
      .eq('tenant_id', tenantId)
    if (bijwerkFout) throw new Error(`rapportage bijwerken mislukt: ${bijwerkFout.message}`)

    return { bestandspad: pad, fotos: gegevens.fotos.length, punten: gegevens.punten.length }
  } catch (fout) {
    // De reden vastleggen vóór we hem doorgooien. Bij een tijdelijke
    // fout wordt hij bij de volgende poging weer op 'klaar' gezet; tot
    // die tijd staat er tenminste iets op het scherm.
    const reden = fout instanceof Error ? fout.message : String(fout)
    await db
      .from('rapportages')
      .update({ status: 'mislukt', fout: reden })
      .eq('id', rapportageId)
      .eq('tenant_id', tenantId)
    throw fout
  }
}

async function gegevensOphalen(
  db: SupabaseClient,
  tenantId: string,
  werkbonId: string,
): Promise<Rapportgegevens> {
  const { data: bon, error } = await db
    .from('werkbonnen')
    .select(
      'adres, postcode, plaats, opdrachtnummer, opleverdatum, opgeleverd_op, ' +
        'opmerkingen_bewoners, extra_werkzaamheden, bijzonderheden, project:projecten(naam, opdrachtgever)',
    )
    .eq('id', werkbonId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw new Error(`werkbon lezen mislukt: ${error.message}`)
  if (!bon) throw new OnverwerkbaarError('werkbon bestaat niet meer')

  const project = (bon as Record<string, unknown>).project as
    | { naam?: string; opdrachtgever?: string }
    | null

  const { data: ploegrijen } = await db
    .from('werkbon_medewerkers')
    .select('persoon:personen(naam)')
    .eq('werkbon_id', werkbonId)

  const ploeg = ((ploegrijen ?? []) as { persoon?: { naam?: string } | null }[])
    .map((r) => r.persoon?.naam)
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b, 'nl'))

  const { data: taken } = await db
    .from('taken')
    .select('id, titel, voltooid, volgorde')
    .eq('werkbon_id', werkbonId)
    .order('volgorde', { ascending: true })

  const puntenlijst = (taken ?? []) as { id: string; titel: string; voltooid: boolean }[]
  const titelPerTaak = new Map(puntenlijst.map((t) => [t.id, t.titel]))

  const { data: fotorijen } = await db
    .from('fotos')
    .select('storage_path, fase, taak_id, created_at')
    .eq('werkbon_id', werkbonId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  const fotos: RapportFoto[] = []
  for (const rij of (fotorijen ?? []) as {
    storage_path: string
    fase: string
    taak_id: string
  }[]) {
    const { data: bestand, error: fotoFout } = await db.storage
      .from(FOTOBUCKET)
      .download(rij.storage_path)

    // Eén onleesbare foto mag het hele rapport niet tegenhouden — dan
    // krijgt kantoor geen document terwijl er negentien foto's wél
    // zijn. Wat er niet in kan komt niet in de fotorapportage, en dat
    // is zichtbaar aan het aantal.
    if (fotoFout || !bestand) continue

    const bytes = new Uint8Array(await bestand.arrayBuffer())
    fotos.push({
      bron: naarDataUri(bytes, typeUitPad(rij.storage_path)),
      bijschrift: titelPerTaak.get(rij.taak_id) ?? '',
      fase: rij.fase ?? 'na',
    })
  }

  const b = bon as Record<string, string | null>

  return {
    adres: b.adres ?? '',
    postcode: b.postcode,
    plaats: b.plaats,
    opdrachtnummer: b.opdrachtnummer,
    opdrachtgever: project?.opdrachtgever ?? project?.naam ?? null,
    opleverdatum: b.opleverdatum ?? b.opgeleverd_op,
    opgemaaktDoor: null,
    ploeg,
    opmerkingenBewoners: b.opmerkingen_bewoners,
    extraWerkzaamheden: b.extra_werkzaamheden,
    bijzonderheden: b.bijzonderheden,
    punten: puntenlijst.map((t) => ({ titel: t.titel, voltooid: t.voltooid })),
    fotos,
    gemaaktOp: new Date().toISOString(),
  }
}

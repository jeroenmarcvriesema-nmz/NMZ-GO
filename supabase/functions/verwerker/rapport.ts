// ============================================================
// NMZ GO — het opleverrapport bouwen
// ============================================================
// De aanvraagknop stond al live sinds migratie 025: wie erop drukt
// maakt een rij in `rapportages` en een wachtrijtaak
// `rapportage.genereren`. Die taaksoort had geen handler, dus elke
// aanvraag bleef staan tot de pogingen op waren en werd daarna
// onverwerkbaar. Kantoor drukte op een knop die niets opleverde.
//
// Dit is die handler.
//
// ── Waarom de foto's verkleind worden ──
// De foto's in de bucket zijn gemiddeld 1,2 MB en de grootste is bijna
// 8 MB. Drieëntwintig daarvan ongewijzigd in één bestand is ruim 40 MB,
// en als base64 nog een derde meer. Dat is geen document meer maar een
// probleem: het past niet in een mail, het opent traag, en het bouwen
// ervan loopt tegen het geheugen van de edge function aan.
//
// Op papier is een foto in dit rapport ongeveer 60 mm breed. Duizend
// pixels is daar ruim voldoende voor — ook op een scherm waarop iemand
// inzoomt — en levert bestanden van rond de honderd kilobyte. Het hele
// rapport komt daarmee op een paar megabyte.
//
// De originelen blijven staan. Dit verkleint alleen wat in het
// document gaat; het bewijsmateriaal zelf raakt het niet aan.
//
// ── Idempotent ──
// Een rapportage die al 'klaar' is wordt niet opnieuw gebouwd. Loopt
// de taak twee keer — en dat gebeurt, want de wachtrij probeert
// opnieuw — dan is de tweede ronde een no-op. Het bestand gaat wel met
// `upsert` naar Storage, zodat een half geschreven bestand van een
// afgebroken poging netjes wordt overschreven.
// ============================================================

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  bouwRapport,
  datumInWoorden,
  periodeInWoorden,
  type Rapportfoto,
  type Rapportpunt,
} from './rapportsjabloon.ts'

/** Breedte waarop een foto het document in gaat. */
const FOTO_BREEDTE = 1000

/** JPEG-kwaliteit na verkleinen. */
const FOTO_KWALITEIT = 72

const BUCKET_FOTOS = 'werkbon-fotos'
const BUCKET_DOCUMENTEN = 'werkbon-documenten'

function base64(bytes: Uint8Array): string {
  // Per blok, want `String.fromCharCode(...bytes)` in één keer legt de
  // aanroepstapel om bij een bestand van een paar honderd kilobyte.
  let ruw = ''
  const blok = 0x8000
  for (let i = 0; i < bytes.length; i += blok) {
    ruw += String.fromCharCode(...bytes.subarray(i, i + blok))
  }
  return btoa(ruw)
}

/**
 * Zoveel bytes aan foto's gaat er hooguit in één rapport.
 *
 * Een vangnet voor het geval het verkleinen niet beschikbaar is. Zonder
 * grens zou het document tientallen megabytes worden en stukloopt de
 * upload — en dan is er helemaal geen rapport.
 */
const MAX_BEELD_BYTES = 25_000_000

/**
 * De beeldbibliotheek, één keer geladen en daarna onthouden.
 *
 * Bewust een dynamische import binnen een try, en niet bovenaan het
 * bestand. Een import die bovenaan staat en niet laadt, neemt de hele
 * edge function mee — en in deze functie zit ook de ClickUp-
 * synchronisatie, het bijwerken van statussen en het opruimen van
 * foto's. Eén bibliotheek voor het verkleinen van plaatjes hoort dat
 * niet te kunnen. Lukt het laden niet, dan gaan de foto's onverkleind
 * mee en staat dat in de uitkomst van de taak.
 */
let verkleinerGeprobeerd = false
let Beeld: any = null

async function laadVerkleiner(): Promise<any> {
  if (verkleinerGeprobeerd) return Beeld
  verkleinerGeprobeerd = true
  try {
    const mod = await import('https://deno.land/x/imagescript@1.2.17/mod.ts')
    Beeld = (mod as any).Image ?? null
  } catch {
    Beeld = null
  }
  return Beeld
}

/**
 * Eén foto klein genoeg maken om in het document te passen.
 *
 * Lukt het verkleinen niet — geen bibliotheek, een bestand dat geen
 * geldige JPEG is, een formaat dat de decoder niet kent — dan gaat het
 * origineel mee. Een foto stilletjes weglaten uit bewijsmateriaal is de
 * slechtste van de mogelijke uitkomsten; onverkleind meenemen is alleen
 * maar groot, en dát is te zien aan de uitkomst van de taak.
 */
async function verklein(
  bytes: Uint8Array,
): Promise<{ data: string; bytes: number; verkleind: boolean }> {
  const Img = await laadVerkleiner()
  if (Img) {
    try {
      const beeld = await Img.decode(bytes)
      if (beeld.width > FOTO_BREEDTE) {
        beeld.resize(FOTO_BREEDTE, Img.RESIZE_AUTO)
      }
      const klein: Uint8Array = await beeld.encodeJPEG(FOTO_KWALITEIT)
      return {
        data: `data:image/jpeg;base64,${base64(klein)}`,
        bytes: klein.length,
        verkleind: true,
      }
    } catch {
      // Valt door naar het origineel hieronder.
    }
  }
  return {
    data: `data:image/jpeg;base64,${base64(bytes)}`,
    bytes: bytes.length,
    verkleind: false,
  }
}

export interface Rapportuitkomst {
  rapportage_id: string
  werkbon_id: string
  bestandspad?: string
  punten?: number
  fotos?: number
  overgeslagen?: number
  /** Foto's die onverkleind meegingen — bibliotheek niet beschikbaar. */
  onverkleind?: number
  bytes?: number
  overgeslagen_al_klaar?: boolean
}

/**
 * Het opleverrapport van één werkbon bouwen en wegschrijven.
 *
 * `db` is de service-client van de verwerker: die komt bij de bucket en
 * bij alle rijen. De twee regels over wie een rapport mág aanvragen
 * zijn op dat moment al gesteld door `rapportage_aanvragen()` — hier
 * wordt alleen nog uitgevoerd wat daar is goedgekeurd.
 */
export async function bouwOpleverrapport(
  db: SupabaseClient,
  tenantId: string,
  werkbonId: string,
  rapportageId: string,
): Promise<Rapportuitkomst> {
  // ── De aanvraag ──
  const { data: aanvraag, error: aanvraagFout } = await db
    .from('rapportages')
    .select('id, status, bestandspad')
    .eq('id', rapportageId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (aanvraagFout) throw new Error(`aanvraag lezen mislukt: ${aanvraagFout.message}`)
  if (!aanvraag) throw new OnverwerkbaarRapport(`rapportage ${rapportageId} bestaat niet meer`)

  if (aanvraag.status === 'klaar' && aanvraag.bestandspad) {
    return {
      rapportage_id: rapportageId,
      werkbon_id: werkbonId,
      bestandspad: aanvraag.bestandspad,
      overgeslagen_al_klaar: true,
    }
  }

  // ── De klus ──
  const { data: bon, error: bonFout } = await db
    .from('werkbonnen')
    .select(`
      id, bonnummer, projectnaam, adres, postcode, plaats, opdrachtgever,
      opdrachtnummer, inspecteur, datum, geplande_start, geplande_eind,
      opleverdatum, opgeleverd_op, opgeleverd_door,
      opmerkingen_bewoners, extra_werkzaamheden, bijzonderheden,
      taken ( id, titel, voltooid, volgorde ),
      werkbon_medewerkers ( persoon:personen ( naam ) )
    `)
    .eq('id', werkbonId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (bonFout) throw new Error(`werkbon lezen mislukt: ${bonFout.message}`)
  if (!bon) throw new OnverwerkbaarRapport(`werkbon ${werkbonId} bestaat niet meer`)

  const { data: tenant } = await db
    .from('tenants').select('naam').eq('id', tenantId).maybeSingle()

  let opgeleverdDoor: string | null = null
  if (bon.opgeleverd_door) {
    const { data: p } = await db
      .from('profiles').select('naam').eq('id', bon.opgeleverd_door).maybeSingle()
    opgeleverdDoor = p?.naam ?? null
  }

  // ── De foto's ──
  const { data: fotos, error: fotoFout } = await db
    .from('fotos')
    .select('id, storage_path, taak_id, fase, created_at')
    .eq('werkbon_id', werkbonId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (fotoFout) throw new Error(`foto's lezen mislukt: ${fotoFout.message}`)

  // Eén voor één ophalen en verkleinen. Alles tegelijk zou sneller
  // zijn en legt het geheugen van de edge function om: een foto van
  // 8 MB is uitgepakt tientallen megabytes, en dat maal drieëntwintig
  // past nergens in.
  const beeldPerFoto = new Map<string, Rapportfoto>()
  let overgeslagen = 0
  let onverkleind = 0
  let beeldBytes = 0

  for (const f of fotos ?? []) {
    const { data: blob, error } = await db.storage.from(BUCKET_FOTOS).download(f.storage_path)
    if (error || !blob) {
      overgeslagen++
      continue
    }

    const beeld = await verklein(new Uint8Array(await blob.arrayBuffer()))
    if (!beeld.verkleind) onverkleind++

    // Boven de grens stoppen we met inladen in plaats van door te gaan
    // tot de upload klapt. Een rapport met tweeëntwintig van de
    // drieëntwintig foto's is bruikbaar; geen rapport is dat niet. Het
    // aantal staat in de uitkomst, dus het is geen stille afloop.
    if (beeldBytes + beeld.bytes > MAX_BEELD_BYTES) {
      overgeslagen++
      continue
    }

    beeldBytes += beeld.bytes
    beeldPerFoto.set(f.id, { bron: beeld.data, fase: f.fase })
  }

  // ── Alles op zijn plaats ──
  const punten: Rapportpunt[] = [...(bon.taken ?? [])]
    .sort((a: any, z: any) => (a.volgorde ?? 0) - (z.volgorde ?? 0))
    .map((t: any) => ({
      titel: String(t.titel ?? ''),
      voltooid: Boolean(t.voltooid),
      fotos: (fotos ?? [])
        .filter((f: any) => f.taak_id === t.id)
        .map((f: any) => beeldPerFoto.get(f.id))
        .filter(Boolean) as Rapportfoto[],
    }))

  const losseFotos = (fotos ?? [])
    .filter((f: any) => !f.taak_id)
    .map((f: any) => beeldPerFoto.get(f.id))
    .filter(Boolean) as Rapportfoto[]

  const html = bouwRapport({
    bonnummer: bon.bonnummer ?? null,
    projectnaam: bon.projectnaam ?? null,
    adres: bon.adres ?? null,
    postcode: bon.postcode ?? null,
    plaats: bon.plaats ?? null,
    opdrachtgever: bon.opdrachtgever ?? null,
    opdrachtnummer: bon.opdrachtnummer ?? null,
    inspecteur: bon.inspecteur ?? null,
    aannemer: tenant?.naam ?? 'NMZ',
    opgeleverdOp: datumInWoorden(bon.opleverdatum ?? bon.opgeleverd_op),
    opgeleverdDoor,
    uitvoering: periodeInWoorden(
      bon.geplande_start ?? bon.datum,
      bon.geplande_eind ?? bon.geplande_start ?? bon.datum,
    ),
    ploeg: (bon.werkbon_medewerkers ?? [])
      .map((wm: any) => wm.persoon?.naam)
      .filter(Boolean),
    opmerkingenBewoners: bon.opmerkingen_bewoners ?? null,
    extraWerkzaamheden: bon.extra_werkzaamheden ?? null,
    bijzonderheden: bon.bijzonderheden ?? null,
    punten,
    losseFotos,
  })

  // ── Wegschrijven ──
  // Een vast pad per rapportage: opnieuw draaien overschrijft het
  // vorige bestand in plaats van er een tweede naast te zetten.
  const pad = `${tenantId}/${werkbonId}/opleverrapport-${bon.bonnummer ?? werkbonId}.html`
  const bestand = new TextEncoder().encode(html)

  const { error: uploadFout } = await db.storage
    .from(BUCKET_DOCUMENTEN)
    .upload(pad, bestand, { contentType: 'text/html; charset=utf-8', upsert: true })

  if (uploadFout) throw new Error(`rapport opslaan mislukt: ${uploadFout.message}`)

  const { error: bijwerkFout } = await db
    .from('rapportages')
    .update({
      status: 'klaar',
      bestandspad: pad,
      fout: null,
      gegenereerd_op: new Date().toISOString(),
    })
    .eq('id', rapportageId)

  if (bijwerkFout) throw new Error(`rapportage bijwerken mislukt: ${bijwerkFout.message}`)

  return {
    rapportage_id: rapportageId,
    werkbon_id: werkbonId,
    bestandspad: pad,
    punten: punten.length,
    fotos: beeldPerFoto.size,
    overgeslagen,
    onverkleind,
    bytes: bestand.length,
  }
}

/**
 * Een fout die niet opnieuw geprobeerd hoeft te worden.
 *
 * De verwerker herkent hem aan de naam en niet aan de klasse: `index.ts`
 * heeft zijn eigen `OnverwerkbaarError`, en twee klassen met dezelfde
 * bedoeling die elkaar niet herkennen is precies hoe een blijvende fout
 * alsnog vijf keer opnieuw wordt geprobeerd.
 */
export class OnverwerkbaarRapport extends Error {
  constructor(bericht: string) {
    super(bericht)
    this.name = 'OnverwerkbaarError'
  }
}

/**
 * De aanvraag op mislukt zetten met de reden erbij.
 *
 * Zonder dit blijft een rapportage op 'wachtend' staan terwijl de taak
 * allang is opgegeven, en dan wacht kantoor op iets dat nooit komt.
 */
export async function meldRapportMislukt(
  db: SupabaseClient,
  rapportageId: string,
  reden: string,
): Promise<void> {
  await db
    .from('rapportages')
    .update({ status: 'mislukt', fout: reden.slice(0, 500) })
    .eq('id', rapportageId)
}

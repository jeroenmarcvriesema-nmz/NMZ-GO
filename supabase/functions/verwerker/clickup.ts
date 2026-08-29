// ============================================================
// NMZ GO — ClickUp-synchronisatie
// ============================================================
// Haalt de taken op die klaarstaan voor uitvoering en maakt er
// werkbonnen van. ClickUp blijft de bron van waarheid voor de planning;
// NMZ GO is de uitvoeringskant — en wat daar wordt gewijzigd gaat terug
// (zie `werkbonBijwerken`).
//
// Drie regels die deze handler aanhoudt:
//
//   1. Idempotent. Eén ClickUp-taak wordt één werkbon, afgedwongen
//      met een unieke sleutel. Een tweede ronde werkt bij in plaats
//      van te verdubbelen.
//
//   2. Nooit stil overslaan. Een naam die niet in het personenregister
//      staat, een opdracht zonder leesbare punten, een ontbrekende PDF
//      — het komt allemaal terug in het resultaat. Stil overslaan
//      betekent maandagochtend iemand zonder werkbon.
//
//      Let op het onderscheid: een persoon zónder account is normaal en
//      geen bevinding — de bon wijst gewoon naar hem en hij ziet alles
//      zodra hij is uitgenodigd. Een naam die hélemaal niet bestaat is
//      dat wel.
//
//   3. Staat de synchronisatie op niet-actief, dan draait hij droog:
//      hij rapporteert wat hij zou doen en schrijft niets weg. Dat is
//      geen testgemak maar de afspraak dat er niets naar productie
//      gaat voordat de terugkoppeling naar ClickUp werkt.
// ============================================================

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { leesPdf, ontleed } from './werkopdracht.ts'
import { standUitStatus, statusUitReden, type Statussen } from './statusregels.ts'
import { datumInWerkzone } from './datums.ts'
import { veldOpties, werkRegisterBij } from './register.ts'

export { statusUitReden }
export type { Statussen }

const API = 'https://api.clickup.com/api/v2'

interface Instellingen {
  tenant_id: string
  lijst_ids: string[]
  trigger_status: string
  trigger_statussen: string[] | null
  veld_medewerkers: string | null
  veld_startdatum: string | null
  veld_opleverdatum: string | null
  veld_uitloopdatum: string | null
  veld_opdrachtnummer: string | null
  veld_kluiscode: string | null
  veld_werkopdracht: string | null
  veld_werktekening: string | null
  medewerker_labels: string[]
  uitgesloten_punten: string[]
  actief: boolean
  /**
   * Tot waar de standenronde de statussen heeft nagelopen. Leeg bij de
   * eerste ronde: dan kijkt hij één keer naar alles, daarna alleen nog
   * naar wat sindsdien in ClickUp is aangeraakt.
   */
  standen_gesynct_tot: string | null
}

interface Bevinding {
  taak: string
  adres: string
  reden: string
}

async function haal(pad: string, token: string): Promise<any> {
  const res = await fetch(`${API}${pad}`, { headers: { Authorization: token } })
  if (res.status === 401) {
    throw new Error(
      'ClickUp weigert het token (401). Waarschijnlijk is het opnieuw gegenereerd; ' +
      'werk clickup_token bij in Vault met vault.update_secret().',
    )
  }
  if (!res.ok) throw new Error(`ClickUp gaf ${res.status} op ${pad}`)
  return res.json()
}

/**
 * Alle taken van één lijst, over alle pagina's heen.
 *
 * ClickUp geeft er honderd per keer terug en zet `last_page` op false
 * zolang er meer zijn. Dat werd niet gelezen: de synchronisatie haalde
 * pagina 0 op en stopte. Zolang er minder dan honderd taken op de
 * triggerstatussen staan valt dat niet op — en op de dag dat het er
 * meer worden, verdwijnt de rest zonder melding. Niet overgeslagen mét
 * reden, maar nooit gezien.
 *
 * De bovengrens is een noodrem tegen een eindeloze lus als ClickUp
 * `last_page` niet meestuurt. Wordt hij geraakt, dan zeggen we dat —
 * stil afkappen is precies de fout die dit repareert.
 *
 * `gesloten` bepaalt of taken op een status van het type *closed*
 * mee terugkomen. Standaard niet: de synchronisatie zoekt nieuwe
 * klussen en die staan nooit op "opgeleverd". De standenronde zoekt
 * juist wél naar afgeronde klussen en zet hem aan. Dit stond hier als
 * `include_closed=false` hardgecodeerd in de URL, en dat is precies
 * waarom "voeg opgeleverd toe aan de statuslijst" in zijn eentje
 * niets zou opleveren: de filter verderop in de keten gooit ze er
 * alsnog uit, zonder melding.
 */
async function haalTaken(
  lijst: string,
  vraag: string,
  token: string,
  gesloten = false,
): Promise<{ taken: any[]; afgekapt: boolean }> {
  const MAX_PAGINAS = 50
  const taken: any[] = []

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const res = await haal(
      `/list/${lijst}/task?${vraag}&subtasks=false&include_closed=${gesloten}&page=${pagina}`,
      token,
    )
    const brok = res.tasks ?? []
    taken.push(...brok)
    if (res.last_page === true || brok.length === 0) return { taken, afgekapt: false }
  }

  return { taken, afgekapt: true }
}

/** Waarde van een custom field, of null als hij leeg is. */
function veld(taak: any, id: string | null): any {
  if (!id) return null
  const v = taak.custom_fields?.find((f: any) => f.id === id)
  return v?.value ?? null
}

// Zie datums.ts: afkappen in UTC leverde systematisch een dag te vroeg
// op, want ClickUp bewaart een datumveld op middernacht Amsterdamse
// tijd — 22:00 UTC de dag ervóór.
const datum = datumInWerkzone

/** Labels zijn option-id's; die vertalen we terug naar namen. */
function labelNamen(taak: any, id: string | null): string[] {
  if (!id) return []
  const f = taak.custom_fields?.find((x: any) => x.id === id)
  if (!f?.value) return []
  const opties = f.type_config?.options ?? []
  return (f.value as string[])
    .map((oid) => opties.find((o: any) => o.id === oid)?.label)
    .filter(Boolean) as string[]
}

/**
 * Eén bestand uit een bijlageveld.
 *
 * Een bijlageveld in ClickUp neemt méér dan één bestand aan, en de
 * werkvoorbereider hangt de tekening geregeld in hetzelfde veld als de
 * opdracht. Hier stond `v[0]`: blind de eerste. Bij Amsteldijk 157 HS
 * stonden ze in de volgorde tekening, opdracht — en dus werd de
 * tekening als werkopdracht ontleed, met "de kop ontbreekt" als
 * uitkomst. Een klus zonder werkbon door een volgorde die niemand
 * bewust heeft gekozen.
 *
 * Past er een naam bij `voorkeur`, dan die. Anders blijft het de
 * eerste — dat is wat het altijd deed en voor één bestand is het
 * hetzelfde.
 */
function uitVeld(v: any, voorkeur?: RegExp): Bijlage | null {
  if (!Array.isArray(v) || v.length === 0) return null
  const gekozen = voorkeur
    ? v.find((x: any) => x?.url && voorkeur.test(String(x?.title ?? '')))
    : null
  const a = gekozen ?? v[0]
  return a?.url
    ? { url: a.url, naam: a.title ?? 'document.pdf', datum: msNaarIso(a.date) }
    : null
}

/**
 * Eén bijlage, met de datum die ClickUp eraan geeft.
 *
 * Die datum is het enige waaraan te zien is dát er een herziene
 * opdracht hangt zonder hem te downloaden — en downloaden is precies
 * wat we bij elke ronde niet willen.
 */
interface Bijlage {
  url: string
  naam: string
  datum: string | null
}

function msNaarIso(ms: unknown): string | null {
  if (!ms) return null
  const n = Number(ms)
  return Number.isFinite(n) ? new Date(n).toISOString() : null
}

/**
 * Zoekt een bijlage: eerst in het ingestelde veld, en als dat leeg is
 * in elk ander bijlageveld waarvan de naam past.
 *
 * ClickUp heeft in de loop van de tijd meerdere velden voor hetzelfde
 * document gekregen — "Werktekening" én "Werktekening (PDF)". Welke de
 * werkvoorbereider gebruikt, wisselt. Dat is zijn keuze en hoort geen
 * reden te zijn dat een zwamsaneerder zijn tekening mist, dus kijken we
 * in allebei.
 */
function bijlage(
  taak: any,
  id: string | null,
  patroon: RegExp,
  voorkeur?: RegExp,
): Bijlage | null {
  const uitInstelling = uitVeld(veld(taak, id), voorkeur)
  if (uitInstelling) return uitInstelling

  for (const f of taak.custom_fields ?? []) {
    if (f.type !== 'attachment') continue
    if (!patroon.test(String(f.name ?? ''))) continue
    const gevonden = uitVeld(f.value, voorkeur)
    if (gevonden) return gevonden
  }
  return null
}

const OPDRACHT_VELD = /werkopdracht/i
const TEKENING_VELD = /tekening/i

// Zo heten de bestánden. De opdracht komt uit de export van de
// inspecteur ("Opdracht_7178 Amsteldijk 157 HS te Amsterdam.pdf"); de
// tekening krijgt "TEK" of "tekening" in de naam. Nodig zodra er meer
// dan één bestand in hetzelfde veld hangt.
const OPDRACHT_BESTAND = /opdracht/i
const TEKENING_BESTAND = /tekening|(^|[^a-z])tek([^a-z]|$)/i

/**
 * De werkopdracht als losse bijlage aan de ClickUp-taak.
 *
 * Bedoeld is dat de PDF in het veld "Werkopdracht (PDF)" staat. In de
 * praktijk sleept de werkvoorbereider hem net zo vaak in de taak zelf —
 * dat is één handeling in plaats van drie, en aan de ClickUp-kant ziet
 * het er hetzelfde uit. Dahliastraat 6 te Rijnsburg stond zo: veld
 * leeg, PDF present, en de bon kwam er niet. "Geen werkopdracht-PDF op
 * de taak" was letterlijk waar en toch het verkeerde antwoord.
 *
 * We raden niet. Alleen een PDF waarvan de naam op een opdracht wijst
 * telt mee, en een tekening wordt uitgesloten. Is er niets dat past,
 * dan blijft het een overslag met reden — dat is beter dan een
 * willekeurige bijlage als werkopdracht ontleden.
 *
 * De lijst-ingang van ClickUp geeft geen bijlagen mee, dus voor een
 * taak die anders zou afvallen halen we hem los op. Dat kost één
 * aanroep voor precies de taken die nu stilvallen.
 */
async function opdrachtUitBijlagen(
  taak: any,
  token: string,
): Promise<Bijlage | null> {
  let bijlagen = taak.attachments
  if (!Array.isArray(bijlagen)) {
    const volledig = await haal(`/task/${encodeURIComponent(taak.id)}`, token)
    bijlagen = volledig?.attachments ?? []
  }

  const passend = (bijlagen as any[])
    .filter((b) => {
      const naam = String(b?.title ?? '')
      const isPdf = String(b?.extension ?? '').toLowerCase() === 'pdf' ||
                    String(b?.mimetype ?? '').toLowerCase() === 'application/pdf'
      return b?.url && isPdf && OPDRACHT_BESTAND.test(naam) && !TEKENING_BESTAND.test(naam)
    })
    // De nieuwste wint: een tweede upload is een herziening, geen kopie
    // die genegeerd mag worden.
    .sort((a, b) => Number(b.date ?? 0) - Number(a.date ?? 0))

  const gekozen = passend[0]
  return gekozen
    ? {
      url: gekozen.url,
      naam: gekozen.title ?? 'werkopdracht.pdf',
      datum: msNaarIso(gekozen.date),
    }
    : null
}

/**
 * Hangt er een nieuwere werkopdracht dan die we hebben ontleed?
 *
 * De ronde slaat een bon met een opdracht_pad over — anders wordt bij
 * elke ronde vijfenveertig keer een PDF gedownload. Gevolg was dat een
 * herziene opdracht nooit meer binnenkwam: ging de container daarin van
 * 6 naar 10 kuub, dan bleef in NMZ GO 6 staan, en op die 6 wordt
 * besteld.
 *
 * De datum van de bijlage staat in het antwoord dat we tóch al
 * ophalen, dus die vergelijking kost niets. Alleen als de opdracht los
 * aan de taak hangt — dat komt voor — zit hij niet in het lijstantwoord,
 * en dan halen we de taak apart op. Dat gebeurt als ClickUp zegt dat er
 * sinds onze laatste ronde íéts aan de taak is veranderd, of als deze
 * bon nog geen ijkpunt heeft; zodra hij dat wél heeft kost een rustige
 * dag geen enkele aanroep.
 *
 * Drie uitkomsten:
 *
 * - `nieuwer` — er hangt een herziening; die moet opnieuw gelezen.
 * - `ijken`   — we kennen de datum van deze bon nog niet. Dat geldt voor
 *               alles van vóór migratie 034, en dat waren op het moment
 *               van uitrollen alle vijfenveertig bonnen. Zonder ijkpunt
 *               is er niets om "nieuwer" tegen af te meten, en dan zou
 *               een herziening nooit gezien worden — de hele reden dat
 *               dit er is. We zetten de datum die er nú hangt weg zónder
 *               de PDF opnieuw te halen: wat we hebben ontleed hoort
 *               immers bij die bijlage. Kost niets, en vanaf de ronde
 *               erna telt een herziening wél mee.
 * - `geen`    — er is niets veranderd.
 */
type Opdrachtstand =
  | { soort: 'geen' }
  | { soort: 'ijken'; datum: string }
  | { soort: 'nieuwer'; opdracht: Bijlage }

async function nieuwereOpdracht(
  taak: any,
  token: string,
  bon: { opdracht_datum: string | null; laatst_gesynct: string | null },
  veldId: string | null,
): Promise<Opdrachtstand> {
  let huidig = bijlage(taak, veldId, OPDRACHT_VELD, OPDRACHT_BESTAND)

  if (!huidig) {
    const gewijzigd = msNaarIso(taak.date_updated)
    const verse = !!gewijzigd && !!bon.laatst_gesynct && gewijzigd > bon.laatst_gesynct

    // Heeft deze bon nog helemaal geen ijkpunt, dan kijken we één keer
    // ook zonder dat ClickUp iets meldt. Anders krijgt een bon waarvan
    // de opdracht los aan de taak hangt nooit een datum — `laatst_gesynct`
    // wordt immers elke ronde op nu gezet, dus `date_updated` komt daar
    // nooit meer overheen — en blijft een herziening daar voor altijd
    // onzichtbaar. Na die ene keer is hij geijkt en geldt de gewone
    // regel weer.
    if (!verse && bon.opdracht_datum) return { soort: 'geen' }

    huidig = await opdrachtUitBijlagen(taak, token)
  }

  if (!huidig?.datum) return { soort: 'geen' }

  // Als tijdstip vergelijken, niet als tekst. Postgres geeft een
  // timestamptz terug als "2026-04-24T11:34:29.251+00:00" en ClickUp
  // levert "2026-04-24T11:34:29.251Z" — hetzelfde moment, andere
  // tekst. Alfabetisch staat "Z" ná "+", dus `nieuwer > bekend` was
  // altijd waar en gold élke opdracht als herzien. De eerste ronde na
  // het uitrollen laadde daardoor zesentwintig PDF's opnieuw, en de
  // ronde daarna weer, precies het gedrag dat dit stuk moest
  // voorkomen.
  const nu = Date.parse(huidig.datum)
  const bekend = bon.opdracht_datum ? Date.parse(bon.opdracht_datum) : NaN

  if (!Number.isFinite(bekend)) return { soort: 'ijken', datum: huidig.datum }
  if (!Number.isFinite(nu)) return { soort: 'geen' }

  return nu > bekend ? { soort: 'nieuwer', opdracht: huidig } : { soort: 'geen' }
}

/**
 * Een herziene opdracht opnieuw ontleden.
 *
 * Wat wél wordt bijgewerkt: de kop van de opdracht. Daar staan de
 * container, de dixi, de kluiscode en de inspecteur in — de dingen
 * waarop besteld en gebeld wordt, en precies waarvoor een herziening
 * wordt rondgestuurd.
 *
 * Wat níét wordt bijgewerkt: de punten. Daar hangt het afvinkwerk aan,
 * met foto's en al. Ze opnieuw invoeren zou dat wissen, en ze proberen
 * samen te voegen betekent raden welke regel "dezelfde" is als eentje
 * die net iets anders is opgeschreven. Staat er in de herziening ander
 * werk, dan hoort een mens daarnaar te kijken — daarom komt de
 * herziening ook als bevinding terug in het resultaat van de ronde.
 */
async function herlees(
  db: SupabaseClient,
  bonId: string,
  opdracht: Bijlage,
  i: Instellingen,
): Promise<TaakUitkomst> {
  const res = await fetch(opdracht.url)
  if (!res.ok) {
    return { soort: 'overgeslagen', reden: `herziene werkopdracht niet op te halen (${res.status})` }
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  const w = ontleed(await leesPdf(bytes), i.uitgesloten_punten)

  await db.from('werkbonnen')
    .update({
      werkvoorbereiding: w.werkvoorbereiding,
      kluiscode: w.kluiscode,
      inspecteur: w.inspecteur,
      inspecteur_telefoon: w.inspecteurTelefoon,
      opdracht_datum: opdracht.datum,
      laatst_gesynct: new Date().toISOString(),
    })
    .eq('id', bonId)

  // Ook het bestand zelf, anders staat op de bon nog de oude PDF terwijl
  // de gegevens uit de nieuwe komen.
  await bewaarDocument(db, bonId, bytes, 'werkopdracht.pdf', 'opdracht_pad')

  return {
    soort: 'overgeslagen',
    reden: `herziene werkopdracht ingelezen (${opdracht.naam}) — container, dixi en kluiscode ` +
           'zijn bijgewerkt; de punten zijn ongemoeid gelaten, kijk na of er werk bij is gekomen',
  }
}

/**
 * Zet de ploeg op een werkbon zoals ClickUp hem kent.
 *
 * Eerst weg, dan opnieuw — ClickUp is leidend. Maar alleen over zijn
 * eigen toewijzingen: wie hier handmatig iemand aan een klus hangt,
 * doet dat omdat er iets is gebeurd wat ClickUp nog niet weet. Die
 * keuze wegvegen bij de volgende ronde is stil en onvindbaar.
 */
async function zetPloeg(
  db: SupabaseClient,
  tenantId: string,
  bonId: string,
  ploeg: { id: string }[],
): Promise<void> {
  await db.from('werkbon_medewerkers')
    .delete()
    .eq('werkbon_id', bonId)
    .eq('handmatig', false)

  if (ploeg.length === 0) return

  // upsert en niet insert: een handmatige toewijzing van iemand die
  // inmiddels óók in ClickUp staat, botst anders op de primaire sleutel
  // en laat de hele bon mislukken.
  await db.from('werkbon_medewerkers').upsert(
    ploeg.map((p) => ({
      tenant_id: tenantId, werkbon_id: bonId, persoon_id: p.id, handmatig: false,
    })),
    { onConflict: 'werkbon_id,persoon_id', ignoreDuplicates: true },
  )
}

/** Wie er op een taak staat, en of die naam bij ons bekend is. */
interface Ploeglid { id: string; naam: string; heeftAccount: boolean }

/** Alles wat het verwerken van één taak nodig heeft, één keer opgehaald. */
interface Werkcontext {
  i: Instellingen
  token: string
  perLabel: Map<string, Ploeglid>
  droogloop: boolean
  /** Namen uit ClickUp die niet in het personenregister staan. */
  ongekoppeldeNamen: Set<string>
}

type TaakUitkomst =
  | { soort: 'nieuw' | 'bijgewerkt' | 'ongewijzigd' }
  | { soort: 'proef'; proef: Record<string, unknown> }
  | { soort: 'overgeslagen'; reden: string }

/**
 * Eén ClickUp-taak naar een werkbon.
 *
 * Stond eerst als lus-inhoud in `synchroniseer`. Losgetrokken toen
 * kantoor één taak met de hand moest kunnen binnenhalen: die weg hoort
 * exact dezelfde te zijn als de automatische ronde. Twee keer dezelfde
 * honderdtwintig regels betekent dat ze een keer uit elkaar gaan lopen,
 * en dan werkt de ene bon wel en de andere niet zonder dat iemand weet
 * waarom.
 */
async function verwerkTaak(
  db: SupabaseClient,
  tenantId: string,
  taak: any,
  ctx: Werkcontext,
): Promise<TaakUitkomst> {
  const { i, perLabel, droogloop } = ctx
  const adres = taak.name ?? '(zonder naam)'

  const namenVooraf = labelNamen(taak, i.veld_medewerkers)
  const ploegVooraf = namenVooraf
    .map((n) => perLabel.get(n))
    .filter(Boolean) as Ploeglid[]
  for (const n of namenVooraf) if (!perLabel.has(n)) ctx.ongekoppeldeNamen.add(n)

  // Bestaat de bon al en heeft hij zijn documenten, dan is hij klaar.
  // Een werkbon verandert niet meer nadat hij er eenmaal in staat —
  // meerwerk wordt een aparte ClickUp-taak en dus een aparte bon.
  // Opnieuw de PDF ophalen, ontleden en wegschrijven levert precies
  // hetzelfde op en kost bij tweeëntwintig klussen tweeëntwintig
  // downloads per ronde. Dat was de reden dat de hartslag op een half
  // uur stond.
  //
  // Wat wél verandert is wie er op staat: iemand valt uit, er wordt
  // iemand bijgezet. Dat is één veld uit de taak die we toch al binnen
  // hebben, dus dat werken we altijd bij.
  if (!droogloop) {
    const { data: alKlaar } = await db
      .from('werkbonnen')
      .select('id, opdracht_pad, opdracht_datum, laatst_gesynct')
      .eq('tenant_id', tenantId)
      .eq('clickup_taak_id', taak.id)
      .maybeSingle()

    if (alKlaar?.opdracht_pad) {
      await zetPloeg(db, tenantId, alKlaar.id, ploegVooraf)
      await db.from('werkbonnen')
        .update({
          clickup_status: taak.status?.status ?? null,
          laatst_gesynct: new Date().toISOString(),
        })
        .eq('id', alKlaar.id)

      // Hangt er een nieuwere opdracht? Dan lezen we de kop opnieuw.
      // Zie `herlees` hieronder voor wat er dan wél en niet bijwerkt.
      const stand = await nieuwereOpdracht(taak, ctx.token, alKlaar, i.veld_werkopdracht)

      if (stand.soort === 'ijken') {
        await db.from('werkbonnen')
          .update({ opdracht_datum: stand.datum })
          .eq('id', alKlaar.id)
        return { soort: 'ongewijzigd' }
      }

      if (stand.soort === 'geen') return { soort: 'ongewijzigd' }

      return await herlees(db, alKlaar.id, stand.opdracht, i)
    }
  }

  // Eerst het veld, dan de losse bijlagen van de taak. Zie
  // `opdrachtUitBijlagen`: allebei komen in de praktijk voor.
  const opdracht = bijlage(taak, i.veld_werkopdracht, OPDRACHT_VELD, OPDRACHT_BESTAND) ??
                   await opdrachtUitBijlagen(taak, ctx.token)
  if (!opdracht) {
    return {
      soort: 'overgeslagen',
      reden: 'geen werkopdracht-PDF: het veld "Werkopdracht (PDF)" is leeg en er hangt ' +
             'geen PDF met "opdracht" in de naam aan de taak',
    }
  }

  const pdfRes = await fetch(opdracht.url)
  if (!pdfRes.ok) {
    return { soort: 'overgeslagen', reden: `werkopdracht niet op te halen (${pdfRes.status})` }
  }

  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer())
  const tekst = await leesPdf(pdfBytes)
  const w = ontleed(tekst, i.uitgesloten_punten)

  const bon = {
    tenant_id: tenantId,
    clickup_taak_id: taak.id,
    clickup_status: taak.status?.status ?? null,
    bonnummer: veld(taak, i.veld_opdrachtnummer) ?? w.opdrachtnummer ?? taak.id,
    projectnaam: 'Zwamsanering',
    adres,
    datum: datum(taak.start_date) ?? datum(veld(taak, i.veld_startdatum)) ??
           new Date().toISOString().split('T')[0],
    geplande_start: datum(veld(taak, i.veld_startdatum)) ?? datum(taak.start_date),
    geplande_eind: datum(veld(taak, i.veld_opleverdatum)) ?? datum(taak.due_date),
    uitloopdatum: datum(veld(taak, i.veld_uitloopdatum)),
    kluiscode: veld(taak, i.veld_kluiscode) ?? w.kluiscode,
    inspecteur: w.inspecteur,
    inspecteur_telefoon: w.inspecteurTelefoon,
    werkvoorbereiding: w.werkvoorbereiding,
    // Nodig om later te zien dát er een herziening hangt, zonder de PDF
    // elke ronde opnieuw te downloaden.
    opdracht_datum: opdracht.datum,
    laatst_gesynct: new Date().toISOString(),
  }

  // Bij een droogloop rapporteren we wat er zóu ontstaan. Zonder dat is
  // "25 gezien, 25 goed" een getal zonder betekenis — je wilt zien dát
  // de punten kloppen voordat je hem aanzet.
  if (droogloop) {
    return {
      soort: 'proef',
      proef: {
        adres,
        bonnummer: bon.bonnummer,
        punten: w.punten.length,
        weggelaten: w.weggelaten.length,
        eerste_punt: w.punten[0]?.slice(0, 80) ?? null,
        medewerkers: ploegVooraf.map((g) => g.naam + (g.heeftAccount ? '' : ' (nog geen account)')),
        geplande_start: bon.geplande_start,
        geplande_eind: bon.geplande_eind,
        kluiscode: bon.kluiscode,
        tekening: bijlage(taak, i.veld_werktekening, TEKENING_VELD, TEKENING_BESTAND) ? 'ja' : 'NEE',
      },
    }
  }

  const { data: bestaand } = await db
    .from('werkbonnen')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('clickup_taak_id', taak.id)
    .maybeSingle()

  let bonId: string
  let uitkomst: TaakUitkomst
  if (bestaand) {
    const { error } = await db.from('werkbonnen').update(bon).eq('id', bestaand.id)
    if (error) throw new Error(`werkbon bijwerken mislukt: ${error.message}`)
    bonId = bestaand.id
    uitkomst = { soort: 'bijgewerkt' }
  } else {
    const { data, error } = await db.from('werkbonnen').insert(bon).select('id').single()
    if (error) throw new Error(`werkbon aanmaken mislukt: ${error.message}`)
    bonId = data.id
    uitkomst = { soort: 'nieuw' }
  }

  // Punten alleen bij een nieuwe bon. Bij een bestaande zou opnieuw
  // invoegen het afvinkwerk van een zwamsaneerder wissen.
  const { count } = await db
    .from('taken')
    .select('id', { count: 'exact', head: true })
    .eq('werkbon_id', bonId)

  if ((count ?? 0) === 0) {
    const rijen = w.punten.map((titel, n) => ({
      tenant_id: tenantId,
      werkbon_id: bonId,
      titel,
      volgorde: n,
    }))
    const { error } = await db.from('taken').insert(rijen)
    if (error) throw new Error(`punten aanmaken mislukt: ${error.message}`)
  }

  await zetPloeg(db, tenantId, bonId, ploegVooraf)

  // Documenten kopiëren. De URL's van ClickUp zijn kortlevend, dus een
  // link opslaan heeft geen zin.
  await bewaarDocument(db, bonId, pdfBytes, 'werkopdracht.pdf', 'opdracht_pad')
  const tekening = bijlage(taak, i.veld_werktekening, TEKENING_VELD, TEKENING_BESTAND)
  if (tekening) {
    const t = await fetch(tekening.url)
    if (t.ok) {
      await bewaarDocument(db, bonId, new Uint8Array(await t.arrayBuffer()),
                           'werktekening.pdf', 'tekening_pad')
    }
  }

  return uitkomst
}

/**
 * Het ClickUp-token uit Vault.
 *
 * Het staat daar net als de service-role-sleutel. De RPC is de enige
 * doorgang en is alleen voor service_role — een browser of ingelogde
 * gebruiker komt er niet bij.
 */
async function geefToken(db: SupabaseClient): Promise<string> {
  const { data: token, error } = await db.rpc('geef_clickup_token')
  if (error) throw new Error(`ClickUp-token lezen mislukt: ${error.message}`)
  if (!token) {
    throw new Error(
      'Er staat geen clickup_token in Vault. Zet hem met ' +
      "select vault.create_secret('<token>', 'clickup_token');",
    )
  }
  return token as string
}

/** De ClickUp-instellingen van een tenant, of een fout als ze ontbreken. */
async function geefInstellingen(
  db: SupabaseClient,
  tenantId: string,
): Promise<Instellingen & Statussen> {
  const { data, error } = await db
    .from('clickup_instellingen')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw new Error(`instellingen lezen mislukt: ${error.message}`)
  if (!data) throw new Error(`geen ClickUp-instellingen voor tenant ${tenantId}`)
  return data as Instellingen & Statussen
}

/**
 * Alles ophalen wat het verwerken van taken nodig heeft: instellingen,
 * het token uit Vault en de koppeling ClickUp-naam → persoon.
 */
async function maakContext(db: SupabaseClient, tenantId: string): Promise<Werkcontext> {
  const { data: inst, error: instFout } = await db
    .from('clickup_instellingen')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (instFout) throw new Error(`instellingen lezen mislukt: ${instFout.message}`)
  if (!inst) throw new Error(`geen ClickUp-instellingen voor tenant ${tenantId}`)

  const token = await geefToken(db)

  // Koppeling ClickUp-naam → persoon. Een persoon bestaat los van een
  // account: de planning in ClickUp kent alleen namen, en of daar al
  // iemand bij ingelogd heeft is een aparte vraag. Eén keer ophalen;
  // het zijn er tientallen, niet duizenden.
  const { data: personen } = await db
    .from('personen')
    .select('id, naam, clickup_label, profile_id')
    .eq('tenant_id', tenantId)
    .eq('actief', true)
    .not('clickup_label', 'is', null)

  const perLabel = new Map<string, Ploeglid>()
  for (const p of personen ?? []) {
    if (p.clickup_label) {
      perLabel.set(p.clickup_label, {
        id: p.id,
        naam: p.naam,
        heeftAccount: p.profile_id !== null,
      })
    }
  }

  return {
    i: inst as Instellingen,
    token,
    perLabel,
    droogloop: !(inst as Instellingen).actief,
    ongekoppeldeNamen: new Set<string>(),
  }
}

/**
 * Eén taak met de hand binnenhalen, ongeacht status.
 *
 * De automatische ronde kijkt alleen naar "deze week" en "volgende
 * week". Er is altijd het geval dat daarbuiten valt: werk dat vandaag
 * tussendoor komt, een taak die per ongeluk op een andere status stond,
 * een klus die vooruit gehaald wordt. Daar hoefde tot nu toe iemand van
 * kantoor de status in ClickUp voor te verzetten — en dat verandert het
 * planbord voor iedereen, alleen om iets in NMZ GO te krijgen.
 */
export async function importeerTaak(
  db: SupabaseClient,
  tenantId: string,
  clickupTaakId: string,
): Promise<Record<string, unknown>> {
  const ctx = await maakContext(db, tenantId)
  const taak = await haal(`/task/${encodeURIComponent(clickupTaakId)}`, ctx.token)

  if (!taak?.id) {
    throw new Error(`ClickUp kent geen taak met id ${clickupTaakId}`)
  }

  const uit = await verwerkTaak(db, tenantId, taak, ctx)

  return {
    taak: taak.id,
    adres: taak.name ?? null,
    clickup_status: taak.status?.status ?? null,
    droogloop: ctx.droogloop,
    uitkomst: uit.soort,
    ...(uit.soort === 'overgeslagen' ? { reden: uit.reden } : {}),
    ...(uit.soort === 'proef' ? { proef: uit.proef } : {}),
    namen_zonder_persoon: [...ctx.ongekoppeldeNamen],
  }
}

export async function synchroniseer(
  db: SupabaseClient,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const ctx = await maakContext(db, tenantId)
  const { i, token, droogloop } = ctx

  let gezien = 0
  let nieuw = 0
  let bijgewerkt = 0
  let ongewijzigd = 0
  const proef: Record<string, unknown>[] = []
  const overgeslagen: Bevinding[] = []

  // De keuzelijst van het medewerkersveld, opgepikt van de eerste taak
  // die hem draagt — gratis, want die taken halen we toch al op. Wat
  // ermee gebeurt staat in register.ts.
  let opties: string[] = []

  // Meerdere statussen, want een taak schuift in het weekend van
  // "volgende week" naar "deze week". Alleen op de eerste filteren
  // betekent dat hij daarna uit beeld verdwijnt: bestaande bonnen
  // blijven staan, maar een wijziging in de ploeg komt niet meer binnen.
  const statussen = (i.trigger_statussen?.length ? i.trigger_statussen : [i.trigger_status])
    .filter(Boolean)

  for (const lijst of i.lijst_ids) {
    const vraag = statussen
      .map((st) => `statuses[]=${encodeURIComponent(st)}`)
      .join('&')
    const { taken, afgekapt } = await haalTaken(lijst, vraag, token)
    if (afgekapt) {
      overgeslagen.push({
        taak: lijst,
        adres: `(lijst ${lijst})`,
        reden: 'Meer dan 5000 taken opgehaald zonder einde; de rest van deze lijst is niet bekeken.',
      })
    }

    for (const taak of taken) {
      gezien++
      const adres = taak.name ?? '(zonder naam)'
      if (opties.length === 0) opties = veldOpties(taak, i.veld_medewerkers)

      try {
        const uit = await verwerkTaak(db, tenantId, taak, ctx)
        switch (uit.soort) {
          case 'nieuw':       nieuw++; break
          case 'bijgewerkt':  bijgewerkt++; break
          case 'ongewijzigd': ongewijzigd++; break
          case 'proef':       nieuw++; proef.push(uit.proef); break
          case 'overgeslagen':
            overgeslagen.push({ taak: taak.id, adres, reden: uit.reden })
            break
        }
      } catch (e) {
        // Nooit stil overslaan: een taak die klapt komt terug in het
        // resultaat, met reden. Stil overslaan betekent maandagochtend
        // iemand zonder werkbon.
        overgeslagen.push({
          taak: taak.id,
          adres,
          reden: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  // Nooit de ronde omgooien. De werkbonnen zijn hierboven al verwerkt;
  // een hapering in het bijwerken van de ploeg mag daar niet toe leiden
  // dat de hele taak als mislukt terugkomt en opnieuw wordt gedraaid.
  // Het komt terug in het resultaat, en de volgende ronde probeert het
  // gewoon opnieuw — er gaat niets verloren.
  let register: Record<string, unknown>
  try {
    register = await werkRegisterBij(db, tenantId, opties, i.medewerker_labels ?? [], droogloop)
  } catch (e) {
    register = { fout: e instanceof Error ? e.message : String(e) }
  }

  return {
    droogloop,
    gezien,
    nieuw,
    bijgewerkt,
    ongewijzigd,
    overgeslagen,
    register,
    namen_zonder_persoon: [...ctx.ongekoppeldeNamen],
    zonder_account: [...new Set(
      [...ctx.perLabel.values()].filter((p) => !p.heeftAccount).map((p) => p.naam),
    )],
    ...(droogloop ? { proef } : {}),
  }
}

/**
 * Wat de standenronde met één werkbon heeft gedaan.
 *
 * `botsing` is geen fout: het is het geval waarin ClickUp en NMZ GO
 * allebei iets beweren en ze het oneens zijn. Dan wordt er niets
 * overschreven en gaat er een melding naar kantoor — zie
 * `clickup_stand_overnemen()` in migratie 043.
 */
type Standuitkomst =
  | 'opgeleverd'
  | 'stilgelegd'
  | 'hervat'
  | 'vervolg_gemeld'
  | 'vervolg_afgerond'
  | 'ongewijzigd'
  | 'botsing'

/** Het moment waarop ClickUp deze taak voor het laatst verzette. */
function statusmoment(taak: any): string {
  const ms = taak.date_closed ?? taak.date_updated
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString()
  return new Date(n).toISOString()
}

/**
 * De standen uit ClickUp overnemen in NMZ GO.
 *
 * ── Waarom dit een aparte ronde is ──
 *
 * Niet iedereen werkt in de app. Kantoor vinkt in ClickUp af, en die
 * klus bleef in NMZ GO op "nog niet gestart" staan — bij de eerste
 * telling negen stuks, waarvan de oudste tien dagen. Het bord loog dus
 * over het werk, en precies daar wordt op gestuurd.
 *
 * Dat kwam door drie dingen achter elkaar, en het derde is de reden
 * dat dit niet in `synchroniseer()` past:
 *
 *   1. Die ronde vraagt ClickUp alleen om taken op de triggerstatussen
 *      ("deze week", "volgende week"). Een taak die op "opgeleverd"
 *      gaat staan valt uit die vraag en wordt nooit meer bekeken.
 *   2. `haalTaken` weigerde gesloten taken sowieso — zie daar.
 *   3. En `verwerkTaak()` maakt van elke taak die hij ziet een
 *      werkbon. Zou je daar "opgeleverd" aan de statuslijst toevoegen,
 *      dan komen er in één ronde ruim tweehonderd historische taken
 *      binnen die stuk voor stuk een PDF-download en een nieuwe bon
 *      opleveren. Van vierenzeventig bonnen naar driehonderd, en het
 *      overgrote deel over werk van maanden geleden.
 *
 * Vandaar de harde regel hier: **deze ronde maakt nooit een werkbon
 * aan.** Kent NMZ GO de taak niet, dan slaat hij hem over. Nieuwe
 * klussen binnenhalen blijft het werk van `synchroniseer()`; dit is
 * alleen het bijhouden van wat er met de bekende klussen gebeurt.
 *
 * Daardoor is de ronde ook goedkoop: één lijstquery, geen PDF's, geen
 * bijlagen. Met `date_updated_gt` op de vorige ronde komt er meestal
 * niets terug.
 */
export async function standenOphalen(
  db: SupabaseClient,
  tenantId: string,
  droogloop = false,
): Promise<Record<string, unknown>> {
  const i = await geefInstellingen(db, tenantId)
  const token = await geefToken(db)

  // Het moment waarop deze ronde begon, en niet het moment waarop hij
  // klaar is. Wat er tijdens de ronde in ClickUp verandert hoort de
  // volgende keer alsnog langs te komen.
  const begonnen = new Date()

  // De statussen die iets over de uitvoering zeggen. Alleen wat de
  // tenant heeft ingevuld: een lege kolom is geen status en hoort niet
  // als lege string in de vraag te belanden.
  //
  // "wacht op foto's" staat er bewust niet bij. Die zet NMZ GO zelf op
  // het bord bij het opleveren; hem terugvragen en teruglezen is je
  // eigen echo achterna lopen.
  const gevraagd = [
    i.status_opgeleverd,
    i.status_stilgelegd,
    i.status_asbest,
    i.status_spuiten_isoleren,
    i.status_opnieuw_inplannen,
    ...(i.trigger_statussen?.length ? i.trigger_statussen : [i.trigger_status]),
  ].filter((s): s is string => Boolean(s && s.trim()))

  // Dubbele statussen kosten een extra queryparameter en leveren
  // niets op — een tenant mag twee kolommen op dezelfde tekst zetten.
  const statussen = [...new Set(gevraagd)]
  if (statussen.length === 0) {
    return { overgeslagen: 'geen enkele status ingevuld in clickup_instellingen' }
  }

  // Alle bonnen die uit ClickUp komen, in één keer. Het zijn er
  // tientallen; een taak-voor-taak-vraag zou per ronde net zoveel
  // databaseverkeer kosten als de hele lijst.
  const { data: bonnen, error: bonfout } = await db
    .from('werkbonnen')
    .select('id, adres, clickup_taak_id, clickup_status, status, ' +
            'opgeleverd_op, stilgelegd_op, vervolg_soort')
    .eq('tenant_id', tenantId)
    .not('clickup_taak_id', 'is', null)

  if (bonfout) throw new Error(`werkbonnen lezen mislukt: ${bonfout.message}`)

  interface Bekend {
    id: string
    adres: string
    clickup_status: string | null
    /** Genoeg om in de droogloop te laten zien waar de bon nu staat. */
    nu: string
  }

  const perTaak = new Map<string, Bekend>()
  for (const b of bonnen ?? []) {
    perTaak.set(b.clickup_taak_id as string, {
      id: b.id as string,
      adres: (b.adres as string) ?? '(zonder adres)',
      clickup_status: (b.clickup_status as string) ?? null,
      nu: b.opgeleverd_op ? 'opgeleverd'
        : b.stilgelegd_op ? 'stilgelegd'
        : b.vervolg_soort ? String(b.vervolg_soort)
        : String(b.status ?? 'open'),
    })
  }

  const sinds = i.standen_gesynct_tot ? Date.parse(i.standen_gesynct_tot) : NaN
  const vanafDeel = Number.isFinite(sinds) ? `&date_updated_gt=${sinds}` : ''

  let gezien = 0
  let onbekend = 0
  const uitkomsten: Record<string, number> = {}
  const botsingen: Bevinding[] = []
  const overgeslagen: Bevinding[] = []
  const zouAanraken: Record<string, string>[] = []

  for (const lijst of i.lijst_ids) {
    const vraag = statussen
      .map((st) => `statuses[]=${encodeURIComponent(st)}`)
      .join('&') + vanafDeel

    const { taken, afgekapt } = await haalTaken(lijst, vraag, token, true)
    if (afgekapt) {
      overgeslagen.push({
        taak: lijst,
        adres: `(lijst ${lijst})`,
        reden: 'Meer dan 5000 taken opgehaald zonder einde; de rest van deze lijst is niet bekeken.',
      })
    }

    for (const taak of taken) {
      const bon = perTaak.get(taak.id)
      // Een taak die NMZ GO niet kent. Meestal werk van vóór de
      // koppeling, soms een klus die nooit is binnengehaald omdat de
      // werkopdracht ontbrak. Hier gebeurt daar niets mee — zie de kop.
      if (!bon) { onbekend++; continue }

      gezien++
      const status = taak.status?.status ?? null
      const stand = standUitStatus(status ?? '', i)

      // Droogloop: laat zien wát hij zou aanraken en schrijf niets.
      // Bewust alleen de vertaling en de huidige stand, niet de
      // uitkomst — die beslissing staat in `clickup_stand_overnemen()`
      // en hoort op één plek te staan. Hem hier nabouwen om een
      // voorspelling te kunnen doen levert twee regels op die uit
      // elkaar gaan lopen, en dan voorspelt de droogloop iets anders
      // dan er gebeurt.
      if (droogloop) {
        if (stand) {
          zouAanraken.push({
            adres: bon.adres,
            taak: taak.id,
            clickup: status ?? '(geen)',
            nu_in_go: bon.nu,
            wordt: stand,
          })
        }
        continue
      }

      // De spiegel altijd bijwerken, ook als de status niets over de
      // stand zegt. Juist dát veld liep vast: bon 6070 stond tien dagen
      // op "deze week" terwijl ClickUp hem allang had gesloten, want
      // niemand keek nog naar die taak.
      if (status !== bon.clickup_status) {
        await db.from('werkbonnen')
          .update({ clickup_status: status, laatst_gesynct: new Date().toISOString() })
          .eq('id', bon.id)
      }

      if (!stand) continue

      const { data: uit, error } = await db.rpc('clickup_stand_overnemen', {
        p_werkbon: bon.id,
        p_stand: stand,
        p_moment: statusmoment(taak),
        p_status: status ?? stand,
      })

      if (error) {
        // Nooit stil overslaan: één bon die klapt mag de ronde niet
        // omgooien, maar hij hoort wel in het resultaat te staan.
        overgeslagen.push({ taak: taak.id, adres: bon.adres, reden: error.message })
        continue
      }

      const soort = String((uit as Record<string, unknown>)?.uitkomst ?? 'ongewijzigd') as Standuitkomst
      uitkomsten[soort] = (uitkomsten[soort] ?? 0) + 1

      if (soort === 'botsing') {
        const reden = String((uit as Record<string, unknown>)?.reden ?? 'onbekend verschil')
        botsingen.push({ taak: taak.id, adres: bon.adres, reden })
        await db.rpc('clickup_botsing_melden', {
          p_werkbon: bon.id,
          p_tekst: `ClickUp en NMZ GO spreken elkaar tegen — ${bon.adres}: ${reden}`,
        })
      }
    }
  }

  // Een droogloop verzet het stempel niet. Anders kijkt de echte ronde
  // erna naar een leeg venster en gebeurt er alsnog niets — een
  // proefdraai die het werk stilletjes opeet.
  if (!droogloop) {
    // Pas bijwerken als de ronde eromheen is gelukt. Klapt hij
    // halverwege, dan blijft het oude stempel staan en kijkt de
    // volgende ronde opnieuw naar hetzelfde venster. Liever twee keer
    // hetzelfde bekeken dan één taak overgeslagen — elke stap
    // hierboven is idempotent.
    await db.from('clickup_instellingen')
      .update({ standen_gesynct_tot: begonnen.toISOString() })
      .eq('tenant_id', tenantId)
  }

  return {
    droogloop,
    venster: i.standen_gesynct_tot ?? 'alles (eerste ronde)',
    gezien,
    onbekend,
    ...uitkomsten,
    ...(droogloop ? { zou_aanraken: zouAanraken } : { botsingen }),
    overgeslagen,
  }
}

/**
 * Diagnose voor één ClickUp-taak: geeft de tekstlaag terug zoals de
 * parser hem ziet, plus wat eruit gehaald wordt.
 *
 * Nodig omdat een overgeslagen opdracht anders niet na te lopen is: de
 * bijlage-URL's van ClickUp zijn kortlevend en alleen deze functie kan
 * erbij. Zonder dit blijft "wijkt af van het sjabloon" een dood spoor,
 * terwijl juist dat de opdrachten zijn die iemand handmatig moet
 * oppakken.
 */
export async function tekstproef(
  db: SupabaseClient,
  tenantId: string,
  clickupTaakId: string,
): Promise<Record<string, unknown>> {
  const i = await geefInstellingen(db, tenantId)
  const token = await geefToken(db)

  const taak = await haal(`/task/${clickupTaakId}`, token)
  const opdracht = bijlage(taak, i.veld_werkopdracht, OPDRACHT_VELD, OPDRACHT_BESTAND) ??
                   await opdrachtUitBijlagen(taak, token)
  if (!opdracht) return { adres: taak.name, bevinding: 'geen werkopdracht-PDF op de taak' }

  const res = await fetch(opdracht.url)
  if (!res.ok) return { adres: taak.name, bevinding: `PDF niet op te halen (${res.status})` }

  const tekst = await leesPdf(new Uint8Array(await res.arrayBuffer()))
  const regels = tekst.split('\n')

  let ontleding: unknown
  try {
    ontleding = ontleed(tekst, i.uitgesloten_punten)
  } catch (e) {
    ontleding = { fout: e instanceof Error ? e.message : String(e) }
  }

  return {
    adres: taak.name,
    bestand: opdracht.naam,
    aantal_regels: regels.length,
    regels,
    ontleding,
  }
}

async function bewaarDocument(
  db: SupabaseClient,
  bonId: string,
  bytes: Uint8Array,
  naam: string,
  kolom: 'opdracht_pad' | 'tekening_pad',
) {
  const pad = `${bonId}/${naam}`
  const { error } = await db.storage
    .from('werkbon-documenten')
    .upload(pad, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) throw new Error(`${naam} opslaan mislukt: ${error.message}`)
  await db.from('werkbonnen').update({ [kolom]: pad }).eq('id', bonId)
}

// ============================================================
// Terugkoppeling naar ClickUp
// ============================================================
// NMZ GO is de uitvoeringskant, ClickUp is waar de planning leeft. Wat
// hier gebeurt moet daar zichtbaar worden, anders kijkt de planner naar
// een bord dat niet klopt.
//
// Dit loopt via de wachtrij en niet rechtstreeks vanuit de database:
// ligt ClickUp er even uit, dan blijft de taak staan en wordt hij
// opnieuw geprobeerd. Een zwamsaneerder die een klus stillegt hoort
// daar nooit op te wachten.

// De regel zelf staat in `statusregels.ts` — losse module zonder
// afhankelijkheden, zodat een test hem kan draaien zonder Deno.
async function schrijf(pad: string, token: string, body: unknown): Promise<void> {
  const res = await fetch(`${API}${pad}`, {
    method: 'PUT',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    throw new Error(
      'ClickUp weigert het token (401). Werk clickup_token bij in Vault ' +
      'met vault.update_secret().',
    )
  }
  if (!res.ok) {
    throw new Error(`ClickUp gaf ${res.status} op ${pad}: ${await res.text()}`)
  }
}

/**
 * Eén custom field op een taak zetten.
 *
 * Een ander eindpunt dan `schrijf`: velden gaan via POST op
 * `/task/{id}/field/{veld}`, de taak zelf via PUT. Bij een labelveld is
 * de waarde een reeks option-id's, bij een datum een tijdstempel in
 * milliseconden.
 */
async function schrijfVeld(
  taakId: string,
  veldId: string,
  token: string,
  waarde: unknown,
): Promise<void> {
  const res = await fetch(
    `${API}/task/${encodeURIComponent(taakId)}/field/${encodeURIComponent(veldId)}`,
    {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: waarde }),
    },
  )
  if (res.status === 401) {
    throw new Error(
      'ClickUp weigert het token (401). Werk clickup_token bij in Vault ' +
      'met vault.update_secret().',
    )
  }
  if (!res.ok) {
    throw new Error(`ClickUp gaf ${res.status} op veld ${veldId}: ${await res.text()}`)
  }
}

/**
 * Een datum zoals ClickUp hem wil: milliseconden op middernacht UTC.
 *
 * Precies de omkering van `datum()` hierboven, die `toISOString()` doet
 * en dus in UTC leest. Een ander tijdstip kiezen betekent dat de datum
 * die je wegschrijft er bij het teruglezen een dag naast ligt.
 */
function naarMs(d: string | null): number | null {
  if (!d) return null
  const ms = Date.parse(`${d}T00:00:00.000Z`)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Een wijziging uit NMZ GO terug naar ClickUp.
 *
 * Tot nu toe ging het verkeer één kant op: ClickUp plande, NMZ GO
 * voerde uit. Maar er verandert van alles ná het inplannen — iemand
 * valt uit, de klus loopt uit — en dat gebeurde tot nu toe in ClickUp,
 * terwijl de uitvoerder in NMZ GO staat. Wie hier iets wijzigt, wijzigt
 * het nu op allebei de plekken.
 *
 * Alleen het veld dat is aangeraakt gaat mee. De ploeg wegschrijven bij
 * een datumwijziging zou een keuze van de planner kunnen overschrijven
 * die tussendoor in ClickUp is gemaakt.
 */
export async function werkbonBijwerken(
  db: SupabaseClient,
  tenantId: string,
  werkbonId: string,
  soort: 'ploeg' | 'planning',
): Promise<Record<string, unknown>> {
  const i = await geefInstellingen(db, tenantId)

  const { data: bon } = await db
    .from('werkbonnen')
    .select('id, adres, clickup_taak_id, geplande_start, geplande_eind')
    .eq('id', werkbonId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!bon) throw new Error(`werkbon ${werkbonId} bestaat niet`)

  if (!bon.clickup_taak_id) {
    return { overgeslagen: 'deze werkbon komt niet uit ClickUp', adres: bon.adres }
  }

  if (!i.actief) {
    return { droogloop: true, adres: bon.adres, soort, zou_bijwerken: true }
  }

  const token = await geefToken(db)

  if (soort === 'planning') {
    const start = naarMs(bon.geplande_start)
    const eind = naarMs(bon.geplande_eind)

    // De taak zelf én de custom velden. De synchronisatie leest het
    // custom veld eerst en valt terug op de taak; alleen de ene kant
    // bijwerken laat de andere de oude datum houden, en dan wint bij de
    // eerstvolgende import weer de oude waarde.
    await schrijf(`/task/${bon.clickup_taak_id}`, token, {
      ...(start !== null ? { start_date: start } : {}),
      ...(eind !== null ? { due_date: eind } : {}),
    })
    if (i.veld_startdatum && start !== null) {
      await schrijfVeld(bon.clickup_taak_id, i.veld_startdatum, token, start)
    }
    if (i.veld_opleverdatum && eind !== null) {
      await schrijfVeld(bon.clickup_taak_id, i.veld_opleverdatum, token, eind)
    }

    await db.from('werkbonnen')
      .update({ laatst_gesynct: new Date().toISOString() })
      .eq('id', werkbonId)

    return {
      adres: bon.adres,
      clickup_taak: bon.clickup_taak_id,
      start: bon.geplande_start,
      eind: bon.geplande_eind,
    }
  }

  // ── De ploeg ──────────────────────────────────────────────────
  if (!i.veld_medewerkers) {
    throw new Error(
      'Er is geen medewerkersveld ingesteld in clickup_instellingen; ' +
      'de ploeg is niet naar ClickUp te schrijven.',
    )
  }

  const { data: ploeg, error: ploegFout } = await db
    .from('werkbon_medewerkers')
    .select('personen(naam, clickup_label)')
    .eq('werkbon_id', werkbonId)
    .eq('tenant_id', tenantId)
  if (ploegFout) throw new Error(`ploeg lezen mislukt: ${ploegFout.message}`)

  const labels = (ploeg ?? [])
    .map((r: any) => r.personen?.clickup_label)
    .filter(Boolean) as string[]

  // De option-id's staan in de taak zelf; een label bestaat in ClickUp
  // alleen als er een optie voor is.
  const taak = await haal(`/task/${encodeURIComponent(bon.clickup_taak_id)}`, token)
  const veldDef = taak.custom_fields?.find((f: any) => f.id === i.veld_medewerkers)
  const opties: any[] = veldDef?.type_config?.options ?? []

  const ids: string[] = []
  const onbekend: string[] = []
  for (const label of labels) {
    const optie = opties.find((o: any) => o?.label === label)
    if (optie?.id) ids.push(optie.id)
    else onbekend.push(label)
  }

  // Iemand die in ClickUp niet als optie bestaat kunnen we daar niet
  // neerzetten. Dat is geen reden om de rest niet te schrijven, maar het
  // hoort wel terug te komen — anders staat hij in NMZ GO op de klus en
  // in ClickUp niet, zonder dat iemand het ziet.
  await schrijfVeld(bon.clickup_taak_id, i.veld_medewerkers, token, ids)

  await db.from('werkbonnen')
    .update({ laatst_gesynct: new Date().toISOString() })
    .eq('id', werkbonId)

  if (onbekend.length > 0) {
    throw new Error(
      `de ploeg staat in ClickUp, maar ${onbekend.join(', ')} ` +
      'heeft daar geen label onder Medewerkers en is dus niet meegestuurd',
    )
  }

  return {
    adres: bon.adres,
    clickup_taak: bon.clickup_taak_id,
    ploeg: labels,
  }
}

async function opmerking(taakId: string, token: string, tekst: string): Promise<void> {
  const res = await fetch(`${API}/task/${taakId}/comment`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: tekst, notify_all: true }),
  })
  // Een mislukte opmerking mag de statuswijziging niet ongedaan maken;
  // de status is het belangrijke deel.
  if (!res.ok) console.warn(`opmerking plaatsen mislukt (${res.status})`)
}

// ============================================================
// Foto's als bijlage bij de ClickUp-taak
// ============================================================
// Het bewijs dat het werk gedaan is, hoort te staan waar de planning
// leeft. Zolang de foto's alleen in NMZ GO staan, moet iedereen die
// naar het bord kijkt hier apart komen kijken.
//
// Dit is bovendien de voorwaarde voor het opruimen van de bucket:
// zodra ClickUp de foto's heeft, is Supabase Storage een doorgeefluik
// en hoeven ze daar geen maanden te blijven staan. Vandaar het stempel
// per foto — zonder dat gooi je bewijs weg dat nergens anders staat.

/** Hoeveel foto's er per ronde hoogstens de deur uit gaan. */
const FOTOS_PER_RONDE = 25

/**
 * Een bestandsnaam waar iemand in ClickUp iets aan heeft.
 *
 * Wat de telefoon oplevert is `1786373563255_image.jpg`. Twintig van
 * die naast elkaar in een taak zijn twintig keer hetzelfde. Adres,
 * fase en volgnummer maken er iets van dat je kunt teruglezen.
 */
function bijlagenaam(adres: string, fase: string, n: number, bron: string): string {
  const kern = (adres || 'werkbon')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const punt = bron.lastIndexOf('.')
  const extensie = punt > 0 ? bron.slice(punt).toLowerCase() : '.jpg'
  return `${kern}-${fase}-${String(n).padStart(2, '0')}${extensie}`
}

/**
 * Eén bijlage naar ClickUp. Multipart, want dat is wat het eindpunt
 * verwacht — geen Content-Type meezetten, `fetch` bepaalt zelf de
 * scheidingsreeks en die moet in de header overeenkomen met de body.
 */
async function stuurBijlage(
  taakId: string,
  token: string,
  bestand: Blob,
  naam: string,
): Promise<string | null> {
  const form = new FormData()
  form.append('attachment', bestand, naam)
  form.append('filename', naam)

  const res = await fetch(`${API}/task/${encodeURIComponent(taakId)}/attachment`, {
    method: 'POST',
    headers: { Authorization: token },
    body: form,
  })

  if (res.status === 401) {
    throw new Error(
      'ClickUp weigert het token (401). Werk clickup_token bij in Vault ' +
      'met vault.update_secret().',
    )
  }
  if (!res.ok) {
    throw new Error(`ClickUp gaf ${res.status} op de bijlage ${naam}: ${await res.text()}`)
  }

  const uit = await res.json().catch(() => null)
  return uit?.id ?? null
}

/**
 * De foto's van één werkbon naar de gekoppelde ClickUp-taak.
 *
 * Idempotent via het stempel per foto: wat al bij ClickUp staat wordt
 * niet meegenomen. Dat is ook de reden dat het stempel meteen na élke
 * upload wordt weggeschreven en niet aan het eind — valt de functie
 * halverwege om, dan pakt de volgende ronde precies de rest op.
 *
 * Een foto die het niet haalt laat de taak mislukken, ook als de rest
 * wel is gelukt. De geslaagde foto's zijn dan al gestempeld, dus de
 * herhaling doet alleen wat overbleef. Stil "vier van de vijf" melden
 * zou betekenen dat het opruimen straks een bestand weggooit dat
 * nergens anders staat.
 */
export async function fotosUploaden(
  db: SupabaseClient,
  tenantId: string,
  werkbonId: string,
): Promise<Record<string, unknown>> {
  const i = await geefInstellingen(db, tenantId)

  const { data: bon } = await db
    .from('werkbonnen')
    .select('id, adres, clickup_taak_id')
    .eq('id', werkbonId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!bon) throw new Error(`werkbon ${werkbonId} bestaat niet`)

  // Een handmatig aangemaakte bon hangt aan geen ClickUp-taak. Geen
  // fout — er valt alleen niets heen te sturen.
  if (!bon.clickup_taak_id) {
    return { overgeslagen: 'deze werkbon komt niet uit ClickUp', adres: bon.adres }
  }

  const { data: fotos, error: fotoFout } = await db
    .from('fotos')
    .select('id, storage_path, bestandsnaam, fase, created_at')
    .eq('werkbon_id', werkbonId)
    .eq('tenant_id', tenantId)
    .is('clickup_geupload_op', null)
    .is('opgeruimd_op', null)
    .order('created_at', { ascending: true })
  if (fotoFout) throw new Error(`foto's lezen mislukt: ${fotoFout.message}`)

  // Waar de nummering verdergaat. Puur voor de bestandsnaam: bij een
  // tweede ronde hoort de vierde foto niet weer -01 te heten.
  const { count: alGedaan } = await db
    .from('fotos')
    .select('id', { count: 'exact', head: true })
    .eq('werkbon_id', werkbonId)
    .not('clickup_geupload_op', 'is', null)

  const teDoen = fotos ?? []
  if (teDoen.length === 0) {
    return {
      adres: bon.adres,
      clickup_taak: bon.clickup_taak_id,
      geupload: 0,
      al_bij_clickup: alGedaan ?? 0,
      klaar: true,
    }
  }

  // Droogloop, net als de synchronisatie: rapporteren wat er zou
  // gebeuren en niets wegschrijven.
  if (!i.actief) {
    return {
      droogloop: true,
      adres: bon.adres,
      clickup_taak: bon.clickup_taak_id,
      zou_uploaden: teDoen.length,
      namen: teDoen.map((f, n) =>
        bijlagenaam(bon.adres ?? '', f.fase ?? 'na', (alGedaan ?? 0) + n + 1, f.bestandsnaam ?? '')),
    }
  }

  const token = await geefToken(db)
  const ronde = teDoen.slice(0, FOTOS_PER_RONDE)

  let geupload = 0
  const mislukt: { foto: string; reden: string }[] = []

  for (const [n, foto] of ronde.entries()) {
    const naam = bijlagenaam(
      bon.adres ?? '', foto.fase ?? 'na', (alGedaan ?? 0) + n + 1, foto.bestandsnaam ?? '',
    )

    try {
      const { data: bestand, error } = await db.storage
        .from('werkbon-fotos')
        .download(foto.storage_path)

      if (error || !bestand) {
        throw new Error(`niet in de bucket te vinden (${error?.message ?? 'leeg'})`)
      }

      const attachmentId = await stuurBijlage(bon.clickup_taak_id, token, bestand, naam)

      // Meteen stempelen. Valt de functie hierna om, dan is deze foto
      // in de volgende ronde uit beeld en gaat hij niet twee keer.
      const { error: stempelFout } = await db
        .from('fotos')
        .update({
          clickup_geupload_op: new Date().toISOString(),
          clickup_attachment_id: attachmentId,
        })
        .eq('id', foto.id)

      if (stempelFout) {
        throw new Error(
          `bijlage staat bij ClickUp maar het stempel is niet weggeschreven: ${stempelFout.message}`,
        )
      }
      geupload++
    } catch (e) {
      mislukt.push({ foto: foto.storage_path, reden: e instanceof Error ? e.message : String(e) })
    }
  }

  const restant = teDoen.length - ronde.length

  // Wat niet gelukt is, hoort terug te komen. De gestempelde foto's
  // zijn dan uit beeld, dus de herhaling doet alleen wat overbleef.
  if (mislukt.length > 0) {
    throw new Error(
      `${geupload} van ${ronde.length} foto's naar ClickUp; mislukt: ` +
      mislukt.map((m) => `${m.foto} (${m.reden})`).join('; '),
    )
  }

  // Meer dan één ronde vol. Ook dat komt terug — een taak die stil
  // "25 gedaan" meldt terwijl er nog dertig liggen, is een taak die
  // niemand meer oppakt.
  if (restant > 0) {
    throw new Error(`${geupload} foto's naar ClickUp, nog ${restant} te gaan`)
  }

  return {
    adres: bon.adres,
    clickup_taak: bon.clickup_taak_id,
    geupload,
    al_bij_clickup: alGedaan ?? 0,
    klaar: true,
  }
}

/**
 * Staat het fotobewijs compleet bij ClickUp, en zo niet: is er nog
 * iemand mee bezig?
 *
 * De statuswijziging bij oplevering leunt hierop. Prioriteit zet de
 * uploadtaak vóór de statustaak, maar dat is de gelukkige route; gaat
 * de upload mis, dan mag de status niet alsnog op "opgeleverd"
 * springen alsof het bewijs er staat.
 */
async function fotostand(
  db: SupabaseClient,
  tenantId: string,
  werkbonId: string,
): Promise<{ openstaand: number; uploadLoopt: boolean }> {
  const { count: openstaand } = await db
    .from('fotos')
    .select('id', { count: 'exact', head: true })
    .eq('werkbon_id', werkbonId)
    .is('clickup_geupload_op', null)
    .is('opgeruimd_op', null)

  if ((openstaand ?? 0) === 0) return { openstaand: 0, uploadLoopt: false }

  // Ligt de uploadtaak nog te wachten of is hij bezig, dan is dit een
  // kwestie van volgorde en wachten we. Is hij onverwerkbaar geworden,
  // dan is wachten zinloos: dan gaat de status naar "wacht op foto's"
  // zodat het bord de waarheid vertelt.
  const { count: open } = await db
    .from('verwerkingstaken')
    .select('id', { count: 'exact', head: true })
    .eq('soort', 'clickup.fotos_uploaden')
    .eq('tenant_id', tenantId)
    .eq('payload->>werkbon_id', werkbonId)
    .in('status', ['wachtend', 'bezig'])

  return { openstaand: openstaand ?? 0, uploadLoopt: (open ?? 0) > 0 }
}

export async function statusBijwerken(
  db: SupabaseClient,
  tenantId: string,
  werkbonId: string,
  soort: 'stilgelegd' | 'hervat' | 'opgeleverd' | 'spuiten_isoleren' | 'opnieuw_inplannen',
): Promise<Record<string, unknown>> {
  const i = await geefInstellingen(db, tenantId)

  const { data: bon } = await db
    .from('werkbonnen')
    .select('id, adres, clickup_taak_id, stilleg_reden, vervolg_reden, geplande_eind')
    .eq('id', werkbonId)
    .maybeSingle()
  if (!bon) throw new Error(`werkbon ${werkbonId} bestaat niet`)

  // Een handmatig aangemaakte bon hangt aan geen ClickUp-taak. Dat is
  // geen fout — er valt alleen niets terug te koppelen.
  if (!bon.clickup_taak_id) {
    return { overgeslagen: 'deze werkbon komt niet uit ClickUp' }
  }

  const token = await geefToken(db)

  let status: string
  let tekst: string
  let wachtOpFotos = 0

  if (soort === 'stilgelegd') {
    const reden = bon.stilleg_reden ?? 'geen reden vastgelegd'
    status = statusUitReden(reden, i)
    // Geen "nieuwe opleverdatum" meer: sinds migratie 029 schuift die
    // niet op. Hoelang een klus stilligt is op dit moment niet te
    // zeggen — bij asbest komt er een inventarisatie achteraan en geen
    // dag. Een datum noemen die niemand heeft vastgesteld is erger dan
    // geen datum noemen, zeker in een taak die de opdrachtgever leest.
    tekst = `Stilgelegd in NMZ GO: ${reden}\nDe planning is niet verschoven; de nieuwe datum wordt door de planner bepaald.`
  } else if (soort === 'hervat') {
    status = i.trigger_status
    tekst = 'Weer hervat in NMZ GO.'
  } else if (soort === 'spuiten_isoleren' || soort === 'opnieuw_inplannen') {
    // Vervolgwerk, en geen stilstand (migratie 035). De klus loopt door
    // in NMZ GO — `stilgelegd_op` blijft leeg — maar op het bord hoort
    // te staan wélk werk er nog ligt, want daar plant de planner op.
    // De reden komt uit `vervolg_reden` en niet uit `stilleg_reden`:
    // die tweede hoort bij een klus die écht stilligt, en een klus kan
    // allebei tegelijk hebben.
    const reden = bon.vervolg_reden ?? 'geen toelichting vastgelegd'
    if (soort === 'spuiten_isoleren') {
      status = i.status_spuiten_isoleren ?? i.status_stilgelegd ?? 'on hold'
      tekst = `In NMZ GO gemeld: er moet nog gespoten of geïsoleerd worden.\n${reden}`
    } else {
      status = i.status_opnieuw_inplannen ?? i.status_stilgelegd ?? 'on hold'
      tekst = `In NMZ GO gemeld: deze klus moet opnieuw ingepland worden.\n${reden}\nDe nieuwe datum wordt door de planner bepaald.`
    }
  } else {
    // De afspraak met de eigenaar: "opgeleverd" als het fotobewijs bij
    // ClickUp staat, anders "wacht op foto's". De status op het bord
    // hoort niet te suggereren dat er bewijs is terwijl dat er niet is.
    const stand = await fotostand(db, tenantId, werkbonId)

    if (stand.uploadLoopt) {
      // Alleen een kwestie van volgorde: de uploadtaak staat op een
      // lagere prioriteit en hoort vóór te gaan. Is hij er nog niet
      // doorheen, dan komt deze taak gewoon terug — een tijdelijke
      // fout, dus met oplopende wachttijd.
      throw new Error(
        `de fotoupload naar ClickUp loopt nog (${stand.openstaand} te gaan); ` +
        'de status volgt zodra de bijlagen er staan',
      )
    }

    wachtOpFotos = stand.openstaand
    if (wachtOpFotos > 0) {
      status = i.status_wacht_op_fotos ?? i.status_opgeleverd ?? 'opgeleverd'
      tekst = `Opgeleverd in NMZ GO, maar ${wachtOpFotos} foto('s) staan nog niet bij deze taak.`
    } else {
      status = i.status_opgeleverd ?? 'opgeleverd'
      tekst = 'Opgeleverd en door kantoor bevestigd in NMZ GO.'
    }
  }

  if (i.actief) {
    await schrijf(`/task/${bon.clickup_taak_id}`, token, { status })
    await opmerking(bon.clickup_taak_id, token, tekst)
    await db.from('werkbonnen')
      .update({ clickup_status: status, laatst_gesynct: new Date().toISOString() })
      .eq('id', werkbonId)
  }

  return {
    droogloop: !i.actief,
    adres: bon.adres,
    clickup_taak: bon.clickup_taak_id,
    nieuwe_status: status,
    opmerking: tekst,
    ...(wachtOpFotos > 0 ? { fotos_niet_bij_clickup: wachtOpFotos } : {}),
  }
}

// ============================================================
// NMZ GO — ClickUp-synchronisatie
// ============================================================
// Haalt de taken op die klaarstaan voor uitvoering en maakt er
// werkbonnen van. ClickUp blijft de bron van waarheid; NMZ GO is de
// uitvoeringskant.
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

const API = 'https://api.clickup.com/api/v2'

interface Instellingen {
  tenant_id: string
  lijst_ids: string[]
  trigger_status: string
  veld_medewerkers: string | null
  veld_startdatum: string | null
  veld_opleverdatum: string | null
  veld_uitloopdatum: string | null
  veld_opdrachtnummer: string | null
  veld_kluiscode: string | null
  veld_werkopdracht: string | null
  veld_werktekening: string | null
  uitgesloten_punten: string[]
  actief: boolean
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

/** Waarde van een custom field, of null als hij leeg is. */
function veld(taak: any, id: string | null): any {
  if (!id) return null
  const v = taak.custom_fields?.find((f: any) => f.id === id)
  return v?.value ?? null
}

function datum(ms: unknown): string | null {
  if (!ms) return null
  const n = Number(ms)
  if (!Number.isFinite(n)) return null
  return new Date(n).toISOString().split('T')[0]
}

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

function uitVeld(v: any): { url: string; naam: string } | null {
  if (!Array.isArray(v) || v.length === 0) return null
  const a = v[0]
  return a?.url ? { url: a.url, naam: a.title ?? 'document.pdf' } : null
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
function bijlage(taak: any, id: string | null, patroon: RegExp): { url: string; naam: string } | null {
  const uitInstelling = uitVeld(veld(taak, id))
  if (uitInstelling) return uitInstelling

  for (const f of taak.custom_fields ?? []) {
    if (f.type !== 'attachment') continue
    if (!patroon.test(String(f.name ?? ''))) continue
    const gevonden = uitVeld(f.value)
    if (gevonden) return gevonden
  }
  return null
}

const OPDRACHT_VELD = /werkopdracht/i
const TEKENING_VELD = /tekening/i

export async function synchroniseer(
  db: SupabaseClient,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const { data: inst, error: instFout } = await db
    .from('clickup_instellingen')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (instFout) throw new Error(`instellingen lezen mislukt: ${instFout.message}`)
  if (!inst) throw new Error(`geen ClickUp-instellingen voor tenant ${tenantId}`)

  const i = inst as Instellingen
  const droogloop = !i.actief

  // Het token staat in Vault, net als de service-role-sleutel. Deze
  // functie is de enige doorgang en is alleen voor service_role —
  // een browser of ingelogde gebruiker komt er niet bij.
  const { data: token, error: tokenFout } = await db.rpc('geef_clickup_token')
  if (tokenFout) throw new Error(`ClickUp-token lezen mislukt: ${tokenFout.message}`)
  if (!token) {
    throw new Error(
      'Er staat geen clickup_token in Vault. Zet hem met ' +
      "select vault.create_secret('<token>', 'clickup_token');",
    )
  }

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

  const perLabel = new Map<string, { id: string; naam: string; heeftAccount: boolean }>()
  for (const p of personen ?? []) {
    if (p.clickup_label) {
      perLabel.set(p.clickup_label, {
        id: p.id,
        naam: p.naam,
        heeftAccount: p.profile_id !== null,
      })
    }
  }

  let gezien = 0
  let nieuw = 0
  let bijgewerkt = 0
  const proef: Record<string, unknown>[] = []
  const overgeslagen: Bevinding[] = []
  const ongekoppeldeNamen = new Set<string>()

  for (const lijst of i.lijst_ids) {
    const status = encodeURIComponent(i.trigger_status)
    const resultaat = await haal(
      `/list/${lijst}/task?statuses[]=${status}&subtasks=false&include_closed=false`,
      token,
    )

    for (const taak of resultaat.tasks ?? []) {
      gezien++
      const adres = taak.name ?? '(zonder naam)'

      try {
        const opdracht = bijlage(taak, i.veld_werkopdracht, OPDRACHT_VELD)
        if (!opdracht) {
          overgeslagen.push({ taak: taak.id, adres, reden: 'geen werkopdracht-PDF op de taak' })
          continue
        }

        const pdfRes = await fetch(opdracht.url)
        if (!pdfRes.ok) {
          overgeslagen.push({ taak: taak.id, adres, reden: `werkopdracht niet op te halen (${pdfRes.status})` })
          continue
        }
        const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer())
        const tekst = await leesPdf(pdfBytes)
        const w = ontleed(tekst, i.uitgesloten_punten)

        const namen = labelNamen(taak, i.veld_medewerkers)
        const gekoppeld = namen
          .map((n) => perLabel.get(n))
          .filter(Boolean) as { id: string; naam: string; heeftAccount: boolean }[]
        for (const n of namen) if (!perLabel.has(n)) ongekoppeldeNamen.add(n)

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
          laatst_gesynct: new Date().toISOString(),
        }

        // Bij een droogloop rapporteren we wat er zóu ontstaan. Zonder
        // dat is "25 gezien, 25 goed" een getal zonder betekenis — je
        // wilt zien dát de punten kloppen voordat je hem aanzet.
        if (droogloop) {
          nieuw++
          proef.push({
            adres,
            bonnummer: bon.bonnummer,
            punten: w.punten.length,
            weggelaten: w.weggelaten.length,
            eerste_punt: w.punten[0]?.slice(0, 80) ?? null,
            medewerkers: gekoppeld.map((g) => g.naam + (g.heeftAccount ? '' : ' (nog geen account)')),
            geplande_start: bon.geplande_start,
            geplande_eind: bon.geplande_eind,
            kluiscode: bon.kluiscode,
            tekening: bijlage(taak, i.veld_werktekening, TEKENING_VELD) ? 'ja' : 'NEE',
          })
          continue
        }

        const { data: bestaand } = await db
          .from('werkbonnen')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('clickup_taak_id', taak.id)
          .maybeSingle()

        let bonId: string
        if (bestaand) {
          const { error } = await db.from('werkbonnen').update(bon).eq('id', bestaand.id)
          if (error) throw new Error(`werkbon bijwerken mislukt: ${error.message}`)
          bonId = bestaand.id
          bijgewerkt++
        } else {
          const { data, error } = await db.from('werkbonnen').insert(bon).select('id').single()
          if (error) throw new Error(`werkbon aanmaken mislukt: ${error.message}`)
          bonId = data.id
          nieuw++
        }

        // Punten alleen bij een nieuwe bon. Bij een bestaande zou
        // opnieuw invoegen het afvinkwerk van een zwamsaneerder wissen.
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

        // Toewijzing: eerst weg, dan opnieuw — ClickUp is leidend.
        await db.from('werkbon_medewerkers').delete().eq('werkbon_id', bonId)
        if (gekoppeld.length > 0) {
          await db.from('werkbon_medewerkers').insert(
            gekoppeld.map((g) => ({ tenant_id: tenantId, werkbon_id: bonId, persoon_id: g.id })),
          )
        }

        // Documenten kopiëren. De URL's van ClickUp zijn kortlevend,
        // dus een link opslaan heeft geen zin.
        await bewaarDocument(db, bonId, pdfBytes, 'werkopdracht.pdf', 'opdracht_pad')
        const tekening = bijlage(taak, i.veld_werktekening, TEKENING_VELD)
        if (tekening) {
          const t = await fetch(tekening.url)
          if (t.ok) {
            await bewaarDocument(db, bonId, new Uint8Array(await t.arrayBuffer()),
                                 'werktekening.pdf', 'tekening_pad')
          }
        }
      } catch (e) {
        overgeslagen.push({
          taak: taak.id,
          adres,
          reden: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return {
    droogloop,
    gezien,
    nieuw,
    bijgewerkt,
    overgeslagen,
    namen_zonder_persoon: [...ongekoppeldeNamen],
    zonder_account: [...new Set(
      [...perLabel.values()].filter((p) => !p.heeftAccount).map((p) => p.naam),
    )],
    ...(droogloop ? { proef } : {}),
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
  const { data: inst } = await db
    .from('clickup_instellingen')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!inst) throw new Error(`geen ClickUp-instellingen voor tenant ${tenantId}`)
  const i = inst as Instellingen

  const { data: token } = await db.rpc('geef_clickup_token')
  if (!token) throw new Error('geen clickup_token in Vault')

  const taak = await haal(`/task/${clickupTaakId}`, token)
  const opdracht = bijlage(taak, i.veld_werkopdracht, OPDRACHT_VELD)
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

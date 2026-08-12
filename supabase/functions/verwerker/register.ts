// ============================================================
// NMZ GO — het personenregister gelijkhouden met ClickUp
// ============================================================
// De ploeg in NMZ GO kwam uit een lijst die één keer, met de hand, in
// migratie 010 is neergezet en daarna door niets werd bijgewerkt. Wie
// er in ClickUp bij kwam bestond in de app dus niet: niet in de ploeg,
// niet uit te nodigen, en zijn naam op een klus kon nergens aan
// gekoppeld worden. Er was ook geen scherm om hem toe te voegen.
//
// Dit bestand is dat ontbrekende stuk. Het staat los van clickup.ts
// omdat er twee wegen naartoe leiden en er maar één versie van deze
// regels mag bestaan:
//
//   1. De synchronisatieronde — die heeft de keuzelijst toch al in
//      handen, want hij zit in elke taak die het veld draagt.
//   2. De knop "Ploeg verversen" op de medewerkerspagina, via de edge
//      function `ploeg-bijwerken` — voor wie niet tot de volgende ronde
//      wil wachten omdat er vanmiddag iemand ingepland moet worden.
//
// Twee dingen doet dit nadrukkelijk **niet**:
//
//   1. **Niemand verwijderen.** Een naam die in ClickUp weggaat blijft
//      hier staan; er hangen werkbonnen, uren en misschien een account
//      aan. Weghalen is mensenwerk.
//   2. **Geen bestaande koppeling breken.** De labellijst wordt de
//      vereniging van wat ClickUp aanbiedt en wat al in gebruik is,
//      zodat een naam die uit ClickUp verdwijnt niet stilletjes uit de
//      keuzelijst valt bij iemand die eraan hangt.
//
// Idempotent: een tweede ronde vindt niets nieuws meer.
// ============================================================

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export interface Registeruitkomst {
  gelezen: number
  toegevoegd?: string[]
  labels?: number
  droog?: boolean
  zou_toevoegen?: string[]
  labels_zouden_wijzigen?: boolean
}

/**
 * Álle namen die onder het medewerkersveld gekozen kúnnen worden.
 *
 * De keuzelijst zit al in elke taak die het veld draagt
 * (`type_config.options`), dus dit kost geen extra aanroep — belangrijk,
 * want de ronde draait elke vijf minuten.
 */
export function veldOpties(taak: any, id: string | null): string[] {
  if (!id) return []
  const f = taak.custom_fields?.find((x: any) => x.id === id)
  const opties = f?.type_config?.options
  if (!Array.isArray(opties)) return []
  return opties.map((o: any) => o?.label).filter(Boolean) as string[]
}

/**
 * Dezelfde keuzelijst, maar rechtstreeks bij ClickUp opgevraagd.
 *
 * Nodig voor de knop: die kan niet wachten op een taak die het veld
 * toevallig draagt, en moet ook werken in een week zonder klussen.
 */
export async function haalOpties(
  lijstIds: string[],
  veldId: string | null,
  token: string,
): Promise<string[]> {
  if (!veldId) return []

  for (const lijst of lijstIds) {
    const res = await fetch(`https://api.clickup.com/api/v2/list/${lijst}/field`, {
      headers: { Authorization: token },
    })
    if (res.status === 401) {
      throw new Error(
        'ClickUp weigert het token (401). Waarschijnlijk is het opnieuw gegenereerd; ' +
        'werk clickup_token bij in Vault met vault.update_secret().',
      )
    }
    if (!res.ok) throw new Error(`ClickUp gaf ${res.status} op de veldenlijst`)

    const body = await res.json()
    const veld = (body.fields ?? []).find((f: any) => f.id === veldId)
    const opties = veld?.type_config?.options
    if (Array.isArray(opties) && opties.length > 0) {
      return opties.map((o: any) => o?.label).filter(Boolean) as string[]
    }
  }

  return []
}

/**
 * Ontbrekende namen aanmaken en de labellijst bijwerken.
 *
 * `db` is bewust een parameter: de ronde geeft de service-client mee,
 * de knop de client van de ingelogde gebruiker. In dat tweede geval
 * bepaalt RLS wat mag, en dat hoort ook zo — kantoor mag de ploeg
 * beheren, een zwamsaneerder niet.
 */
export async function werkRegisterBij(
  db: SupabaseClient,
  tenantId: string,
  opties: string[],
  huidigeLabels: string[],
  droogloop = false,
): Promise<Registeruitkomst> {
  // Niets gevonden — dan weten we niets en raken we niets aan. Een lege
  // lijst is hier "geen informatie", niet "leeg".
  if (opties.length === 0) return { gelezen: 0 }

  const { data: bestaand, error: leesFout } = await db
    .from('personen')
    .select('clickup_label')
    .eq('tenant_id', tenantId)
    .not('clickup_label', 'is', null)

  if (leesFout) throw new Error(`register lezen mislukt: ${leesFout.message}`)

  // Ook inactieve personen tellen mee: iemand die op non-actief staat
  // hoort niet elke ronde opnieuw aangemaakt te worden.
  const bekend = new Set((bestaand ?? []).map((p) => p.clickup_label as string))
  const nieuwePersonen = opties.filter((l) => !bekend.has(l))

  const labels = [...new Set([...opties, ...huidigeLabels.filter((l) => bekend.has(l))])]
  const labelsGewijzigd =
    labels.length !== huidigeLabels.length ||
    labels.some((l) => !huidigeLabels.includes(l))

  if (droogloop) {
    return {
      gelezen: opties.length,
      droog: true,
      zou_toevoegen: nieuwePersonen,
      labels_zouden_wijzigen: labelsGewijzigd,
    }
  }

  if (nieuwePersonen.length > 0) {
    const { error } = await db.from('personen').insert(
      nieuwePersonen.map((label) => ({
        tenant_id: tenantId,
        naam: label,
        clickup_label: label,
      })),
    )
    if (error) throw new Error(`personen aanmaken mislukt: ${error.message}`)
  }

  if (labelsGewijzigd) {
    const { error } = await db
      .from('clickup_instellingen')
      .update({ medewerker_labels: labels })
      .eq('tenant_id', tenantId)
    if (error) throw new Error(`labellijst bijwerken mislukt: ${error.message}`)
  }

  return { gelezen: opties.length, toegevoegd: nieuwePersonen, labels: labels.length }
}

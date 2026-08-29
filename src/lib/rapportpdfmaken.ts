// ============================================================
// NMZ GO — het opleverrapport ophalen en tot PDF maken
// ============================================================
// De tegenhanger van `gegevensOphalen` in de verwerker, maar dan met de
// client van de ingelogde gebruiker. Dat is geen omweg maar precies
// goed: kantoor mag deze bon zien, dus de RLS laat exact de gegevens
// door die op het rapport horen. Ziet iemand een klus niet, dan krijgt
// hij er ook geen rapport van.
//
// De foto's gaan als ruwe bytes de opmaak in. Een foto die niet op te
// halen is slaat de opmaak over: negentien foto's op papier is beter
// dan geen rapport omdat er één stuk was.
// ============================================================

import { supabase } from '@/lib/supabase'
import {
  datumInWoorden,
  periodeInWoorden,
  voornamen,
  type Rapportfoto,
  type Rapportgegevens,
  type Rapportpunt,
} from '@/../supabase/functions/verwerker/rapportsjabloon'

const BUCKET_FOTOS = 'werkbon-fotos'

const SELECT = `
  id, bonnummer, projectnaam, adres, postcode, plaats, opdrachtgever,
  opdrachtnummer, inspecteur, datum, geplande_start, geplande_eind,
  opleverdatum, opgeleverd_op,
  opmerkingen_bewoners, extra_werkzaamheden, bijzonderheden,
  opgeleverd_door_profiel:profiles!werkbonnen_opgeleverd_door_fkey ( naam ),
  werkbon_medewerkers ( persoon:personen ( naam ) ),
  taken ( id, titel, voltooid, volgorde ),
  fotos!fotos_werkbon_id_fkey ( id, taak_id, storage_path, fase, created_at )
`

/** Alles wat het rapport nodig heeft, in één ronde. */
export async function haalRapportgegevens(werkbonId: string): Promise<Rapportgegevens> {
  const { data, error } = await supabase
    .from('werkbonnen')
    .select(SELECT)
    .eq('id', werkbonId)
    .maybeSingle()

  if (error) throw new Error(`werkbon lezen mislukt: ${error.message}`)
  if (!data) throw new Error('Deze werkbon bestaat niet (meer).')

  const bon = data as Record<string, any>

  const taken: any[] = [...(bon.taken ?? [])].sort(
    (a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0),
  )
  const alleFotos: any[] = [...(bon.fotos ?? [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  )

  // De foto's één voor één ophalen. Parallel zou sneller zijn, maar dan
  // staan er bij een klus van veertig foto's veertig downloads tegelijk
  // open op een telefoon met een halve streep bereik.
  const beeldPerFoto = new Map<string, Rapportfoto>()
  for (const f of alleFotos) {
    const { data: blob, error: fout } = await supabase.storage
      .from(BUCKET_FOTOS)
      .download(f.storage_path)
    if (fout || !blob) continue
    beeldPerFoto.set(f.id, {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      fase: f.fase ?? null,
    })
  }

  const punten: Rapportpunt[] = taken.map((t) => ({
    titel: t.titel ?? '',
    voltooid: Boolean(t.voltooid),
    fotos: alleFotos
      .filter((f) => f.taak_id === t.id)
      .map((f) => beeldPerFoto.get(f.id))
      .filter(Boolean) as Rapportfoto[],
  }))

  const losseFotos = alleFotos
    .filter((f) => !f.taak_id)
    .map((f) => beeldPerFoto.get(f.id))
    .filter(Boolean) as Rapportfoto[]

  return {
    bonnummer: bon.bonnummer ?? null,
    projectnaam: bon.projectnaam ?? null,
    adres: bon.adres ?? null,
    postcode: bon.postcode ?? null,
    plaats: bon.plaats ?? null,
    opdrachtgever: bon.opdrachtgever ?? null,
    opdrachtnummer: bon.opdrachtnummer ?? null,
    inspecteur: bon.inspecteur ?? null,
    aannemer: 'NMZ',
    opgeleverdOp: datumInWoorden(bon.opleverdatum ?? bon.opgeleverd_op),
    opgeleverdDoor: bon.opgeleverd_door_profiel?.naam ?? null,
    uitvoering: periodeInWoorden(
      bon.geplande_start ?? bon.datum,
      bon.geplande_eind ?? bon.geplande_start ?? bon.datum,
    ),
    // Alleen voornamen: dit stuk gaat naar een opdrachtgever.
    ploeg: voornamen(
      (bon.werkbon_medewerkers ?? []).map((wm: any) => wm.persoon?.naam).filter(Boolean),
    ),
    opmerkingenBewoners: bon.opmerkingen_bewoners ?? null,
    extraWerkzaamheden: bon.extra_werkzaamheden ?? null,
    bijzonderheden: bon.bijzonderheden ?? null,
    punten,
    losseFotos,
  }
}

/** Een nette bestandsnaam: het adres, zonder rare tekens. */
export function rapportBestandsnaam(g: Rapportgegevens): string {
  const adres = String(g.adres ?? 'opleverrapport')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `opleverrapport-${adres || 'werkbon'}.pdf`
}

/**
 * Het rapport maken en aan de gebruiker geven.
 *
 * Via een blob en een link: het document is hier al, en er is geen
 * reden om het eerst ergens heen te sturen om het daarna terug te
 * krijgen. Zelfde patroon als de CSV-export in `lib/export.ts`.
 */
export async function downloadOpleverrapport(werkbonId: string): Promise<{ fotos: number }> {
  const gegevens = await haalRapportgegevens(werkbonId)

  // pdf-lib pas ophalen als iemand echt op de knop drukt. Statisch
  // geïmporteerd kwam hij in de bundel van de werkbondetailpagina
  // terecht — het scherm dat de ploeg de hele dag op een telefoon
  // openslaat, en dat is niet de plek voor een halve megabyte die de
  // meesten van hen nooit gebruiken.
  const { bouwRapportPdf } = await import('@/lib/rapportpdf')
  const bytes = await bouwRapportPdf(gegevens)

  // `slice()` maakt er een gewone ArrayBuffer van; pdf-lib geeft een
  // Uint8Array terug waarvan de buffer ook gedeeld kan zijn, en dat
  // accepteert Blob niet.
  const url = URL.createObjectURL(
    new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = rapportBestandsnaam(gegevens)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  const fotos = gegevens.punten.reduce((n, p) => n + p.fotos.length, 0) + gegevens.losseFotos.length
  return { fotos }
}

/**
 * Zoeken in klussen.
 *
 * Waarom dit een eigen bestand is en geen regel in een filter: het
 * zoekveld stond op drie schermen, en alle drie keken ze naar iets
 * anders. Werkbonnen keek naar adres, projectnaam en medewerker. Die
 * projectnaam is sinds de ClickUp-koppeling bij elke bon leeg, dus in de
 * praktijk waren het er twee. Wie "Assendelft" intypte kreeg niets,
 * terwijl daar vier klussen staan — de plaats zit namelijk in een eigen
 * kolom en niet in `adres`. Hetzelfde geldt voor een bonnummer en een
 * postcode.
 *
 * Wat mensen hier intypen komt uit een telefoongesprek: een straatnaam,
 * een plaats, een postcode van een briefje, een naam van een collega, of
 * het nummer dat de opdrachtgever noemt. Al die dingen horen te werken,
 * en welk scherm je toevallig openhad hoort niet uit te maken.
 */

/** Alles waarop je een klus kunt terugvinden. Losse velden mogen leeg zijn. */
export interface Doorzoekbaar {
  adres?: string | null
  plaats?: string | null
  postcode?: string | null
  projectnaam?: string | null
  opdrachtnummer?: string | null
  bonnummer?: string | null
  opdrachtgever?: string | null
  kluiscode?: string | null
  inspecteur?: string | null
  medewerkers?: { naam: string }[] | null
}

/**
 * Alles wat vergeleken wordt, plat en kleingemaakt.
 *
 * Spaties gaan er niet uit: dan wordt "1234 AB" nog steeds gevonden als
 * je "1234AB" typt, maar blijft "Jan" ook los van "Janssen" te
 * onderscheiden. Zie `normaliseer` hieronder — die haalt spaties weg aan
 * beide kanten voor precies dat postcodegeval.
 */
function velden(item: Doorzoekbaar): string[] {
  return [
    item.adres,
    item.plaats,
    item.postcode,
    item.projectnaam,
    item.opdrachtnummer,
    item.bonnummer,
    item.opdrachtgever,
    item.kluiscode,
    item.inspecteur,
    ...(item.medewerkers ?? []).map((m) => m.naam),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/**
 * Kleine letters, en spaties eruit.
 *
 * De spaties eruit is er voor postcodes: in de database staat "1566 AB",
 * mensen typen "1566ab". Dat is geen randgeval maar de normale manier
 * waarop iemand een postcode overtypt.
 */
function normaliseer(tekst: string): string {
  return tekst.toLowerCase().replace(/\s+/g, '')
}

/**
 * Matcht een klus tegen een zoekterm.
 *
 * Meerdere woorden betekent: alle woorden moeten ergens voorkomen, maar
 * niet per se in hetzelfde veld. "assendelft mario" vindt dus de klus in
 * Assendelft waar Mario op staat, en niets anders. Dat is hoe iemand een
 * lijst terugbrengt tot één regel zonder filters aan te klikken.
 *
 * Lege zoekterm geeft `true`: geen zoekterm is geen filter.
 */
export function zoektMee(item: Doorzoekbaar, zoekterm: string): boolean {
  const woorden = zoekterm.trim().split(/\s+/).filter(Boolean).map(normaliseer)
  if (woorden.length === 0) return true

  const hooiberg = velden(item).map(normaliseer)
  return woorden.every((woord) => hooiberg.some((veld) => veld.includes(woord)))
}

/** Filtert een lijst. Bij een lege zoekterm blijft de lijst zoals hij is. */
export function filterOpZoek<T extends Doorzoekbaar>(items: T[], zoekterm: string): T[] {
  if (zoekterm.trim() === '') return items
  return items.filter((item) => zoektMee(item, zoekterm))
}

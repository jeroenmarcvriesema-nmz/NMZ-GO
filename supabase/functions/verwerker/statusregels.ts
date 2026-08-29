// NMZ GO — van een reden naar een ClickUp-status
//
// Losse module zonder afhankelijkheden, om dezelfde reden als
// ontleden.ts: dit is een regel die klopt of niet klopt, en dat hoort
// een test te bewaken in plaats van de eerste keer dat iemand op
// "stilleggen" drukt.

export interface Statussen {
  status_opgeleverd: string | null
  status_wacht_op_fotos: string | null
  status_stilgelegd: string | null
  status_asbest: string | null
  status_opnieuw_inplannen: string | null
  status_spuiten_isoleren: string | null
}

/**
 * Welke ClickUp-status hoort bij een stilgelegde klus?
 *
 * De reden blijft vrije tekst — wie een klus stillegt heeft haast en
 * moet kunnen opschrijven wat er is. De knoppen op het scherm zetten er
 * een vast woord vóór, zodat de veelgebruikte gevallen niet van een
 * typefout afhangen; wie zelf typt komt langs dezelfde regels.
 * Herkent de tekst niets bijzonders, dan is het gewoon "on hold" — dat
 * is de eerlijke uitkomst en niet een gok.
 *
 * De volgorde is de volgorde waarin de feiten zwaarder wegen:
 *
 *   1. asbest              — er hangt een andere procedure aan, met een
 *                            inventarisatie en mogelijk een
 *                            gecertificeerde saneerder. Staat er
 *                            "asbest gevonden, moet opnieuw ingepland",
 *                            dan is asbest het feit dat telt.
 *   2. nog spuiten/isoleren — zegt wélk werk er nog ligt, en dus wie er
 *                            straks ingepland moet worden. Dat weegt
 *                            zwaarder dan "later", want dat zegt alleen
 *                            wanneer.
 *   3. opnieuw inplannen    — de klus blijft heel, hij wacht op een
 *                            datum.
 *   4. de rest              — on hold.
 */
export function statusUitReden(reden: string, s: Statussen): string {
  const tekst = normaliseer(reden)
  if (tekst.includes('asbest')) {
    return s.status_asbest ?? s.status_stilgelegd ?? 'on hold'
  }
  if (SPUITEN_ISOLEREN.test(tekst)) {
    return s.status_spuiten_isoleren ?? s.status_stilgelegd ?? 'on hold'
  }
  if (tekst.includes('opnieuw inplannen') || tekst.includes('opnieuw plannen')) {
    return s.status_opnieuw_inplannen ?? s.status_stilgelegd ?? 'on hold'
  }
  return s.status_stilgelegd ?? 'on hold'
}

/**
 * Kleine letters zonder accenten.
 *
 * Nodig omdat "geïsoleerd" met een trema wordt geschreven en
 * `includes('isole')` daar dus overheen kijkt: de ï is een ander teken
 * dan de i. Iemand die met natte handschoenen op een telefoon typt
 * hoort daar niet op af te ketsen.
 */
function normaliseer(tekst: string): string {
  return (tekst ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * De woorden waarmee iemand "er moet nog gespoten of geïsoleerd worden"
 * opschrijft.
 *
 * Nederlands vervoegt onregelmatig: spuiten wordt gespoten, isoleren
 * wordt geïsoleerd. Alleen op de knoptekst matchen zou werken zolang
 * iedereen de knop gebruikt — maar de reden blijft vrije tekst, en juist
 * daar wordt het anders opgeschreven.
 *
 * `isole` dekt isoleren, geïsoleerd en isolatie in één. In dit domein
 * gaat dat altijd over hetzelfde werk.
 */
const SPUITEN_ISOLEREN = /spuit|spoot|spoten|isole/

// ── De andere kant op ─────────────────────────────────────────

/**
 * Wat een ClickUp-status over de stand van de klus zegt.
 *
 * `loopt` is niet "bezig": het zegt alleen dat de klus gewoon op de
 * planning staat en dus niet stilligt. Wat er in GO wél gebeurt is aan
 * de zwamsaneerder — dit is de afwezigheid van een bijzonderheid.
 */
export type Stand =
  | 'opgeleverd'
  | 'stilgelegd'
  | 'spuiten_isoleren'
  | 'opnieuw_inplannen'
  | 'loopt'

export interface Standregels extends Statussen {
  trigger_status: string
  trigger_statussen: string[] | null
}

/**
 * Van een ClickUp-status naar een stand in NMZ GO — de omgekeerde weg
 * van `statusUitReden`.
 *
 * Nodig omdat niet iedereen in de app werkt. Kantoor zet een taak in
 * ClickUp op "opgeleverd" en die klus blijft in GO op "nog niet
 * gestart" staan, want de synchronisatie las de status wel maar deed
 * er niets mee. Dat verschil werd alleen groter.
 *
 * Twee dingen die deze functie bewust *niet* doet:
 *
 *   1. Gokken. Alleen de statussen die in `clickup_instellingen` staan
 *      krijgen een betekenis. Een lijst met veertien statussen bevat
 *      er een stuk of vijf die iets over de uitvoering zeggen; de
 *      rest ("toekomst", "niet af", "update vereist") is planning van
 *      kantoor en gaat NMZ GO niet aan. Die leveren `null` op, en
 *      `null` betekent hier: laat de werkbon met rust.
 *
 *   2. `wacht op foto's` teruglezen. Die status zet GO zélf op het
 *      bord bij het opleveren, als het fotobewijs nog niet bij ClickUp
 *      staat (zie `statusBijwerken`). Hem terugvertalen naar een stand
 *      betekent je eigen echo inlezen en daarmee een lus bouwen die
 *      bij elke ronde een rondje verder draait.
 *
 * De volgorde is die van `statusUitReden`, om dezelfde reden: het
 * bijzondere geval eerst. Zou een tenant twee kolommen op dezelfde
 * tekst zetten, dan wint hier de zwaarste betekenis in plaats van
 * toevallig de eerste in het record.
 */
export function standUitStatus(status: string, s: Standregels): Stand | null {
  const t = normaliseerStatus(status)
  if (t === '') return null

  const gelijk = (waarde: string | null): boolean =>
    waarde != null && normaliseerStatus(waarde) === t

  // Eerst de echo van onszelf wegfilteren, vóór alle andere regels.
  // Staat "wacht op foto's" bij een tenant per ongeluk op dezelfde
  // tekst als "opgeleverd", dan is niets doen de veilige uitkomst.
  if (gelijk(s.status_wacht_op_fotos)) return null

  if (gelijk(s.status_opgeleverd)) return 'opgeleverd'
  if (gelijk(s.status_asbest)) return 'stilgelegd'
  if (gelijk(s.status_spuiten_isoleren)) return 'spuiten_isoleren'
  if (gelijk(s.status_opnieuw_inplannen)) return 'opnieuw_inplannen'
  if (gelijk(s.status_stilgelegd)) return 'stilgelegd'

  const triggers = s.trigger_statussen?.length
    ? s.trigger_statussen
    : [s.trigger_status]
  if (triggers.some(gelijk)) return 'loopt'

  return null
}

/**
 * Statussen vergelijkbaar maken.
 *
 * Bovenop wat `normaliseer` doet: de kromme apostrof gelijkschakelen
 * aan de rechte. ClickUp geeft "wacht op foto's" terug zoals het is
 * ingetypt, en of daar een ' of een ’ staat hangt af van het
 * toetsenbord van wie de status heeft aangemaakt. Twee statussen die
 * op het scherm identiek zijn horen hier niet uit elkaar te vallen.
 */
function normaliseerStatus(tekst: string): string {
  return (tekst ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

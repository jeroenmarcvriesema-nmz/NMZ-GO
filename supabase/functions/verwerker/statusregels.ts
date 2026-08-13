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

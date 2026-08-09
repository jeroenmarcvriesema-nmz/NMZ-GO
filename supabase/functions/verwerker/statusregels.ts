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
}

/**
 * Welke ClickUp-status hoort bij een stilgelegde klus?
 *
 * Geen keuzelijst in het scherm — wie een klus stillegt heeft haast en
 * moet kunnen opschrijven wat er is. De status volgt uit de tekst.
 * Herkent de tekst niets bijzonders, dan is het gewoon "on hold"; dat
 * is de eerlijke uitkomst en niet een gok.
 *
 * Asbest gaat vóór opnieuw inplannen. Staat er "asbest gevonden, moet
 * opnieuw ingepland", dan is asbest het feit dat telt: daar hangt een
 * andere procedure aan.
 */
export function statusUitReden(reden: string, s: Statussen): string {
  const tekst = (reden ?? '').toLowerCase()
  if (tekst.includes('asbest')) {
    return s.status_asbest ?? s.status_stilgelegd ?? 'on hold'
  }
  if (tekst.includes('opnieuw inplannen') || tekst.includes('opnieuw plannen')) {
    return s.status_opnieuw_inplannen ?? s.status_stilgelegd ?? 'on hold'
  }
  return s.status_stilgelegd ?? 'on hold'
}

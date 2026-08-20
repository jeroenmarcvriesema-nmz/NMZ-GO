// ============================================================
// NMZ GO — van een ClickUp-tijdstempel naar een werkdag
// ============================================================
// Losse module zonder afhankelijkheden, om dezelfde reden als
// ontleden.ts en statusregels.ts: dit is een regel die klopt of niet
// klopt, en dat hoort een test te bewaken.
//
// ── De fout die dit bestand bestaansrecht geeft ──
// De omzetting was `new Date(ms).toISOString().split('T')[0]`: afkappen
// in UTC. Dat gaat goed zolang een tijdstempel midden op de dag valt,
// en het gaat mis bij precies het geval dat het vaakst voorkomt.
//
// ClickUp bewaart een datumveld op middernacht in de tijdzone van de
// werkruimte. Voor Amsterdam in de zomer is dat 22:00 UTC — de dág
// ervóór. Afkappen in UTC leverde dus systematisch een dag te vroeg op.
//
// Concreet, bij Belgradostraat 13: de opdracht zegt "10-08-2026 08:00
// uur t/m 11-08-2026", het veld staat op 1786312800000, en dat werd
// 9 augustus. De ploeg stond in de planning een dag eerder dan de
// afspraak met de bewoner. Bij vijftien van de zevenenvijftig bonnen
// weken de twee datumbronnen af, en negen daarvan precies één dag.
//
// Een dag te vroeg is geen afrondingsverschil. Het is een busje voor
// een deur waar niemand opendoet.
// ============================================================

/** De tijdzone waarin bij NMZ gepland en gewerkt wordt. */
export const WERKZONE = 'Europe/Amsterdam'

/**
 * Een ClickUp-tijdstempel als kalenderdag, gezien vanuit Nederland.
 *
 * `en-CA` levert `YYYY-MM-DD`, precies het formaat dat de database
 * wil, en `Intl` doet de zomertijd zelf — inclusief de twee dagen per
 * jaar waarop de klok verspringt. Dat met de hand uitrekenen is
 * dezelfde soort fout als hierboven, maar dan eentje die je pas in
 * oktober ziet.
 */
export function datumInWerkzone(ms: unknown): string | null {
  if (ms === null || ms === undefined || ms === '') return null
  const n = Number(ms)
  if (!Number.isFinite(n)) return null

  const d = new Date(n)
  if (Number.isNaN(d.getTime())) return null

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WERKZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

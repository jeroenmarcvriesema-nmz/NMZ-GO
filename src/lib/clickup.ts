/**
 * De ClickUp-taak-id uit wat iemand plakt.
 *
 * Kantoor kopieert zelden een kaal id — het is een link uit de
 * adresbalk, of een "copy link" uit ClickUp met een vraagteken erachter.
 * Alle drie de vormen horen te werken, want de vierde optie is dat
 * iemand het id met de hand overtypt en zich vergist.
 *
 * Staat los van het scherm zodat een test hem kan draaien zonder dat de
 * Supabase-client geladen hoeft te worden.
 */
export function taakIdUit(invoer: string): string | null {
  const tekst = (invoer ?? '').trim()
  if (!tekst) return null

  // https://app.clickup.com/t/86cayvbnd  of  .../t/9012345/86cayvbnd?x=1
  const uitLink = tekst.match(/\/t\/(?:[^/?#]+\/)?([a-z0-9]+)/i)
  if (uitLink) return uitLink[1]

  // Kaal id. ClickUp-id's zijn kleine letters en cijfers.
  if (/^[a-z0-9]{6,}$/i.test(tekst)) return tekst

  return null
}

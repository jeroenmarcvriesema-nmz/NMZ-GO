/**
 * Rommel van browserextensies, en niet van ons.
 *
 * Een wallet-extensie als MetaMask injecteert zich in élke pagina en
 * roept "failed to connect" zodra hij niets vindt. Dat is geen storing
 * in NMZ GO en het hoort niet in de storingenlijst van kantoor: die
 * lijst is alleen iets waard als alles wat erin staat ook echt van ons
 * is. Eén keer volgelopen met extensiemeldingen en niemand kijkt er
 * ooit nog naar.
 *
 * Losse module zonder afhankelijkheden, zodat een test hem kan draaien
 * zonder dat de Supabase-client geladen wordt.
 */
const NIET_VAN_ONS = [
  /metamask/i,
  /\bethereum\b/i,
  /\bweb3\b/i,
  /solana|phantom|coinbase wallet/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-(web-)?extension:\/\//i,
  // Een scriptfout van een ander domein komt binnen zonder inhoud.
  // Daar valt niets mee te beginnen en het zegt niets over onze code.
  /^script error\.?$/i,
  // Een afgebroken netwerkverzoek doordat iemand wegnavigeert of zijn
  // scherm op slot doet. Gebeurt in een kruipruimte de hele dag.
  /^the operation was aborted/i,
]

/** Is deze fout van onze eigen app, of van iets wat erin is geïnjecteerd? */
export function vanOnsZelf(boodschap: string, stack: string | null = null): boolean {
  // Boodschap en stack apart toetsen. Ze aan elkaar plakken zou een
  // patroon dat op het einde van de regel ankert ("^script error$")
  // laten missen zodra er een stack achter staat — of een spatie.
  const boodschapSchoon = (boodschap ?? '').trim()
  const stackSchoon = (stack ?? '').trim()
  return !NIET_VAN_ONS.some((p) => p.test(boodschapSchoon) || (stackSchoon !== '' && p.test(stackSchoon)))
}

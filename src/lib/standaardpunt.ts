// ============================================================
// NMZ GO — het punt dat vóór alles gaat
// ============================================================
// Op elke werkbon staat één punt dat NMZ GO er zelf bij zet: het rode
// gevarenblad op de voordeur en/of het raam (migratie 045). Dat hoort
// te gebeuren voordat er binnen iets gebeurt, dus houdt het de rest
// tegen.
//
// De regel staat hier en niet in een scherm, om dezelfde reden als
// `klusstand()`: hij wordt op meer dan één plek gesteld, en twee
// schermen die hem elk zelf uitrekenen zijn twee schermen die uit
// elkaar gaan lopen. De database weigert het óók (een trigger op
// `taken`); dit is wat het scherm ervan laat zien.
//
// Twee dingen die deze regel bewust niet doet:
//
//   ● **Naar de titel kijken.** Er is een vlag `standaard` voor. Een
//     tekst die ooit anders wordt geschreven zou deze regel stil
//     onwaar maken, en stil onwaar is de gevaarlijkste vorm.
//   ● **Naar foto's kijken.** Foto's zeggen iets over de fotoplicht op
//     een punt en niets over de volgorde. Een punt met vijf foto's
//     eronder blijft op slot zolang het blad niet hangt — dat is de
//     hele afspraak, en het is precies de verwarring waar dit tegen
//     beschermt: bewijs verzamelen mag altijd, afvinken pas daarna.
// ============================================================

/** Genoeg van een punt om te weten of het de rest tegenhoudt. */
export interface Punt {
  voltooid: boolean
  standaard?: boolean | null
}

/**
 * Het standaardpunt dat nog openstaat, of `null`.
 *
 * `null` betekent: niets in de weg. Dat geldt ook voor de bonnen van
 * vóór migratie 045 — die hebben geen standaardpunt en houden dus
 * niets tegen. Hun werk was al aan de gang toen de regel er kwam.
 */
export function openStandaardpunt<T extends Punt>(punten: readonly T[]): T | null {
  return punten.find((p) => p.standaard && !p.voltooid) ?? null
}

/**
 * Mag dit punt afgevinkt worden, gelet op de volgorde?
 *
 * Alleen de volgorde. Of er een foto onder moet is een andere vraag
 * met een ander antwoord (`foto_vereist`), en die twee horen niet in
 * elkaar geschoven te worden: dan zou een foto uploaden een punt
 * kunnen vrijspelen dat op de volgorde vastzit.
 *
 * Het standaardpunt zelf mag altijd — anders zou het zichzelf
 * tegenhouden en stond de hele bon op slot.
 */
export function magAfvinkenOpVolgorde<T extends Punt>(punt: T, punten: readonly T[]): boolean {
  if (punt.standaard) return true
  return openStandaardpunt(punten) === null
}

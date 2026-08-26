// ============================================================
// NMZ GO — waar stond iemand toen hij zich aanmeldde
// ============================================================
// Dit legt vast, het houdt niets tegen. Aanmelden lukt altijd, ook
// zonder toestemming, zonder signaal of met een telefoon die het even
// niet weet. De afstand is een signaal voor kantoor en geen slot op de
// deur — zie migratie 040.
//
// Daarom staat alles hier achter een korte tijdslimiet en vangt alles
// zijn eigen fouten op: het ergste wat er mag gebeuren is dat er geen
// positie wordt vastgelegd.
// ============================================================

/**
 * Staat de afstandsmeting aan?
 *
 * Uit. Bewust één schakelaar en geen half verwijderde functie: de
 * tabellen, de policies en de berekening blijven staan, er wordt alleen
 * niets opgehaald en niets verstuurd. Aanzetten is deze regel op `true`
 * en uitrollen.
 *
 * Waarom hij uit staat: het meten van de locatie van een werknemer
 * vraagt om een grondslag die is opgeschreven, instemming van de
 * personeelsvertegenwoordiging en een plek in het personeelsreglement.
 * Dat is geen formaliteit achteraf — zonder dat is de meting zelf niet
 * te verantwoorden, hoe zorgvuldig hij technisch ook is opgezet. Zie
 * `.ai/PRIVACY_LOCATIE.md` voor de lijst.
 *
 * Zolang dit `false` is vraagt de app niet om toestemming voor locatie,
 * haalt hij geen positie op en schrijft hij niets weg. Er valt dus ook
 * niets te wissen als het langer uit blijft.
 */
export const LOCATIE_AAN = false

export interface Positie {
  lat: number
  lon: number
  nauwkeurigheid: number | null
}

/**
 * Zo lang wachten we op de telefoon, en niet langer.
 *
 * Een eerste bepaling kan op een koude telefoon tientallen seconden
 * duren. Zo lang wachten voordat er iets wordt vastgelegd is prima —
 * er wacht niemand op — maar oneindig wachten houdt een openstaande
 * belofte in de lucht die nooit meer landt.
 */
const WACHTTIJD_MS = 20_000

/**
 * De huidige positie, of niets.
 *
 * Geeft bewust nooit een fout terug. Wie zich aanmeldt in een
 * kruipruimte zonder ontvangst hoort daar niets van te merken.
 */
export function haalPositie(): Promise<Positie | null> {
  // Staat de functie uit, dan komt de toestemmingsvraag niet eens in
  // beeld. Dat is het verschil tussen "wij meten niet" en "wij meten
  // wel maar doen er niets mee".
  if (!LOCATIE_AAN) return Promise.resolve(null)

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }

  return new Promise((klaar) => {
    let afgehandeld = false
    const eenmalig = (p: Positie | null) => {
      if (afgehandeld) return
      afgehandeld = true
      klaar(p)
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => eenmalig({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        // Kan ontbreken op sommige toestellen; dan weten we het niet,
        // en dat is iets anders dan nul.
        nauwkeurigheid: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      }),
      () => eenmalig(null),
      {
        enableHighAccuracy: true,
        timeout: WACHTTIJD_MS,
        // Een kwartier oude bepaling is voor deze vraag prima en scheelt
        // de monteur een wachttijd bij het inklokken.
        maximumAge: 15 * 60 * 1000,
      },
    )

    // Vangnet: sommige browsers roepen geen van beide functies aan als
    // de toestemmingsvraag blijft hangen.
    setTimeout(() => eenmalig(null), WACHTTIJD_MS + 2_000)
  })
}

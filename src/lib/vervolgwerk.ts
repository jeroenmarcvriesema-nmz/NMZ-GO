// ============================================================
// NMZ GO — vervolgwerk is geen stilstand
// ============================================================
// Twee van de vier knoppen op de werkbon legden de klus stil terwijl
// dat niet zo is. "Nog spuiten/isoleren" betekent dat het grondwerk
// klaar is en er nog gespoten of geïsoleerd moet worden; "opnieuw
// inplannen/later" dat er een nieuwe datum komt. In allebei de gevallen
// loopt de klus door — het zijn statussen op het bord in ClickUp, geen
// toestand van de klus hier.
//
// Toch zetten ze `stilgelegd_op`, en `klusstand()` leest die kolom als
// eerste. Gevolg: het kaartje werd rood met "Ligt stil", op de planning,
// op het dashboard en in de containerlijst. Woorden van de eigenaar:
// "dat is niet zo namelijk". Migratie 035 haalt dat uit elkaar en zet
// het in `werkbonnen.vervolg_soort`.
//
// Deze woordenlijst staat los van de knop die hem zet, zodat het scherm
// van de zwamsaneerder hem kan gebruiken zonder de hele kantoorkaart
// mee zijn bundel in te trekken.
// ============================================================

export type Vervolgsoort = 'spuiten_isoleren' | 'opnieuw_inplannen'

/** Hoe het op het scherm heet — dezelfde woorden als op het bord. */
export const VERVOLG_LABEL: Record<Vervolgsoort, string> = {
  spuiten_isoleren: 'Nog spuiten/isoleren',
  opnieuw_inplannen: 'Opnieuw inplannen/later',
}

/**
 * Het label, ook als er iets onbekends in de kolom staat.
 *
 * De kolom heeft een check-constraint, dus dit hoort niet voor te
 * komen — maar een scherm dat leegloopt op een waarde die het niet kent
 * is erger dan een scherm dat "Vervolgwerk gemeld" zegt.
 */
export function vervolgLabel(soort: string | null | undefined): string | null {
  if (!soort) return null
  return VERVOLG_LABEL[soort as Vervolgsoort] ?? 'Vervolgwerk gemeld'
}

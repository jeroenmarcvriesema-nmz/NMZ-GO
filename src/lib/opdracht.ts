// ============================================================
// NMZ GO — punten uit een werkopdracht
// ============================================================
// Twee manieren om aan een takenlijst te komen zonder hem over te
// typen: tekst plakken, of de werkopdracht-PDF aanreiken. Het lezen van
// die PDF gebeurt in de edge function `opdracht-lezen`, die dezelfde
// parser gebruikt als de ClickUp-route — zodat dezelfde opdracht
// dezelfde punten oplevert, of hij nu automatisch binnenkomt of met de
// hand wordt aangereikt.
//
// Hier staat alleen wat zonder netwerk werkt: de herkenning van losse
// punten en het omzetten van het antwoord van de functie. Dat is geen
// esthetiek maar een vereiste — dit is het deel dat een test kan
// draaien, en het is precies het deel waar de fouten in zitten. Het
// versturen zelf staat in `useWerkbonDocumenten`.
// ============================================================

/** Gelijk aan de limiet van de bucket werkbon-documenten (migratie 012). */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

/** Klopt het bestand voordat het het netwerk op gaat? */
export function controleerDocument(bestand: File): string | null {
  if (bestand.type !== 'application/pdf') return 'Alleen een PDF-bestand kan hier bij.'
  if (bestand.size > MAX_DOCUMENT_BYTES) return 'Het bestand is groter dan 25 MB.'
  return null
}

/**
 * Losse punten uit vrije tekst: genummerd of met een opsommingsteken.
 *
 * Dit is de herkenning achter het tabblad "Gripp import" en, als
 * terugval, achter een PDF die het NMZ-sjabloon niet volgt. Een regel
 * zonder teken telt niet mee — anders wordt elke tussenkop een taak.
 */
export function herkenPunten(tekst: string): string[] {
  const punten: string[] = []
  tekst.split('\n').forEach((regel) => {
    const s = regel.trim()
    if (!s) return
    const match = s.match(/^(?:\d+[.)\s]|[-•*→]\s*)(.+)/)
    if (match) punten.push(match[1].trim())
  })
  return punten
}

/**
 * Wat er uit een werkopdracht-PDF komt.
 *
 * `sjabloon` zegt of het een echte NMZ-werkopdracht was. Zo ja, dan
 * staan de kopvelden erbij en zijn de punten door de beproefde parser
 * gegaan. Zo nee, dan is er alleen op opsommingstekens gegokt en hoort
 * het scherm dat eerlijk te melden.
 */
export interface GelezenOpdracht {
  sjabloon: boolean
  punten: string[]
  /** Punten die bewust zijn overgeslagen (parkeerkosten en dergelijke). */
  weggelaten: string[]
  werkvoorbereiding: string | null
  opdrachtnummer: string | null
  adres: string | null
  inspecteur: string | null
  inspecteurTelefoon: string | null
  kluiscode: string | null
  /** Waarom het sjabloon niet herkend werd. Alleen gevuld als `sjabloon` onwaar is. */
  reden: string | null
}

/** Het ruwe antwoord van de edge function `opdracht-lezen`. */
export interface OpdrachtAntwoord {
  sjabloon?: boolean
  punten?: string[]
  weggelaten?: string[]
  werkvoorbereiding?: string | null
  opdrachtnummer?: string | null
  adres?: string | null
  inspecteur?: string | null
  inspecteurTelefoon?: string | null
  kluiscode?: string | null
  regels?: string[]
  reden?: string
  fout?: string
}

/**
 * Het antwoord van de functie omzetten naar iets waar een scherm mee
 * kan: precies één van de twee velden is gevuld.
 */
export function verwerkAntwoord(
  data: OpdrachtAntwoord | null,
): { opdracht: GelezenOpdracht | null; fout: string | null } {
  if (!data) return { opdracht: null, fout: 'De werkopdracht leverde geen antwoord op.' }
  if (data.fout) return { opdracht: null, fout: data.fout }

  // Het sjabloon is herkend: de punten komen van de parser.
  if (data.sjabloon) {
    return {
      opdracht: {
        sjabloon: true,
        punten: data.punten ?? [],
        weggelaten: data.weggelaten ?? [],
        werkvoorbereiding: data.werkvoorbereiding ?? null,
        opdrachtnummer: data.opdrachtnummer ?? null,
        adres: data.adres ?? null,
        inspecteur: data.inspecteur ?? null,
        inspecteurTelefoon: data.inspecteurTelefoon ?? null,
        kluiscode: data.kluiscode ?? null,
        reden: null,
      },
      fout: null,
    }
  }

  // Terugval: geen NMZ-sjabloon, dus dezelfde herkenning als bij
  // geplakte tekst, over de ruwe regels.
  const punten = herkenPunten((data.regels ?? []).join('\n'))
  if (punten.length === 0) {
    return {
      opdracht: null,
      fout: 'Er zijn geen punten herkend in deze PDF. ' +
            (data.reden ?? 'Waarschijnlijk wijkt hij af van het sjabloon.'),
    }
  }

  return {
    opdracht: {
      sjabloon: false,
      punten,
      weggelaten: [],
      werkvoorbereiding: null,
      opdrachtnummer: null,
      adres: null,
      inspecteur: null,
      inspecteurTelefoon: null,
      kluiscode: null,
      reden: data.reden ?? null,
    },
    fout: null,
  }
}

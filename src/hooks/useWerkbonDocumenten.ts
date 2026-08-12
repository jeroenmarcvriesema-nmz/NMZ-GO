import { supabase } from '@/lib/supabase'
import {
  controleerDocument, verwerkAntwoord,
  type GelezenOpdracht, type OpdrachtAntwoord,
} from '@/lib/opdracht'

/**
 * De twee PDF's die bij een klus horen: de werkopdracht en de
 * werktekening.
 *
 * Ze bestonden al — de ClickUp-synchronisatie zet ze in de besloten
 * bucket `werkbon-documenten` en de knoppen ervoor staan op de bon
 * (`Klusinfo`). Alleen kon niemand ze er zelf bij zetten, en een klus
 * die niet uit ClickUp komt heeft ze dus nooit. Deze hook is precies
 * dat ontbrekende stuk: dezelfde bucket, dezelfde padopbouw en
 * dezelfde bestandsnamen als de synchronisatie gebruikt, zodat het
 * scherm het verschil niet hoeft te kennen.
 */
export type Documentsoort = 'werkopdracht' | 'werktekening'

const KOLOM: Record<Documentsoort, 'opdracht_pad' | 'tekening_pad'> = {
  werkopdracht: 'opdracht_pad',
  werktekening: 'tekening_pad',
}

const BESTANDSNAAM: Record<Documentsoort, string> = {
  werkopdracht: 'werkopdracht.pdf',
  werktekening: 'werktekening.pdf',
}

export const DOCUMENT_LABEL: Record<Documentsoort, string> = {
  werkopdracht: 'De werkopdracht',
  werktekening: 'De werktekening',
}

export function useWerkbonDocumenten() {
  /**
   * De PDF opslaan en het pad op de werkbon zetten.
   *
   * Dezelfde naam bij een tweede upload, met `upsert`: vervangen hoort
   * te vervangen, niet twee bestanden achter te laten waarvan er één
   * nergens meer bij hoort. `cacheControl` op nul omdat het pad
   * gelijkblijft — anders kan een ondertekende link nog een uur lang de
   * oude tekening opleveren, en dat is precies de fout die niemand op
   * een dak wil ontdekken.
   */
  const upload = async (
    werkbonId: string,
    soort: Documentsoort,
    bestand: File,
  ): Promise<{ pad: string | null; fout: string | null }> => {
    const bezwaar = controleerDocument(bestand)
    if (bezwaar) return { pad: null, fout: bezwaar }

    const pad = `${werkbonId}/${BESTANDSNAAM[soort]}`

    const { error: opslagFout } = await supabase.storage
      .from('werkbon-documenten')
      .upload(pad, bestand, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '0',
      })

    if (opslagFout) {
      return { pad: null, fout: `${DOCUMENT_LABEL[soort]} kon niet worden opgeslagen.` }
    }

    // Zonder deze regel staat het bestand er wel, maar wijst niets op
    // de bon ernaar en ziet niemand het.
    const { error: bonFout } = await supabase
      .from('werkbonnen')
      .update({ [KOLOM[soort]]: pad })
      .eq('id', werkbonId)

    if (bonFout) {
      return {
        pad: null,
        fout: `${DOCUMENT_LABEL[soort]} is opgeslagen, maar staat nog niet op de werkbon.`,
      }
    }

    return { pad, fout: null }
  }

  /**
   * Eerst de verwijzing weg, dan het bestand: een bon die naar een
   * verdwenen bestand wijst geeft een knop die niets doet.
   */
  const verwijder = async (
    werkbonId: string,
    soort: Documentsoort,
    pad: string,
  ): Promise<{ fout: string | null }> => {
    const { error: bonFout } = await supabase
      .from('werkbonnen')
      .update({ [KOLOM[soort]]: null })
      .eq('id', werkbonId)

    if (bonFout) return { fout: `${DOCUMENT_LABEL[soort]} kon niet worden losgekoppeld.` }

    await supabase.storage.from('werkbon-documenten').remove([pad])
    return { fout: null }
  }

  /**
   * Een werkopdracht-PDF laten lezen door de edge function.
   *
   * Geeft nooit een exception terug maar altijd één van de twee velden:
   * een fout die op het scherm kan, of een gelezen opdracht. Een
   * mislukte poging mag het aanmaken van een bon nooit blokkeren — met
   * de hand invullen blijft altijd mogelijk.
   */
  const lees = async (
    bestand: File,
  ): Promise<{ opdracht: GelezenOpdracht | null; fout: string | null }> => {
    const bezwaar = controleerDocument(bestand)
    if (bezwaar) return { opdracht: null, fout: bezwaar }

    const { data, error } = await supabase.functions.invoke<OpdrachtAntwoord>('opdracht-lezen', {
      body: bestand,
    })

    if (error) {
      // De functie zet haar uitleg in de body; supabase-js geeft alleen
      // "non-2xx status code" mee. Zonder dit uitpakken krijgt kantoor
      // een melding waar niets uit op te maken valt.
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === 'function') {
        try {
          const body = (await context.json()) as OpdrachtAntwoord
          if (body?.fout) return { opdracht: null, fout: body.fout }
        } catch {
          // Geen leesbare body — dan blijft de algemene melding staan.
        }
      }
      return {
        opdracht: null,
        fout: 'De werkopdracht kon niet gelezen worden. Controleer je verbinding en probeer het opnieuw.',
      }
    }

    return verwerkAntwoord(data ?? null)
  }

  return { upload, verwijder, lees }
}

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { DocumentKiezer } from '@/components/werkbon/DocumentKiezer'
import { useWerkbonDocumenten, DOCUMENT_LABEL, type Documentsoort } from '@/hooks/useWerkbonDocumenten'
import { controleerDocument } from '@/lib/opdracht'
import { toast } from '@/store/toastStore'
import type { Werkbon } from '@/types'

/**
 * De werkopdracht en de werktekening beheren op een bestaande bon.
 *
 * Een klus uit ClickUp krijgt ze vanzelf; een bon die met de hand is
 * gemaakt niet, en soms komt de tekening pas later los. Zonder dit
 * moest zo'n bon opnieuw worden aangemaakt om er één PDF bij te
 * krijgen.
 *
 * Alleen voor kantoor: de zwamsaneerder ziet dezelfde documenten in
 * `Klusinfo`, maar dan als knop om te openen. Wat de database daarvan
 * vindt staat in migratie 012 — schrijven mag alleen wie werk mag
 * beheren.
 */
export function Werkdocumenten({ werkbon, onKlaar }: { werkbon: Werkbon; onKlaar: () => void }) {
  const { upload, verwijder } = useWerkbonDocumenten()
  const [bezig, setBezig] = useState<Documentsoort | null>(null)

  const paden: Record<Documentsoort, string | null> = {
    werkopdracht: werkbon.opdracht_pad ?? null,
    werktekening: werkbon.tekening_pad ?? null,
  }

  const kies = async (soort: Documentsoort, bestand: File) => {
    const bezwaar = controleerDocument(bestand)
    if (bezwaar) { toast.fout(bezwaar); return }

    setBezig(soort)
    const { fout } = await upload(werkbon.id, soort, bestand)
    setBezig(null)

    if (fout) { toast.fout(fout); return }
    toast.goed(`${DOCUMENT_LABEL[soort]} staat op de werkbon.`)
    onKlaar()
  }

  const wis = async (soort: Documentsoort) => {
    const pad = paden[soort]
    if (!pad) return

    setBezig(soort)
    const { fout } = await verwijder(werkbon.id, soort, pad)
    setBezig(null)

    if (fout) { toast.fout(fout); return }
    toast.goed(`${DOCUMENT_LABEL[soort]} is verwijderd.`)
    onKlaar()
  }

  // Het pad is `<werkbon-id>/werkopdracht.pdf`; alleen de bestandsnaam
  // zegt iets tegen wie ernaar kijkt.
  const naam = (soort: Documentsoort) => paden[soort]?.split('/').pop() ?? null

  return (
    <Card>
      <SectionHeading title="Documenten" />
      <p className="text-sm text-gray-500 dark:text-white/50 -mt-2 mb-4">
        De PDF's die de ploeg op locatie opent.
      </p>
      <div className="space-y-3">
        <DocumentKiezer
          label="Werkopdracht (PDF)"
          hint="Nog geen werkopdracht op deze bon"
          waarde={naam('werkopdracht')}
          bezig={bezig === 'werkopdracht'}
          onKies={(bestand) => kies('werkopdracht', bestand)}
          onWis={() => wis('werkopdracht')}
        />
        <DocumentKiezer
          label="Werktekening (PDF)"
          hint="Nog geen tekening op deze bon"
          waarde={naam('werktekening')}
          bezig={bezig === 'werktekening'}
          onKies={(bestand) => kies('werktekening', bestand)}
          onWis={() => wis('werktekening')}
        />
      </div>
    </Card>
  )
}

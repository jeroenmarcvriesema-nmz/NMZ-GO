import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { taakIdUit } from '@/lib/clickup'
import { IconRefresh, IconDownload } from '@tabler/icons-react'

/**
 * Twee knoppen die kantoor tot nu toe miste.
 *
 * De hartslag draait elke vijf minuten, maar er zijn momenten waarop je
 * niet vijf minuten wilt wachten: de werkvoorbereider zet iets klaar en
 * je staat ernaast. En er is werk dat buiten "deze week"/"volgende
 * week" valt en dus nooit binnenkomt — daarvoor moest iemand de status
 * in ClickUp verzetten, wat het planbord voor iedereen verandert.
 */
export function Synchronisatie({ onKlaar }: { onKlaar?: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const toast = useToastStore((s) => s.toon)
  const [bezig, setBezig] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [invoer, setInvoer] = useState('')
  const [importBezig, setImportBezig] = useState(false)

  const nuSynchroniseren = async () => {
    setBezig(true)
    const { data, error } = await supabase.rpc('clickup_hartslag')
    setBezig(false)

    if (error) {
      toast('De synchronisatie kon niet gestart worden: ' + error.message, 'fout')
      return
    }

    // Nul betekent niet "mislukt" maar "er loopt er al een". Dat is het
    // eerlijke antwoord en voorkomt dat iemand blijft drukken.
    toast(
      (data as number) > 0
        ? 'Synchronisatie gestart. Nieuwe klussen staan er binnen een minuut in.'
        : 'Er loopt al een synchronisatie — die is zo klaar.',
      'info',
    )
    onKlaar?.()
  }

  const importeer = async () => {
    const id = taakIdUit(invoer)
    if (!id) {
      toast('Dat lijkt geen ClickUp-taak. Plak de link of het taak-id.', 'fout')
      return
    }
    if (!profile?.tenant_id) return

    setImportBezig(true)
    const { error } = await supabase.rpc('taak_aanmaken', {
      p_soort: 'clickup.taak_importeren',
      p_payload: { tenant_id: profile.tenant_id, clickup_taak_id: id },
    })
    setImportBezig(false)

    if (error) {
      toast('Importeren mislukt: ' + error.message, 'fout')
      return
    }

    setImportOpen(false)
    setInvoer('')
    toast(`Taak ${id} wordt opgehaald. Ververs over een halve minuut.`, 'info')
    onKlaar?.()
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={nuSynchroniseren} disabled={bezig}>
          <IconRefresh className={bezig ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          {bezig ? 'Bezig…' : 'Nu synchroniseren'}
        </Button>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <IconDownload className="w-4 h-4" /> Taak importeren
        </Button>
      </div>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Eén ClickUp-taak ophalen"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-500 dark:text-white/50">
            De automatische ronde kijkt alleen naar <em>deze week</em> en{' '}
            <em>volgende week</em>. Staat een klus op een andere status en moet
            hij tóch de app in, plak hem hier — dan hoef je in ClickUp niets te
            verzetten.
          </p>

          <Input
            label="Link of taak-id"
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            placeholder="https://app.clickup.com/t/86cayvbnd"
            autoFocus
          />

          <p className="text-xs text-gray-400 dark:text-white/40">
            Staat de klus er al in, dan gebeurt er niets dubbels — hij wordt dan
            alleen bijgewerkt.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button className="flex-1" onClick={importeer} disabled={importBezig || !invoer.trim()}>
              {importBezig ? 'Bezig…' : 'Ophalen'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setImportOpen(false)}>
              Annuleren
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

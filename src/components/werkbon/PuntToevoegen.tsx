import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/store/toastStore'
import { IconPlus, IconX, IconCamera, IconCameraOff } from '@tabler/icons-react'

/**
 * Een punt bijzetten op een klus die al loopt.
 *
 * De punten komen uit de werkopdracht-PDF en stonden daarmee vast. In
 * de kruipruimte blijkt geregeld iets extra's nodig — meerwerk dat op
 * de klus zelf wordt afgesproken. Dat hoort op de bon, want anders
 * staat het nergens, wordt er geen foto van gevraagd, en ziet de
 * opdrachtgever het niet terug in het opleverrapport.
 *
 * Gaat níét naar ClickUp. Daar bestaat geen veld voor de punten: de
 * werkopdracht is een PDF en die schrijven we niet opnieuw.
 */
export function PuntToevoegen({ werkbonId, onKlaar }: { werkbonId: string; onKlaar: () => void }) {
  const { magWerkBeheren } = useAuth()
  const [open, setOpen] = useState(false)
  const [titel, setTitel] = useState('')
  const [fotoVereist, setFotoVereist] = useState(true)
  const [bezig, setBezig] = useState(false)

  if (!magWerkBeheren) return null

  const bewaar = async () => {
    if (titel.trim().length < 3) {
      toast.fout('Schrijf op wat er gedaan moet worden.')
      return
    }
    setBezig(true)
    const { error } = await supabase.rpc('werkbon_punt_toevoegen', {
      p_werkbon: werkbonId,
      p_titel: titel.trim(),
      p_foto_vereist: fotoVereist,
    })
    setBezig(false)

    if (error) { toast.fout(error.message || 'Het punt kon niet worden toegevoegd.'); return }

    setTitel('')
    setFotoVereist(true)
    setOpen(false)
    toast.goed('Punt toegevoegd')
    onKlaar()
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="min-h-[44px] mt-2"
        onClick={() => setOpen(true)}>
        <IconPlus className="w-4 h-4" /> Punt toevoegen
      </Button>
    )
  }

  return (
    <div className="mt-3 p-4 rounded-lg border border-dashed border-gray-200 dark:border-white/15">
      <Input
        label="Wat moet er gebeuren?"
        value={titel}
        onChange={(e) => setTitel(e.target.value)}
        placeholder="Bijvoorbeeld: extra balk vervangen bij de meterkast"
      />

      {/* De fotoplicht staat standaard aan, net als bij de punten uit de
          opdracht. Meerwerk is juist het werk waarvan achteraf de vraag
          komt of het echt gedaan is. */}
      <button
        type="button"
        onClick={() => setFotoVereist((v) => !v)}
        className="flex items-center gap-2 mt-3 text-xs font-semibold text-gray-500 dark:text-white/50 min-h-[44px]"
      >
        {fotoVereist
          ? <IconCamera className="w-4 h-4 flex-shrink-0 text-brand-blue" />
          : <IconCameraOff className="w-4 h-4 flex-shrink-0" />}
        {fotoVereist ? 'Foto verplicht' : 'Geen foto nodig'}
      </button>

      <div className="flex flex-wrap gap-2 mt-3">
        <Button variant="primary" size="sm" className="min-h-[44px]" loading={bezig} onClick={bewaar}>
          <IconPlus className="w-4 h-4" /> Toevoegen
        </Button>
        <Button variant="ghost" size="sm" className="min-h-[44px]"
          onClick={() => { setOpen(false); setTitel('') }}>
          <IconX className="w-4 h-4" /> Annuleren
        </Button>
      </div>
    </div>
  )
}

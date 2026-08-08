import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { toast } from '@/store/toastStore'
import type { Werkbon } from '@/types'
import {
  IconKey, IconPhone, IconFileText, IconMap2,
  IconChevronDown, IconChevronUp, IconMapPin,
} from '@tabler/icons-react'

/**
 * Alles wat je nodig hebt vóórdat je begint: hoe kom je binnen, wie bel
 * je, waar staat het, en wat staat er in de opdracht.
 *
 * Dit staat bewust bóven de takenlijst. Iemand die om half acht voor
 * een deur staat zoekt eerst de kluiscode, niet punt één.
 *
 * Ontworpen voor een werktelefoon met werkhandschoenen aan: alles wat
 * je aanraakt is minimaal 44 pixels hoog, de kluiscode is groot genoeg
 * om vanaf een armlengte te lezen, en telefoonnummer en adres zijn
 * aantikbaar zodat er niets overgetypt hoeft te worden.
 */
export function Klusinfo({ werkbon }: { werkbon: Werkbon }) {
  const [uitgeklapt, setUitgeklapt] = useState(false)
  const [bezig, setBezig] = useState<string | null>(null)

  const heeftIets =
    werkbon.kluiscode || werkbon.inspecteur || werkbon.werkvoorbereiding ||
    werkbon.opdracht_pad || werkbon.tekening_pad

  if (!heeftIets) return null

  // De documenten liggen in een besloten bucket, dus een directe link
  // bestaat niet — er moet een tijdelijke link opgehaald worden. Het
  // tabblad gaat open vóór het wachten, anders ziet de telefoon het als
  // een pop-up en blokkeert hij hem.
  const openDocument = async (pad: string, wat: string) => {
    setBezig(pad)
    const tab = window.open('', '_blank')
    const { data, error } = await supabase.storage
      .from('werkbon-documenten')
      .createSignedUrl(pad, 3600)
    setBezig(null)

    if (error || !data?.signedUrl) {
      tab?.close()
      toast.fout(`${wat} kon niet worden geopend. Controleer je verbinding.`)
      return
    }
    if (tab) tab.location.href = data.signedUrl
    else window.location.href = data.signedUrl
  }

  return (
    <Card>
      {werkbon.kluiscode && (
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-brand-yellow-light dark:bg-brand-yellow/15 flex-shrink-0">
            <IconKey className="w-5 h-5 text-brand-yellow-dark dark:text-brand-yellow" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-400 dark:text-white/40">Kluiscode</div>
            {/* Groot en met ruimte tussen de tekens: dit wordt op een
                dak of in een kruipruimte afgelezen, niet aan een bureau. */}
            <div className="text-2xl font-extrabold tracking-widest text-gray-900 dark:text-white">
              {werkbon.kluiscode}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(werkbon.adres)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 text-sm font-semibold text-gray-900 dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
        >
          <IconMapPin className="w-4 h-4 flex-shrink-0" /> Route
        </a>

        {werkbon.inspecteur_telefoon && (
          <a
            href={`tel:${werkbon.inspecteur_telefoon.replace(/\s/g, '')}`}
            className="flex items-center gap-2 min-h-[44px] px-4 rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 text-sm font-semibold text-gray-900 dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
          >
            <IconPhone className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              Bel {werkbon.inspecteur?.split(' ')[0] ?? 'inspecteur'}
            </span>
          </a>
        )}

        {werkbon.opdracht_pad && (
          <Button
            variant="secondary"
            className="min-h-[44px] justify-start"
            loading={bezig === werkbon.opdracht_pad}
            onClick={() => openDocument(werkbon.opdracht_pad!, 'De werkopdracht')}
          >
            <IconFileText className="w-4 h-4" /> Werkopdracht
          </Button>
        )}

        {werkbon.tekening_pad && (
          <Button
            variant="secondary"
            className="min-h-[44px] justify-start"
            loading={bezig === werkbon.tekening_pad}
            onClick={() => openDocument(werkbon.tekening_pad!, 'De tekening')}
          >
            <IconMap2 className="w-4 h-4" /> Tekening
          </Button>
        )}
      </div>

      {werkbon.werkvoorbereiding && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
          {/* Ingeklapt, want het is naslag en geen werk. Wel volledig
              beschikbaar: er staan compartimenten, preparaten en
              bijzonderheden in die je onderweg nodig kunt hebben. */}
          <button
            onClick={() => setUitgeklapt(!uitgeklapt)}
            className="flex items-center justify-between w-full min-h-[44px] text-sm font-semibold text-gray-900 dark:text-white"
          >
            <span>Werkvoorbereiding</span>
            {uitgeklapt
              ? <IconChevronUp className="w-4 h-4 flex-shrink-0" />
              : <IconChevronDown className="w-4 h-4 flex-shrink-0" />}
          </button>
          {uitgeklapt && (
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-600 dark:text-white/60">
              {werkbon.werkvoorbereiding}
            </pre>
          )}
        </div>
      )}
    </Card>
  )
}

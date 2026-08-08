import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useTaken } from '@/hooks/useTaken'
import { useFotos } from '@/hooks/useFotos'
import { useAuth } from '@/hooks/useAuth'
import type { Taak } from '@/types'
import { IconCamera, IconCameraOff, IconCheck, IconSquare, IconPhoto, IconAlertCircle } from '@tabler/icons-react'

interface TaakItemProps {
  taak: Taak
  werkbonId: string
  readOnly?: boolean
  onRefresh: () => void
}

export function TaakItem({ taak, werkbonId, readOnly, onRefresh }: TaakItemProps) {
  const { toggleVoltooid, zetFotoVereist } = useTaken()
  const { upload, getUrl } = useFotos()
  const { profile, magWerkBeheren } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [fotoplichtBezig, setFotoplichtBezig] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const heeftFoto = (taak.fotos?.length ?? 0) > 0
  // Fotoplicht kan per punt uit staan — bijvoorbeeld bij een regel uit
  // de offerte waar niets van te fotograferen valt.
  const magAfvinken = heeftFoto || !taak.foto_vereist

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setFout(null)
    setUploading(true)
    const { error } = await upload(werkbonId, taak.id, profile.id, file)
    setUploading(false)
    if (error) { setFout('De foto kon niet worden opgeslagen. Probeer het opnieuw.'); return }
    await onRefresh()
  }

  // Het venster wordt geopend vóór de await. Doe je dat erna, dan
  // ziet de browser het niet meer als gevolg van een tik en blokkeert
  // de popup-blokkering het — juist op mobiel.
  const openFoto = async (storagePath: string) => {
    const venster = window.open('', '_blank')
    const url = await getUrl(storagePath)
    if (!url) {
      venster?.close()
      setFout('De foto kon niet worden geopend. Probeer het opnieuw.')
      return
    }
    if (venster) venster.location.href = url
  }

  const wisselFotoplicht = async () => {
    if (fotoplichtBezig) return
    setFout(null)
    setFotoplichtBezig(true)
    const { error } = await zetFotoVereist(taak.id, !taak.foto_vereist)
    setFotoplichtBezig(false)
    if (error) { setFout('De fotoplicht kon niet worden gewijzigd.'); return }
    await onRefresh()
  }

  const handleToggle = async () => {
    if (!magAfvinken || readOnly || toggling) return
    setFout(null)
    setToggling(true)
    const { error } = await toggleVoltooid(taak)
    setToggling(false)
    if (error) { setFout('De taak kon niet worden bijgewerkt. Probeer het opnieuw.'); return }
    await onRefresh()
  }

  return (
    <div className={cn(
      'border rounded-lg p-5 mb-3 transition-all duration-200 ease-brand',
      taak.voltooid ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10' : 'border-gray-100 dark:border-white/10 bg-white dark:bg-surface-dark-2'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold',
          taak.voltooid ? 'bg-green-500 text-white' : 'bg-surface-2 dark:bg-white/10 text-gray-500 dark:text-white/60'
        )}>
          {taak.voltooid ? <IconCheck className="w-4 h-4" /> : null}
        </div>
        <div className="flex-1">
          <div className={cn('text-sm font-semibold leading-snug text-gray-900 dark:text-white', taak.voltooid && 'line-through text-gray-400 dark:text-white/40')}>
            {taak.titel}
          </div>
          {taak.omschrijving && (
            <div className="text-xs text-gray-500 dark:text-white/50 mt-1 leading-relaxed">{taak.omschrijving}</div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 mt-3 pl-10 flex-wrap">
          {(taak.fotos || []).map((foto) => (
            <div
              key={foto.id}
              className="w-16 h-16 rounded-sm border border-brand-yellow bg-brand-yellow-light dark:bg-brand-yellow/10 flex items-center justify-center cursor-pointer"
              onClick={() => openFoto(foto.storage_path)}
            >
              <IconPhoto className="w-5 h-5 text-brand-yellow-dark dark:text-brand-yellow" />
            </div>
          ))}

          <label className={cn(
            'w-16 h-16 rounded-sm border-2 border-dashed border-gray-200 dark:border-white/15 bg-surface-2 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-all hover:border-brand-yellow hover:bg-brand-yellow-light dark:hover:bg-brand-yellow/10',
            uploading && 'opacity-50 cursor-not-allowed'
          )}>
            <IconCamera className="w-5 h-5 text-gray-400 dark:text-white/40" />
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} disabled={uploading} />
          </label>

          <Button
            variant={taak.voltooid ? 'secondary' : 'primary'}
            size="sm"
            loading={toggling}
            disabled={!magAfvinken}
            onClick={handleToggle}
            className={cn(!magAfvinken && 'opacity-40 cursor-not-allowed')}
            title={!magAfvinken ? 'Maak eerst een foto' : undefined}
          >
            {taak.voltooid ? <><IconCheck className="w-4 h-4" /> Afgevinkt</> : <><IconSquare className="w-4 h-4" /> Afvinken</>}
          </Button>

          {!heeftFoto && taak.foto_vereist && (
            <span className="text-xs text-gray-400 dark:text-white/40 italic flex items-center gap-1">
              <IconCamera className="w-3.5 h-3.5" /> Foto vereist
            </span>
          )}

          {magWerkBeheren && (
            <button
              onClick={wisselFotoplicht}
              disabled={fotoplichtBezig}
              className={cn(
                'text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border transition-all duration-150 ease-brand disabled:opacity-50',
                taak.foto_vereist
                  ? 'border-brand-yellow bg-brand-yellow-light dark:bg-brand-yellow/10 text-brand-yellow-dark dark:text-brand-yellow'
                  : 'border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/40'
              )}
              title={taak.foto_vereist
                ? 'Fotoplicht uitzetten voor dit punt'
                : 'Fotoplicht weer aanzetten'}
            >
              {taak.foto_vereist
                ? <><IconCamera className="w-3.5 h-3.5" /> Foto verplicht</>
                : <><IconCameraOff className="w-3.5 h-3.5" /> Geen foto nodig</>}
            </button>
          )}

          {fout && (
            <div className="w-full flex items-start gap-2 text-xs text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-2.5 mt-1">
              <IconAlertCircle className="w-4 h-4 flex-shrink-0" />{fout}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

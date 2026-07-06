import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useTaken } from '@/hooks/useTaken'
import { useFotos } from '@/hooks/useFotos'
import { useAuth } from '@/hooks/useAuth'
import type { Taak } from '@/types'
import { IconCamera, IconCheck, IconSquare, IconPhoto } from '@tabler/icons-react'

interface TaakItemProps {
  taak: Taak
  werkbonId: string
  readOnly?: boolean
  onRefresh: () => void
}

export function TaakItem({ taak, werkbonId, readOnly, onRefresh }: TaakItemProps) {
  const { toggleVoltooid } = useTaken()
  const { upload, getUrl } = useFotos()
  const { profile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const heeftFoto = (taak.fotos?.length ?? 0) > 0

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    await upload(werkbonId, taak.id, profile.id, file)
    await onRefresh()
    setUploading(false)
  }

  const handleToggle = async () => {
    if (!heeftFoto || readOnly || toggling) return
    setToggling(true)
    await toggleVoltooid(taak)
    await onRefresh()
    setToggling(false)
  }

  return (
    <div className={cn(
      'border rounded-lg p-4 mb-3 transition-all duration-200',
      taak.voltooid ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold',
          taak.voltooid ? 'bg-green-500 text-white' : 'bg-surface-2 text-gray-500'
        )}>
          {taak.voltooid ? <IconCheck className="w-4 h-4" /> : null}
        </div>
        <div className="flex-1">
          <div className={cn('text-sm font-semibold leading-snug', taak.voltooid && 'line-through text-gray-400')}>
            {taak.titel}
          </div>
          {taak.omschrijving && (
            <div className="text-xs text-gray-500 mt-1 leading-relaxed">{taak.omschrijving}</div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 mt-3 pl-10 flex-wrap">
          {(taak.fotos || []).map((foto) => (
            <div
              key={foto.id}
              className="w-14 h-14 rounded-sm border border-brand-yellow bg-brand-yellow-light flex items-center justify-center cursor-pointer"
              onClick={() => window.open(getUrl(foto.storage_path), '_blank')}
            >
              <IconPhoto className="w-5 h-5 text-brand-yellow-dark" />
            </div>
          ))}

          <label className={cn(
            'w-14 h-14 rounded-sm border-2 border-dashed border-gray-200 bg-surface-2 flex items-center justify-center cursor-pointer transition-all hover:border-brand-yellow hover:bg-brand-yellow-light',
            uploading && 'opacity-50 cursor-not-allowed'
          )}>
            <IconCamera className="w-5 h-5 text-gray-400" />
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} disabled={uploading} />
          </label>

          <Button
            variant={taak.voltooid ? 'secondary' : 'primary'}
            size="sm"
            loading={toggling}
            disabled={!heeftFoto}
            onClick={handleToggle}
            className={cn(!heeftFoto && 'opacity-40 cursor-not-allowed')}
            title={!heeftFoto ? 'Maak eerst een foto' : undefined}
          >
            {taak.voltooid ? <><IconCheck className="w-4 h-4" /> Afgevinkt</> : <><IconSquare className="w-4 h-4" /> Afvinken</>}
          </Button>

          {!heeftFoto && (
            <span className="text-xs text-gray-400 italic flex items-center gap-1">
              <IconCamera className="w-3.5 h-3.5" /> Foto vereist
            </span>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Fotoviewer } from '@/components/taak/Fotoviewer'
import { useTaken } from '@/hooks/useTaken'
import { useFotos } from '@/hooks/useFotos'
import { useAuth } from '@/hooks/useAuth'
import type { Taak } from '@/types'
import { IconCamera, IconCameraOff, IconCheck, IconSquare, IconPhoto, IconAlertCircle, IconArchive } from '@tabler/icons-react'

interface TaakItemProps {
  taak: Taak
  werkbonId: string
  readOnly?: boolean
  onRefresh: () => void
}

export function TaakItem({ taak, werkbonId, readOnly, onRefresh }: TaakItemProps) {
  const { toggleVoltooid, zetFotoVereist } = useTaken()
  const { upload, getUrls } = useFotos()
  const { profile, magWerkBeheren } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [fotoplichtBezig, setFotoplichtBezig] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const fotos = taak.fotos ?? []
  const heeftFoto = fotos.length > 0

  // De foto's zelf, niet een pictogram dat erop lijkt.
  //
  // Hier stond een geel vakje met een fototeken in. Wie een foto had
  // gemaakt zag dus wél dat er íéts stond, maar niet wát — en de enige
  // manier om het te controleren was hem in een nieuw tabblad openen.
  // Op een telefoon is dat een tabwissel en soms een geblokkeerd
  // venster. Het antwoord op "is die foto goed gegaan" hoort op het
  // scherm te staan waar je hem net maakte.
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [fotoStand, setFotoStand] = useState<'bezig' | 'klaar' | 'mislukt'>('bezig')
  const [bekijk, setBekijk] = useState<number | null>(null)

  /**
   * Een opgeruimde foto heeft geen bestand meer.
   *
   * Zodra ClickUp de foto heeft en de klus veertien dagen geleden is
   * opgeleverd, haalt de opruiming het bestand uit de bucket (migratie
   * 027). De rij in `fotos` blijft staan met `opgeruimd_op` gevuld —
   * zo blijft zichtbaar dát er een foto was. Er valt alleen niets meer
   * te ondertekenen: zo'n pad meesturen levert een leeg antwoord op, en
   * dat is hier niet te onderscheiden van een foto die nog laadt. Dus
   * gaan ze er vooraf uit, en krijgen ze hun eigen vakje.
   */
  const paden = fotos.filter((f) => !f.opgeruimd_op).map((f) => f.storage_path).join('|')

  useEffect(() => {
    if (paden === '') { setUrls({}); setFotoStand('klaar'); return }
    let levend = true
    setFotoStand('bezig')
    getUrls(paden.split('|')).then(({ urls: gevonden, fout }) => {
      if (!levend) return
      setUrls(gevonden)
      setFotoStand(fout ? 'mislukt' : 'klaar')
    })
    return () => { levend = false }
    // Op de paden en niet op de reeks: die krijgt bij elke ophaalronde
    // een nieuwe identiteit en zou dit eindeloos opnieuw laten lopen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paden])
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
        {/* min-w-0 en break-words: een afvinkpunt is bij ons vaak een
            hele zin uit de werkopdracht, soms met een woord dat langer
            is dan het scherm ("bodemafsluiterconstructie"). Zonder dit
            duwt zo'n woord de hele kaart uit beeld. */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-semibold leading-snug text-gray-900 dark:text-white break-words', taak.voltooid && 'line-through text-gray-400 dark:text-white/40')}>
            {taak.titel}
          </div>
          {taak.omschrijving && (
            <div className="text-xs text-gray-500 dark:text-white/50 mt-1 leading-relaxed break-words">{taak.omschrijving}</div>
          )}
        </div>
      </div>

      {/* De foto's staan buiten de readOnly-voorwaarde. Die stond eromheen
          en betekende daarmee "niet te zien" in plaats van "niet te
          wijzigen" — op de werkbon van kantoor was de hele
          fotorapportage daardoor onzichtbaar, en na afronden voor de
          ploeg ook. */}
      {(heeftFoto || !readOnly) && (
        <div className="flex items-center gap-2 mt-3 pl-10 flex-wrap">
          {fotos.map((foto, n) => foto.opgeruimd_op ? (
            // Het bestand is weg, de foto niet: die staat als bijlage
            // bij de ClickUp-taak. Dat is beter nieuws dan een gebroken
            // plaatje, dus staat het er ook zo.
            <div
              key={foto.id}
              title="Het bestand is opgeruimd — de foto staat als bijlage bij de ClickUp-taak"
              className="w-16 h-16 rounded-sm border border-gray-200 dark:border-white/10 bg-surface-2 dark:bg-white/5 flex flex-col items-center justify-center gap-0.5 px-1 text-center"
            >
              <IconArchive className="w-4 h-4 text-gray-400 dark:text-white/40" />
              <span className="text-[9px] font-semibold leading-tight text-gray-400 dark:text-white/40">
                bij ClickUp
              </span>
            </div>
          ) : (
            <button
              key={foto.id}
              onClick={() => setBekijk(n)}
              aria-label={`Foto ${n + 1} bekijken`}
              className="w-16 h-16 rounded-sm overflow-hidden border border-gray-200 dark:border-white/10 bg-surface-2 dark:bg-white/5 flex items-center justify-center transition-all hover:border-brand-yellow"
            >
              {urls[foto.storage_path] ? (
                <img
                  src={urls[foto.storage_path]}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  // Een link die het niet doet ziet er anders uit dan een
                  // link die nog onderweg is. Zonder dit onderscheid
                  // blijft een kapotte foto er eeuwig uitzien alsof hij
                  // bijna klaar is.
                  onError={() => setFotoStand('mislukt')}
                  className="w-full h-full object-cover"
                />
              ) : fotoStand === 'mislukt' ? (
                <IconAlertCircle className="w-5 h-5 text-brand-red" />
              ) : (
                // Zolang de ondertekende link onderweg is. Geen spinner:
                // die trekt de aandacht naar het laden in plaats van
                // naar de foto die er zo staat.
                <IconPhoto className="w-5 h-5 text-gray-300 dark:text-white/25" />
              )}
            </button>
          ))}

          {/* De knop staat achter de foto's die er al zijn, niet op een
              eigen regel. Zo is het één strook waar je aan ziet dat er
              nog eentje bij kan — er komen er bij ons vaak meer, voor en
              na, en van twee kanten. */}
          {!readOnly && (
            <label className={cn(
              'w-16 h-16 rounded-sm border-2 border-dashed border-gray-200 dark:border-white/15 bg-surface-2 dark:bg-white/5 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all hover:border-brand-yellow hover:bg-brand-yellow-light dark:hover:bg-brand-yellow/10',
              uploading && 'opacity-50 cursor-not-allowed'
            )}>
              <IconCamera className="w-5 h-5 text-gray-400 dark:text-white/40" />
              {heeftFoto && (
                <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40">Nog een</span>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} disabled={uploading} />
            </label>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 mt-3 pl-10 flex-wrap">
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

          {/* De stand in woorden, niet alleen in kleur.
              Een foto uploaden vinkt niets af — dat blijft een aparte
              handeling, want er kunnen er nog meer bij komen en alleen
              de man ter plekke weet wanneer het punt klaar is. Wat er
              gebeurde is dat de knop van grijs naar geel sprong, en dat
              leest als "gedaan". Nu staat er wat er staat. */}
          {!taak.voltooid && !heeftFoto && taak.foto_vereist && (
            <span className="text-xs text-gray-400 dark:text-white/40 italic flex items-center gap-1">
              <IconCamera className="w-3.5 h-3.5" /> Foto vereist
            </span>
          )}
          {!taak.voltooid && heeftFoto && (
            <span className="text-xs text-gray-400 dark:text-white/40 flex items-center gap-1">
              {fotos.length} {fotos.length === 1 ? 'foto' : "foto's"} · nog niet afgevinkt
            </span>
          )}

          {fotoStand === 'mislukt' && (
            <span className="text-xs text-brand-red dark:text-red-400 flex items-center gap-1">
              <IconAlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              De foto&apos;s konden niet worden geladen — ze zijn wél opgeslagen.
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

      <Fotoviewer
        fotos={fotos.map((f) => ({
          id: f.id,
          url: f.opgeruimd_op ? null : urls[f.storage_path] ?? null,
          opgeruimd: !!f.opgeruimd_op,
        }))}
        index={bekijk}
        titel={taak.titel}
        onSluit={() => setBekijk(null)}
        onWissel={setBekijk}
      />
    </div>
  )
}

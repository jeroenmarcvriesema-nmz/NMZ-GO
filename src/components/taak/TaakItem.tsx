import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Fotoviewer } from '@/components/taak/Fotoviewer'
import { useTaken } from '@/hooks/useTaken'
import { supabase } from '@/lib/supabase'
import { useFotos } from '@/hooks/useFotos'
import { useAuth } from '@/hooks/useAuth'
import type { Taak } from '@/types'
import { Puntopmerkingen } from '@/components/taak/Puntopmerkingen'
import { IconCamera, IconCameraOff, IconCheck, IconSquare, IconPhoto, IconAlertCircle, IconArchive, IconRefresh, IconTrash, IconRotate, IconChevronDown,
} from '@tabler/icons-react'

interface TaakItemProps {
  taak: Taak
  werkbonId: string
  /** Lezen mag, afvinken en fotograferen niet. Zegt niets over kantoor. */
  readOnly?: boolean
  /**
   * De klus is opgeleverd — het dossier is dicht.
   *
   * Dan kan er ook door kantoor geen punt meer af: dat is wat de
   * opdrachtgever heeft gezien. `werkbon_punt_verwijderen()` weigert
   * het (migratie 032), en een knop die gegarandeerd een foutmelding
   * oplevert hoort er niet te staan.
   */
  gesloten?: boolean
  onRefresh: () => void
}

/**
 * De bovenste regel van een punt: bolletje, titel, en rechts een pijl
 * zodra er iets te klappen valt.
 *
 * Dit is een `<button>` of een `<div>`, afhankelijk van of er iets
 * gebeurt bij aantikken. Een `<div>` met een `onClick` eraan is geen
 * knop: hij komt niet in de tabvolgorde, reageert niet op de spatiebalk
 * en wordt door een schermlezer niet aangekondigd. En andersom is een
 * knop die niets doet net zo verkeerd — vandaar de schakelaar in plaats
 * van altijd hetzelfde element.
 *
 * `w-full text-left` omdat een knop zijn inhoud anders centreert en
 * krimpt tot de breedte van de tekst.
 */
function Kop({ alsKnop, open, onClick, children }: {
  alsKnop: boolean
  open: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  if (!alsKnop) return <div className="flex items-start gap-3">{children}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="flex items-start gap-3 w-full text-left rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60"
    >
      {children}
    </button>
  )
}

export function TaakItem({ taak, werkbonId, readOnly, gesloten, onRefresh }: TaakItemProps) {
  const { toggleVoltooid, zetFotoVereist } = useTaken()
  const { upload, getUrls } = useFotos()
  const { profile, magWerkBeheren } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  // De foto die niet aankwam. Zolang deze gevuld is, staat er een knop
  // om hem nog eens te versturen — hij is niet kwijt.
  const [wachtendeFoto, setWachtendeFoto] = useState<File | null>(null)
  const [fotoplichtBezig, setFotoplichtBezig] = useState(false)
  // Twee stappen, want dit is onomkeerbaar. Eén tik op een prullenbak
  // naast een afvinkvakje, op een telefoon met handschoenen aan, is te
  // makkelijk gebeurd.
  const [verwijderBezig, setVerwijderBezig] = useState(false)
  const [heropenBezig, setHeropenBezig] = useState(false)
  const [bevestigWeg, setBevestigWeg] = useState(false)
  /**
   * Een afgevinkt punt staat dichtgeklapt.
   *
   * Elk afgerond punt nam de volle hoogte in: doorgestreepte titel,
   * fotostrook van 64 pixels, een knop "Afgevinkt", het gesprekje en bij
   * kantoor nog vier beheerknoppen. Bij zes punten waarvan drie af werd
   * de pagina bijna zevenduizend pixels lang, en een échte werkopdracht
   * heeft er twintig tot dertig. De ploeg scrolde dus langs alles wat al
   * gedaan was om te zien wat er nog openstond — twintig keer per dag,
   * met een handschoen aan.
   *
   * Dicht blijft zichtbaar dát het punt af is en met welke foto's; wie
   * iets wil nakijken tikt het open. Punten worden niet in de volgorde
   * van de bon afgewerkt, dus het gaat er niet om wat "het volgende" is
   * maar dat wat nog open staat bij elkaar staat.
   */
  const [uitgeklapt, setUitgeklapt] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const fotos = taak.fotos ?? []
  const heeftFoto = fotos.length > 0
  const dicht = taak.voltooid && !uitgeklapt

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
   *
   * `storage_path` wordt hier ook getoetst: de overzichtslijst haalt
   * van elke foto alleen het id op om te kunnen tellen. Belandt zo'n
   * rij hier toch — als het ophalen van de volledige bon mislukte —
   * dan hoort dat geen ondertekening van het pad "undefined" op te
   * leveren.
   */
  const paden = fotos
    .filter((f) => !f.opgeruimd_op && f.storage_path)
    .map((f) => f.storage_path)
    .join('|')

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

  /**
   * De foto versturen, en hem vasthouden als dat niet lukt.
   *
   * Het bestand blijft in het geheugen staan tot het gelukt is. Dat is
   * het verschil tussen "probeer het opnieuw" als loze tekst en een
   * knop die het daadwerkelijk opnieuw doet — met dezelfde foto, zonder
   * dat iemand terug de kruipruimte in moet.
   */
  const verstuurFoto = async (file: File) => {
    if (!profile || uploading) return
    setFout(null)
    setUploading(true)
    const { fout: probleem } = await upload(werkbonId, taak.id, profile.id, file)
    setUploading(false)

    if (probleem) {
      setFout(probleem.tekst)
      setWachtendeFoto(probleem.opnieuw ? file : null)
      return
    }

    setWachtendeFoto(null)
    await onRefresh()
  }

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Leegmaken: dezelfde foto nog eens kiezen moet opnieuw iets doen.
    e.target.value = ''
    if (file) await verstuurFoto(file)
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

  const verwijderPunt = async () => {
    if (verwijderBezig) return
    setFout(null)
    setVerwijderBezig(true)
    const { error } = await supabase.rpc('werkbon_punt_verwijderen', { p_taak: taak.id })
    setVerwijderBezig(false)

    if (error) {
      // De database weigert bij foto's en bij een opgeleverde bon, met
      // een reden die uitlegt wát er in de weg staat. Die tonen we
      // letterlijk — een eigen tekst zou minder zeggen.
      setFout(error.message || 'Het punt kon niet worden verwijderd.')
      setBevestigWeg(false)
      return
    }
    await onRefresh()
  }

  /**
   * Het punt weer openzetten, vanaf het scherm van kantoor.
   *
   * Loopt langs dezelfde `toggleVoltooid` als het vinkje van de ploeg,
   * dus ook het stempel `voltooid_op` gaat eraf — een moment dat niet
   * meer klopt is erger dan geen moment. De database laat dit toe voor
   * uitvoerder of hoger, ook bij een afgeronde bon; dat is precies het
   * geval waarvoor deze knop bestaat.
   */
  const heropen = async () => {
    if (!taak.voltooid || heropenBezig) return
    setFout(null)
    setHeropenBezig(true)
    const { error } = await toggleVoltooid(taak)
    setHeropenBezig(false)
    if (error) {
      setFout(error.message || 'Het punt kon niet worden heropend.')
      return
    }
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
      'border rounded-lg transition-all duration-200 ease-brand',
      // Dicht mag de kaart ook krapper: het is een bewijsregel, geen
      // werkvlak. Samen met de kleinere fotostrook scheelt dat ruwweg
      // tweederde van de hoogte per afgerond punt.
      dicht ? 'p-3 mb-1.5' : 'p-5 mb-3',
      taak.voltooid ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10' : 'border-gray-100 dark:border-white/10 bg-white dark:bg-surface-dark-2'
    )}>
      {/* Zodra een punt af is, is de hele kop de knop die hem open- en
          dichtklapt. Zolang hij openstaat valt er niets te klappen en
          blijft het gewone tekst — een tik op de titel moet dan niets
          doen, want de afvinkknop zit er vlak onder. */}
      <Kop alsKnop={taak.voltooid} open={uitgeklapt} onClick={() => setUitgeklapt((v) => !v)}>
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
          {/* Dicht: één regel, afgekapt. Een afvinkpunt is bij ons vaak een
              hele zin uit de werkopdracht en brak dichtgeklapt alsnog over
              drie regels — dan is een punt van 110 pixels hoog nog steeds
              het meeste van wat je ziet, terwijl het alleen hoeft te
              bevestigen dát het af is. Openklappen geeft de hele zin. */}
          <div className={cn(
            'text-sm font-semibold leading-snug text-gray-900 dark:text-white',
            dicht ? 'truncate' : 'break-words',
            taak.voltooid && 'line-through text-tekst-gedempt dark:text-white/55',
          )}>
            {taak.titel}
          </div>
          {/* Uitleg vóóraf. Bij een punt dat al af is voegt hij niets
              meer toe en kost hij alleen hoogte. */}
          {taak.omschrijving && !dicht && (
            <div className="text-xs text-gray-500 dark:text-white/50 mt-1 leading-relaxed break-words">{taak.omschrijving}</div>
          )}
        </div>
        {/* Dicht gaat het bewijs mee op de titelregel in plaats van op een
            eigen regel eronder. De titel is dan toch één regel, dus die
            ruimte staat er al — en het scheelt bij achttien afgeronde
            punten een paar honderd pixels scrollen. */}
        {dicht && heeftFoto && (
          <span className="flex items-center gap-1 flex-shrink-0 text-[11px] font-semibold text-tekst-gedempt dark:text-white/55">
            <IconPhoto className="w-3.5 h-3.5" />
            {fotos.length}
          </span>
        )}
        {taak.voltooid && (
          <IconChevronDown className={cn(
            'w-4 h-4 flex-shrink-0 text-tekst-fijn dark:text-white/40 transition-transform duration-150',
            uitgeklapt ? 'rotate-180 mt-2' : 'mt-1.5'
          )} />
        )}
      </Kop>

      {/* De foto's staan buiten de readOnly-voorwaarde. Die stond eromheen
          en betekende daarmee "niet te zien" in plaats van "niet te
          wijzigen" — op de werkbon van kantoor was de hele
          fotorapportage daardoor onzichtbaar, en na afronden voor de
          ploeg ook. */}
      {/* Dicht schuift de strook strak onder de titel aan in plaats van
          op een eigen regel met volle tussenruimte. */}
      {((heeftFoto && !dicht) || (!readOnly && !dicht)) && (
        <div className={cn('flex items-center flex-wrap pl-10', dicht ? 'gap-1.5 mt-1.5' : 'gap-2 mt-3')}>
          {fotos.map((foto, n) => foto.opgeruimd_op ? (
            // Het bestand is weg, de foto niet: die staat als bijlage
            // bij de ClickUp-taak. Dat is beter nieuws dan een gebroken
            // plaatje, dus staat het er ook zo.
            <div
              key={foto.id}
              title="Het bestand is opgeruimd — de foto staat als bijlage bij de ClickUp-taak"
              className={cn(
                'rounded-sm border border-gray-200 dark:border-white/10 bg-surface-2 dark:bg-white/5 flex flex-col items-center justify-center gap-0.5 px-1 text-center',
                dicht ? 'w-8 h-8' : 'w-16 h-16'
              )}
            >
              <IconArchive className="w-4 h-4 text-tekst-gedempt dark:text-white/55" />
              <span className="text-[9px] font-semibold leading-tight text-tekst-gedempt dark:text-white/55">
                bij ClickUp
              </span>
            </div>
          ) : (
            <button
              key={foto.id}
              onClick={() => setBekijk(n)}
              aria-label={`Foto ${n + 1} bekijken`}
              className={cn(
                'rounded-sm overflow-hidden border border-gray-200 dark:border-white/10 bg-surface-2 dark:bg-white/5 flex items-center justify-center transition-all hover:border-brand-yellow',
                // Dicht is de strook een bewijsregel, geen werkvlak: je
                // ziet dát er foto's zijn en hoeveel. Wie er één wil
                // bekijken klapt het punt open.
                dicht ? 'w-8 h-8' : 'w-16 h-16'
              )}
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
                <IconPhoto className="w-5 h-5 text-tekst-fijn dark:text-white/40" />
              )}
            </button>
          ))}

          {/* De knop staat achter de foto's die er al zijn, niet op een
              eigen regel. Zo is het één strook waar je aan ziet dat er
              nog eentje bij kan — er komen er bij ons vaak meer, voor en
              na, en van twee kanten. */}
          {!readOnly && !dicht && (
            <label className={cn(
              'w-16 h-16 rounded-sm border-2 border-dashed border-gray-200 dark:border-white/15 bg-surface-2 dark:bg-white/5 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all hover:border-brand-yellow hover:bg-brand-yellow-light dark:hover:bg-brand-yellow/10',
              uploading && 'opacity-50 cursor-not-allowed'
            )}>
              <IconCamera className="w-5 h-5 text-tekst-gedempt dark:text-white/55" />
              {heeftFoto && (
                <span className="text-[10px] font-semibold text-tekst-gedempt dark:text-white/55">Nog een</span>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} disabled={uploading} />
            </label>
          )}

          {/* Bij de foto's en niet bij de knoppen: dit gaat over wat je
              hierboven wél of niet ziet staan. Het stond in het blok
              met de afvinkknop, en dus zag kantoor op de werkbon niets
              als de plaatjes het niet deden. */}
          {/* Niet als het punt dichtstaat: dan kijk je niet naar de foto's
              en kost een melding van twee regels meer hoogte dan het
              punt zelf. Openklappen laat hem gewoon weer zien. */}
          {fotoStand === 'mislukt' && !dicht && (
            <span className="w-full text-xs text-brand-red dark:text-red-400 flex items-start gap-1 mt-1">
              <IconAlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              De foto&apos;s konden niet worden geladen — ze zijn wél opgeslagen.
            </span>
          )}
        </div>
      )}

      {!readOnly && !dicht && (
        <div className="flex items-center gap-2 mt-3 pl-10 flex-wrap">
          {/* De meest gebruikte knop van de hele app, en hij was 34 pixels
              hoog — onder de ~44 die DESIGN_SYSTEM.md vraagt, terwijl dit
              precies de knop is die met een werkhandschoen wordt geraakt.

              De uitgeschakelde staat was bovendien dezelfde gele knop op
              40% dekking. In fel licht is dat verschil bijna weg, en dan
              lijkt het alsof de app niet reageert. Nu is "kan nog niet"
              een grijze omlijnde knop: een andere vorm, niet een blekere
              versie van dezelfde. */}
          <Button
            variant={!magAfvinken ? 'secondary' : taak.voltooid ? 'secondary' : 'primary'}
            size="md"
            loading={toggling}
            disabled={!magAfvinken}
            onClick={handleToggle}
            className="min-h-[44px]"
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
            <span className="text-xs text-tekst-gedempt dark:text-white/55 italic flex items-center gap-1">
              <IconCamera className="w-3.5 h-3.5" /> Foto vereist
            </span>
          )}
          {!taak.voltooid && heeftFoto && (
            <span className="text-xs text-tekst-gedempt dark:text-white/55 flex items-center gap-1">
              {fotos.length} {fotos.length === 1 ? 'foto' : "foto's"} · nog niet afgevinkt
            </span>
          )}
        </div>
      )}

      {/* Wat kantoor met dit punt kan.
          Dit stond binnen `!readOnly` en was daarmee overal onzichtbaar:
          op de werkbon van kantoor staat `readOnly` altijd aan — dat
          scherm vinkt niet af — en op het scherm waar het wél uit staat
          zit de zwamsaneerder, die `magWerkBeheren` niet heeft. De knop
          bestond dus wel en was nergens te zien.

          Twee dingen die niets met de werkdag te maken hebben: een punt
          eraf halen dat de parser verkeerd las of dat toch niet
          doorgaat, en de fotoplicht wisselen. Ze horen bij het beheren
          van de opdracht, niet bij het uitvoeren ervan. */}
      {/* Het gesprekje bij dit punt. Staat buiten `readOnly` en buiten
          `magWerkBeheren`: kantoor mag hier juist wél iets kwijt terwijl
          het nergens anders op dit scherm iets mag, en de ploeg moet
          kunnen antwoorden. Wel weg zodra de bon is opgeleverd — dan is
          het rapport de deur uit en is het gesprek gesloten. */}
      {!gesloten && !dicht && <Puntopmerkingen taakId={taak.id} werkbonId={werkbonId} />}

      {magWerkBeheren && !gesloten && !dicht && (
        <div className="flex items-center gap-2 mt-3 pl-10 flex-wrap">
          {/* Een afgevinkt punt weer openzetten.
              Afvinken blijft het werk van de ploeg op de klus — daarom
              staat `readOnly` op het scherm van kantoor aan en zit deze
              knop hier, bij de beheerknoppen, en niet op het vinkje.
              Het gevolg was alleen dat níemand een punt nog kon
              heropenen zodra de bon was afgerond: de ploeg mag het dan
              niet meer van de database, en kantoor had er geen knop
              voor. Terwijl dat juist het moment is waarop blijkt dat er
              een foto ontbreekt.
              Blijft weg zodra de bon is opgeleverd: dan is het rapport
              de deur uit en is heropenen geen kleine correctie meer. */}
          {taak.voltooid && (
            <button
              onClick={heropen}
              disabled={heropenBezig}
              className="text-xs font-semibold flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-sm border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-brand-yellow hover:text-brand-yellow-dark dark:hover:text-brand-yellow transition-all duration-150 ease-brand disabled:opacity-50"
              title="Zet dit punt weer open, zodat de ploeg er foto's bij kan zetten"
            >
              <IconRotate className="w-3.5 h-3.5" />
              {heropenBezig ? 'Bezig…' : 'Heropenen'}
            </button>
          )}

          <button
            onClick={wisselFotoplicht}
            disabled={fotoplichtBezig}
            className={cn(
              'text-xs font-semibold flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-sm border transition-all duration-150 ease-brand disabled:opacity-50',
              taak.foto_vereist
                ? 'border-brand-yellow bg-brand-yellow-light dark:bg-brand-yellow/10 text-brand-yellow-dark dark:text-brand-yellow'
                : 'border-gray-200 dark:border-white/10 text-tekst-gedempt dark:text-white/55'
            )}
            title={taak.foto_vereist
              ? 'Fotoplicht uitzetten voor dit punt'
              : 'Fotoplicht weer aanzetten'}
          >
            {taak.foto_vereist
              ? <><IconCamera className="w-3.5 h-3.5" /> Foto verplicht</>
              : <><IconCameraOff className="w-3.5 h-3.5" /> Geen foto nodig</>}
          </button>

          {/* Twee tikken, want dit is onomkeerbaar. Eén tik op een
              prullenbak naast een afvinkvakje is te makkelijk gebeurd —
              zeker op een telefoon met handschoenen aan. */}
          {bevestigWeg ? (
            <span className="flex items-center gap-1.5">
              <button
                onClick={verwijderPunt}
                disabled={verwijderBezig}
                className="text-xs font-bold flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-sm border border-brand-red bg-brand-red text-white transition-all duration-150 ease-brand disabled:opacity-50"
              >
                <IconTrash className="w-3.5 h-3.5" />
                {verwijderBezig ? 'Bezig…' : 'Definitief weg'}
              </button>
              <button
                onClick={() => setBevestigWeg(false)}
                className="text-xs font-semibold min-h-[36px] px-2.5 rounded-sm border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50"
              >
                Annuleren
              </button>
            </span>
          ) : (
            <button
              onClick={() => setBevestigWeg(true)}
              title="Dit punt van de werkbon halen"
              className="text-xs font-semibold flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-sm border border-gray-200 dark:border-white/10 text-tekst-gedempt dark:text-white/55 hover:border-brand-red hover:text-brand-red hover:bg-brand-red-light dark:hover:bg-brand-red/10 transition-all duration-150 ease-brand"
            >
              <IconTrash className="w-3.5 h-3.5" /> Punt weg
            </button>
          )}
        </div>
      )}

      {/* Buiten allebei de blokken: een mislukte verwijdering door
          kantoor moet ook te lezen zijn op een scherm waar de
          afvinkknop niet staat. */}
      {fout && (
        <div className="flex flex-col gap-2 text-xs text-brand-red dark:text-red-400 bg-brand-red-light dark:bg-brand-red/10 border border-brand-red rounded-sm p-2.5 mt-3 ml-10">
          <div className="flex items-start gap-2">
            <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="leading-relaxed">{fout}</span>
          </div>

          {/* Alleen als er ook echt iets klaarstaat om te versturen.
              Een knop die niets vasthoudt is een belofte die je niet
              waarmaakt. */}
          {wachtendeFoto && (
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              className="self-start min-h-[44px]"
              onClick={() => verstuurFoto(wachtendeFoto)}
            >
              <IconRefresh className="w-4 h-4" /> Foto opnieuw versturen
            </Button>
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

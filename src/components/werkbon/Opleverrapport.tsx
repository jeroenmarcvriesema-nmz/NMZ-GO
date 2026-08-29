import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { supabase } from '@/lib/supabase'
import { toast } from '@/store/toastStore'
import { downloadOpleverrapport } from '@/lib/rapportpdfmaken'
import { useAuth } from '@/hooks/useAuth'
import { formatDatum } from '@/lib/utils'
import type { Werkbon, Rapportage } from '@/types'
import {
  IconFileText, IconPhoto, IconInfoCircle, IconDeviceFloppy,
  IconAlertTriangle, IconClock, IconCircleCheck, IconExternalLink, IconDownload,
} from '@tabler/icons-react'

interface Props {
  werkbon: Werkbon
  onKlaar: () => void
}

/** De drie velden die op het opleverrapport terechtkomen. */
const VELDEN = [
  {
    naam: 'opmerkingen_bewoners' as const,
    label: 'Opmerkingen bewoners',
    hint: 'Wat de bewoners zeiden over de voorbereiding en de uitvoering.',
    plaatshouder: 'Bijvoorbeeld: bewoner was tevreden over de communicatie vooraf.',
  },
  {
    naam: 'extra_werkzaamheden' as const,
    label: 'Extra uitgevoerde werkzaamheden',
    hint: 'Werk dat afweek van de opdracht.',
    plaatshouder: 'Bijvoorbeeld: extra compartiment behandeld op verzoek van de inspecteur.',
  },
  {
    naam: 'bijzonderheden' as const,
    label: 'Bijzonderheden',
    hint: 'Alles wat de opdrachtgever moet weten en nergens anders staat.',
    plaatshouder: 'Bijvoorbeeld: kruipluik was niet bereikbaar, afgestemd met de inspecteur.',
  },
]

type Tekstveld = (typeof VELDEN)[number]['naam']

/**
 * Het opleverrapport: de tekst die erin komt, en de aanvraag zelf.
 *
 * De twee regels staan in de database (migratie 025) en niet in deze
 * knop: uitvoerder of hoger, en minstens één foto. Dit scherm zegt
 * hetzelfde, maar eerder — een knop die weigert nadat je erop drukt is
 * vervelender dan een knop die vooraf uitlegt wat er nog mist. Wie het
 * scherm omzeilt loopt alsnog tegen de database aan; dat is de bedoeling.
 *
 * De drie tekstvelden bestonden al als kolom sinds migratie 002 maar
 * hadden nergens een invoerveld. Het rapport heeft ze nodig en niemand
 * kon ze vullen. Ze staan hier omdat dit de plek is waar iemand ze
 * schrijft: bij de klus, met de punten en de foto's ernaast.
 */
export function Opleverrapport({ werkbon, onKlaar }: Props) {
  const { magWerkBeheren } = useAuth()
  const [tekst, setTekst] = useState<Record<Tekstveld, string>>({
    opmerkingen_bewoners: werkbon.opmerkingen_bewoners ?? '',
    extra_werkzaamheden: werkbon.extra_werkzaamheden ?? '',
    bijzonderheden: werkbon.bijzonderheden ?? '',
  })
  const [opslaan, setOpslaan] = useState(false)
  const [aanvragen, setAanvragen] = useState(false)
  const [rapportage, setRapportage] = useState<Rapportage | null>(null)

  // De laatste aanvraag ophalen. Een select is genoeg: aanmaken kan
  // alleen via de RPC, dus wat hier staat is per definitie langs de
  // twee regels gekomen.
  useEffect(() => {
    let levend = true
    const haal = async () => {
      const { data } = await supabase
        .from('rapportages')
        .select('*')
        .eq('werkbon_id', werkbon.id)
        .order('aangevraagd_op', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (levend) setRapportage((data as Rapportage) ?? null)
    }
    haal()
    return () => { levend = false }
  }, [werkbon.id])

  if (!magWerkBeheren) return null

  const fotos = (werkbon.taken ?? []).reduce((n, t) => n + (t.fotos?.length ?? 0), 0)
  const gewijzigd = VELDEN.some((v) => tekst[v.naam] !== (werkbon[v.naam] ?? ''))

  const bewaar = async () => {
    setOpslaan(true)
    const { data, error } = await supabase
      .from('werkbonnen')
      .update({
        // Leeg opslaan als null: een lege string zou als "ingevuld"
        // tellen en straks als lege regel op het rapport komen.
        opmerkingen_bewoners: tekst.opmerkingen_bewoners.trim() || null,
        extra_werkzaamheden: tekst.extra_werkzaamheden.trim() || null,
        bijzonderheden: tekst.bijzonderheden.trim() || null,
      })
      .eq('id', werkbon.id)
      .select('id')
    setOpslaan(false)

    // Geen rijen terug betekent dat de policy hem tegenhield. Zonder
    // deze controle ziet dat eruit als een geslaagde opslag.
    if (error || !data || data.length === 0) {
      toast.fout(error?.message || 'De tekst kon niet worden opgeslagen.')
      return
    }
    toast.goed('Tekst opgeslagen')
    onKlaar()
  }

  const vraagAan = async () => {
    setAanvragen(true)
    const { data, error } = await supabase.rpc('rapportage_aanvragen', { p_werkbon: werkbon.id })
    setAanvragen(false)

    if (error) {
      // De twee weigeringen uit migratie 025 in gewone taal. De rest
      // van de melding komt zoals hij is: verzinnen wat er mis is
      // helpt niemand.
      const melding =
        error.code === '42501' ? 'Alleen een uitvoerder of hoger kan een opleverrapport aanvragen.'
        : error.code === '23514' ? 'Er staat nog geen foto bij deze klus. Zonder fotorapportage is het rapport leeg.'
        : error.message || 'De aanvraag lukte niet.'
      toast.fout(melding)
      return
    }

    const nieuw = (data as { nieuw?: boolean } | null)?.nieuw
    toast.goed(nieuw === false ? 'Er liep al een aanvraag voor deze klus' : 'Opleverrapport aangevraagd')

    const { data: vers } = await supabase
      .from('rapportages')
      .select('*')
      .eq('werkbon_id', werkbon.id)
      .order('aangevraagd_op', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRapportage((vers as Rapportage) ?? null)
  }

  return (
    <Card>
      <SectionHeading title="Opleverrapport" />

      <div className="space-y-4">
        {VELDEN.map((veld) => (
          <div key={veld.naam}>
            <label className="block text-sm font-semibold text-gray-700 dark:text-white/70">
              {veld.label}
            </label>
            <p className="text-xs text-tekst-gedempt dark:text-white/55 mt-0.5 mb-1.5">{veld.hint}</p>
            <textarea
              rows={2}
              value={tekst[veld.naam]}
              onChange={(e) => setTekst((t) => ({ ...t, [veld.naam]: e.target.value }))}
              placeholder={veld.plaatshouder}
              className="w-full rounded-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark-2 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-tekst-fijn dark:placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow transition-all resize-y"
            />
          </div>
        ))}

        {gewijzigd && (
          <Button variant="secondary" className="min-h-[44px]" loading={opslaan} onClick={bewaar}>
            <IconDeviceFloppy className="w-4 h-4" /> Tekst opslaan
          </Button>
        )}
      </div>

      <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/50 mb-3">
          <IconPhoto className="w-3.5 h-3.5 flex-shrink-0" />
          {fotos === 0
            ? 'Nog geen foto bij deze klus'
            : `${fotos} ${fotos === 1 ? 'foto' : "foto's"} in de fotorapportage`}
        </div>

        {/* De PDF wordt hier in de browser gemaakt, uit de gegevens die
            dit scherm toch al mag zien. Los van de aanvraag hierboven:
            die zet een rapport in de bucket voor het dossier en voor
            ClickUp, dit geeft je nú een bestand om te versturen. */}
        <RapportPdfKnop werkbonId={werkbon.id} fotos={fotos} />

        {rapportage ? (
          <Rapportagestand rapportage={rapportage} />
        ) : (
          <>
            <Button
              variant="primary"
              className="min-h-[44px]"
              loading={aanvragen}
              disabled={fotos === 0}
              onClick={vraagAan}
            >
              <IconFileText className="w-4 h-4" /> Opleverrapport aanvragen
            </Button>

            <p className="flex items-start gap-1.5 mt-3 text-xs text-tekst-gedempt dark:text-white/55">
              <IconInfoCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {fotos === 0
                ? 'Een rapport zonder foto’s is een lege huls met een briefhoofd. Zodra de ploeg de eerste foto heeft geüpload kan het rapport aangevraagd worden.'
                : 'De aanvraag gaat in de wachtrij en wordt binnen een minuut opgepakt. Het rapport krijgt de klusgegevens, de uitgevoerde punten en alle foto’s, en is daarna hier te openen en af te drukken.'}
            </p>
          </>
        )}
      </div>
    </Card>
  )
}

/** Wat er met een lopende aanvraag gebeurd is, zonder mooier voor te stellen dan het is. */
/**
 * Het rapport als PDF, gemaakt in de browser.
 *
 * De verwerker kan dit niet: daar is het drie keer op zijn
 * resource-limiet afgeschoten. Een browser heeft dat geheugen wel, en
 * het bijkomende voordeel is dat het rapport altijd de laatste stand
 * heeft — geen wachtrij, geen bestand van vorige week.
 *
 * Bij veertig foto's duurt dit een halve minuut. Daarom een knop die
 * zegt dat hij bezig is, en niet een die stil lijkt te hangen.
 */
function RapportPdfKnop({ werkbonId, fotos }: { werkbonId: string; fotos: number }) {
  const [bezig, setBezig] = useState(false)

  const maak = async () => {
    setBezig(true)
    try {
      const { fotos: erin } = await downloadOpleverrapport(werkbonId)
      toast.goed(
        erin === fotos
          ? 'Opleverrapport gedownload'
          : `Opleverrapport gedownload · ${erin} van de ${fotos} foto’s erin`,
      )
    } catch (fout) {
      toast.fout(
        fout instanceof Error ? fout.message : 'Het rapport kon niet gemaakt worden.',
      )
    } finally {
      setBezig(false)
    }
  }

  return (
    <div className="mb-4">
      <Button variant="primary" className="min-h-[44px]" loading={bezig} disabled={fotos === 0} onClick={maak}>
        <IconDownload className="w-4 h-4" /> {bezig ? 'Rapport maken…' : 'Download als PDF'}
      </Button>
      <p className="text-xs text-tekst-gedempt dark:text-white/55 mt-2">
        {fotos === 0
          ? 'Zodra er een foto bij de klus staat, kan het rapport gemaakt worden.'
          : 'Wordt hier gemaakt met de laatste stand van de klus. Bij veel foto’s duurt dat even.'}
      </p>
    </div>
  )
}

function Rapportagestand({ rapportage }: { rapportage: Rapportage }) {
  if (rapportage.status === 'mislukt') {
    return (
      <div className="flex items-start gap-2 p-3 rounded-sm bg-brand-red-light dark:bg-brand-red/10 border border-brand-red">
        <IconAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-red dark:text-red-400" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-brand-red dark:text-red-400">
            Het rapport kon niet gemaakt worden
          </div>
          <div className="text-sm text-gray-600 dark:text-white/60 mt-0.5 break-words">
            {rapportage.fout || 'Geen reden vastgelegd.'}
          </div>
        </div>
      </div>
    )
  }

  if (rapportage.status === 'klaar') {
    return (
      <div className="flex items-start gap-2 p-3 rounded-sm bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
        <IconCircleCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-green-800 dark:text-green-300">Rapport klaar</div>
          <div className="text-xs text-green-700 dark:text-green-200/70 mt-0.5">
            Gemaakt op {formatDatum(rapportage.gegenereerd_op ?? rapportage.aangevraagd_op)}
            {rapportage.clickup_geupload_op && ' · staat in ClickUp'}
          </div>
          {rapportage.bestandspad && <OpenRapport pad={rapportage.bestandspad} />}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 p-3 rounded-sm bg-surface-2 dark:bg-white/5 border border-gray-200 dark:border-white/10">
      <IconClock className="w-4 h-4 flex-shrink-0 mt-0.5 text-tekst-gedempt dark:text-white/55" />
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-700 dark:text-white/80">
          Aangevraagd op {formatDatum(rapportage.aangevraagd_op)}
        </div>
        <div className="text-xs text-gray-500 dark:text-white/50 mt-0.5">
          De aanvraag staat in de wachtrij. De verwerker pakt hem binnen een minuut
          op; bij veel foto’s duurt het bouwen zelf nog even.
        </div>
      </div>
    </div>
  )
}

/**
 * Het rapport openen in een nieuw tabblad.
 *
 * De bucket is besloten, dus er is geen vaste link — die moet per keer
 * ondertekend worden. Het tabblad gaat open vóór het wachten, anders
 * ziet een telefoon het als een pop-up en blokkeert hij hem. Dezelfde
 * omweg als bij de documenten op de klusinfo.
 */
function OpenRapport({ pad }: { pad: string }) {
  const [bezig, setBezig] = useState(false)

  const open = async () => {
    setBezig(true)
    const tab = window.open('', '_blank')
    const { data, error } = await supabase.storage
      .from('werkbon-documenten')
      .createSignedUrl(pad, 3600)
    setBezig(false)

    if (error || !data?.signedUrl) {
      tab?.close()
      toast.fout('Het rapport kon niet worden geopend. Controleer je verbinding.')
      return
    }
    if (tab) tab.location.href = data.signedUrl
    else window.location.href = data.signedUrl
  }

  return (
    <div className="mt-2.5">
      <Button variant="secondary" size="sm" className="min-h-[44px]" loading={bezig} onClick={open}>
        <IconExternalLink className="w-4 h-4" /> Rapport openen
      </Button>
      {/* Afdrukken naar PDF is de weg naar een bestand dat de deur uit
          kan. Dat staat er expliciet bij, want een tabblad met een
          document ziet er niet uit als iets dat je kunt versturen. */}
      <p className="text-xs text-green-700/80 dark:text-green-200/60 mt-1.5">
        Opent in een nieuw tabblad. Afdrukken (Ctrl/Cmd + P) geeft de PDF om te versturen.
      </p>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { DocumentKiezer } from '@/components/werkbon/DocumentKiezer'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useWerkbonDocumenten } from '@/hooks/useWerkbonDocumenten'
import { genereerBonnummer } from '@/lib/utils'
import { controleerDocument, herkenPunten, type GelezenOpdracht } from '@/lib/opdracht'
import { toast } from '@/store/toastStore'
import type { Persoon } from '@/types'
import { IconPlus, IconTrash, IconArrowLeft, IconWand, IconListCheck } from '@tabler/icons-react'

interface TaakInput { titel: string; omschrijving: string }

export default function WerkbonNieuw() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { upload, lees } = useWerkbonDocumenten()
  // Het zelfverzonnen nummer blijft bewaard: haalt de werkopdracht het
  // echte opdrachtnummer binnen en wordt die PDF daarna weggehaald, dan
  // hoort het nummer terug te vallen op wat het was.
  const [standaardBonnummer] = useState(genereerBonnummer())
  const [bonnummer, setBonnummer] = useState(standaardBonnummer)
  const [projectnaam, setProjectnaam] = useState('')
  const [adres, setAdres] = useState('')
  const [opdrachtgever, setOpdrachtgever] = useState('')
  // Start en oplevering, precies de twee velden waarop de planning
  // draait. Een bon zonder startdatum valt terug op `datum` en komt
  // daarmee op vandaag te staan — dat is voor een klus van volgende
  // week het verkeerde antwoord, en tot nu toe het enige dat je kon
  // geven.
  const [startdatum, setStartdatum] = useState(new Date().toISOString().split('T')[0])
  const [opleverdatum, setOpleverdatum] = useState('')
  const [medewerkers, setMedewerkers] = useState<string[]>([])
  const [taken, setTaken] = useState<TaakInput[]>([{ titel: '', omschrijving: '' }])
  const [grippTekst, setGrippTekst] = useState('')
  const [alleProfielen, setAlleProfielen] = useState<Persoon[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'handmatig' | 'gripp'>('handmatig')

  // De twee PDF's gaan pas de opslag in nadat de bon bestaat: het pad in
  // de bucket begint met het id van de werkbon, en dat bestaat vóór het
  // opslaan nog niet.
  const [opdrachtPdf, setOpdrachtPdf] = useState<File | null>(null)
  const [tekeningPdf, setTekeningPdf] = useState<File | null>(null)
  const [lezen, setLezen] = useState(false)
  const [gelezen, setGelezen] = useState<GelezenOpdracht | null>(null)
  const [overgenomen, setOvergenomen] = useState(false)

  useEffect(() => {
    // Personen en niet profiles: toewijzen moet kunnen aan iemand die
    // nog geen account heeft. Dat is bij ons de normale toestand.
    supabase.from('personen').select('*').eq('actief', true).order('naam')
      .then(({ data }) => setAlleProfielen((data as Persoon[]) || []))
  }, [])

  const takenLeeg = taken.every((t) => !t.titel.trim())

  const neemPuntenOver = (punten: string[]) => {
    setTaken(punten.map((titel) => ({ titel, omschrijving: '' })))
    setActiveTab('handmatig')
  }

  const parseerGripp = () => {
    const gevonden = herkenPunten(grippTekst)
    if (gevonden.length) {
      neemPuntenOver(gevonden)
      toast.goed(`${gevonden.length} ${gevonden.length === 1 ? 'punt' : 'punten'} overgenomen`)
    } else {
      toast.fout('Geen checkpunten herkend. Gebruik genummerde punten of streepjes.')
    }
  }

  /**
   * De werkopdracht-PDF laten lezen zodra hij gekozen wordt.
   *
   * Dezelfde parser als de ClickUp-route, dus dezelfde punten. Wat al
   * ingevuld staat blijft staan: het scherm vult alleen lege velden aan.
   * Staan er al punten, dan worden die niet overschreven maar krijgt de
   * gebruiker er een knop voor — iemand die tien punten heeft ingetypt
   * en dan de tekening erbij zoekt, mag ze niet kwijtraken.
   */
  const leesOpdracht = async (bestand: File) => {
    setLezen(true)
    const { opdracht, fout } = await lees(bestand)
    setLezen(false)

    if (fout || !opdracht) {
      setGelezen(null)
      setOvergenomen(false)
      // Geen blokkade: de PDF blijft als bijlage aan de bon hangen, de
      // punten gaan dan met de hand.
      toast.fout(fout ?? 'De werkopdracht kon niet gelezen worden.')
      return
    }

    setGelezen(opdracht)

    if (opdracht.adres && !adres) setAdres(opdracht.adres)
    // Dezelfde projectnaam die de ClickUp-route wegschrijft; het veld is
    // verplicht en dit is bij een werkopdracht altijd het antwoord.
    if (!projectnaam) setProjectnaam('Zwamsanering')
    // Het bonnummer is bij een klus uit ClickUp het opdrachtnummer van
    // de werkvoorbereider (migratie 022). Staat het in de opdracht, dan
    // is dat het echte nummer en niet het nummer dat wij verzonnen.
    if (opdracht.opdrachtnummer) setBonnummer(opdracht.opdrachtnummer)

    const aantal = opdracht.punten.length
    const woord = aantal === 1 ? 'punt' : 'punten'

    if (takenLeeg) {
      neemPuntenOver(opdracht.punten)
      setOvergenomen(true)
      toast.goed(
        opdracht.sjabloon
          ? `${aantal} ${woord} uit de werkopdracht overgenomen`
          : `${aantal} ${woord} herkend — dit is geen NMZ-werkopdracht, loop ze even na`,
      )
    } else {
      setOvergenomen(false)
      toast.info(`${aantal} ${woord} gevonden. Je hebt zelf al punten ingevuld — kies "Punten overnemen" om ze te vervangen.`)
    }
  }

  const kiesOpdracht = (bestand: File) => {
    const bezwaar = controleerDocument(bestand)
    if (bezwaar) { toast.fout(bezwaar); return }
    setOpdrachtPdf(bestand)
    setGelezen(null)
    setOvergenomen(false)
    leesOpdracht(bestand)
  }

  const wisOpdracht = () => {
    setOpdrachtPdf(null)
    setGelezen(null)
    setOvergenomen(false)
    setBonnummer(standaardBonnummer)
  }

  const kiesTekening = (bestand: File) => {
    const bezwaar = controleerDocument(bestand)
    if (bezwaar) { toast.fout(bezwaar); return }
    setTekeningPdf(bestand)
  }

  const handleSave = async () => {
    if (!adres || !projectnaam || !startdatum) { toast.fout('Vul adres, projectnaam en startdatum in.'); return }
    if (opleverdatum && opleverdatum < startdatum) {
      toast.fout('De opleverdatum ligt vóór de startdatum.')
      return
    }
    const geldig = taken.filter((t) => t.titel.trim())
    if (!geldig.length) { toast.fout('Voeg minimaal één taak toe.'); return }
    setLoading(true)

    // Wat de parser uit de opdracht haalde hoort op de bon, precies
    // zoals de ClickUp-route het wegschrijft: dat is wat iemand nodig
    // heeft die voor de deur staat.
    const uitOpdracht = gelezen?.sjabloon
      ? {
          kluiscode: gelezen.kluiscode,
          inspecteur: gelezen.inspecteur,
          inspecteur_telefoon: gelezen.inspecteurTelefoon,
          werkvoorbereiding: gelezen.werkvoorbereiding,
        }
      : {}

    // `datum` gelijk aan de startdatum, net als bij een klus uit
    // ClickUp: daar is `datum` ook de dag waarop begonnen wordt. Zo
    // betekent het veld overal hetzelfde, of een bon nu automatisch of
    // met de hand ontstaat.
    const { data: wb, error: wbErr } = await supabase
      .from('werkbonnen').insert({
        bonnummer, projectnaam, adres, opdrachtgever,
        datum: startdatum,
        geplande_start: startdatum,
        geplande_eind: opleverdatum || null,
        aangemaakt_door: profile?.id,
        ...uitOpdracht,
      })
      .select().single()

    if (wbErr || !wb) {
      toast.fout('De werkbon kon niet worden aangemaakt. Controleer je verbinding en probeer het opnieuw.')
      setLoading(false)
      return
    }

    // De bon staat er al; taken en toewijzing mogen niet stil mislukken,
    // anders krijgt de monteur een lege werkbon te zien.
    const { error: taakErr } = await supabase.from('taken').insert(
      geldig.map((t, i) => ({ werkbon_id: wb.id, titel: t.titel, omschrijving: t.omschrijving, volgorde: i }))
    )
    if (taakErr) toast.fout('De werkbon is aangemaakt, maar de taken zijn niet opgeslagen. Vul ze aan op de werkbon.')

    if (medewerkers.length) {
      const { error: koppelErr } = await supabase.from('werkbon_medewerkers').insert(
        medewerkers.map((id) => ({ werkbon_id: wb.id, persoon_id: id, handmatig: true }))
      )
      if (koppelErr) toast.fout('De werkbon is aangemaakt, maar de monteurs zijn niet gekoppeld.')
    }

    // De documenten als laatste, en een mislukte upload houdt de bon
    // niet tegen: die is op de bon zelf alsnog aan te vullen.
    if (opdrachtPdf) {
      const { fout } = await upload(wb.id, 'werkopdracht', opdrachtPdf)
      if (fout) toast.fout(`${fout} Voeg hem toe op de werkbon.`)
    }
    if (tekeningPdf) {
      const { fout } = await upload(wb.id, 'werktekening', tekeningPdf)
      if (fout) toast.fout(`${fout} Voeg hem toe op de werkbon.`)
    }

    if (!taakErr) toast.goed('Werkbon aangemaakt')
    navigate(`/werkbonnen/${wb.id}`)
  }

  return (
    <PageWrapper title="Nieuwe werkbon" actions={
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => navigate('/werkbonnen')}><IconArrowLeft className="w-4 h-4" /> Terug</Button>
        {/* Secundair, niet primair. Onderaan het formulier staat
            "Werkbon opslaan" over de volle breedte, en die is de
            hoofdactie — twee gele knoppen op één scherm breekt de regel
            "maximaal één primary" uit UI_GUIDELINES.md, en laat de
            gebruiker raden welke van de twee de echte is. Deze blijft
            staan als snelle uitweg voor wie al bovenaan is. */}
        <Button variant="secondary" loading={loading} onClick={handleSave}>Opslaan</Button>
      </div>
    }>
      <div className="max-w-4xl space-y-5">
        <Card accent="yellow">
          <SectionHeading title="Werkbon informatie" />
          <div className="space-y-3">
            <Input label="Bonnummer" value={bonnummer} readOnly className="bg-surface-2 dark:bg-white/5 text-tekst-gedempt dark:text-white/55"
              hint={gelezen?.opdrachtnummer ? 'Overgenomen uit de werkopdracht' : undefined} />

            {/* De twee datums waar de planning op draait. Zonder deze
                stond een handmatige bon altijd op vandaag. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Startdatum" type="date" value={startdatum}
                onChange={(e) => setStartdatum(e.target.value)} required />
              <Input label="Opleverdatum (optioneel)" type="date" value={opleverdatum}
                min={startdatum}
                onChange={(e) => setOpleverdatum(e.target.value)}
                hint="Leeg laten voor een klus van één dag" />
            </div>
            <Input label="Projectnaam" placeholder="Bijv. Renovatie badkamer" value={projectnaam} onChange={(e) => setProjectnaam(e.target.value)} required />
            <Input label="Adres" placeholder="Straat, huisnr, woonplaats" value={adres} onChange={(e) => setAdres(e.target.value)} required />
            <Input label="Opdrachtgever (optioneel)" placeholder="Naam klant" value={opdrachtgever} onChange={(e) => setOpdrachtgever(e.target.value)} />
          </div>
        </Card>

        <Card>
          <SectionHeading title="Medewerkers koppelen" />
          <div className="flex flex-wrap gap-2">
            {alleProfielen.map((p) => (
              <button key={p.id}
                onClick={() => setMedewerkers((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${medewerkers.includes(p.id) ? 'bg-brand-yellow text-gray-900 border-brand-yellow-dark' : 'bg-white dark:bg-surface-dark-2 text-gray-600 dark:text-white/60 border-gray-200 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/30'}`}>
                {p.naam}
              </button>
            ))}
            {alleProfielen.length === 0 && <p className="text-sm text-tekst-gedempt dark:text-white/55">Geen medewerkers gevonden.</p>}
          </div>
        </Card>

        {/* De twee PDF's die de ploeg op locatie opent. Bij een klus uit
            ClickUp komen ze vanzelf mee; een bon die met de hand wordt
            gemaakt had ze tot nu toe nooit. De werkopdracht wordt meteen
            gelezen — daar komen de punten uit. */}
        <Card>
          <SectionHeading title="Documenten" />
          <div className="space-y-3">
            <DocumentKiezer
              label="Werkopdracht (PDF)"
              hint="De punten worden er automatisch uitgehaald"
              waarde={opdrachtPdf?.name ?? null}
              bezig={lezen}
              onKies={kiesOpdracht}
              onWis={wisOpdracht}
            />

            {gelezen && (
              <div className="rounded-sm border border-gray-100 dark:border-white/10 bg-surface-2 dark:bg-white/5 p-4 space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {gelezen.punten.length} {gelezen.punten.length === 1 ? 'punt' : 'punten'} gevonden
                  {overgenomen && ' en overgenomen'}
                </div>

                {!gelezen.sjabloon && (
                  <p className="text-xs text-gray-500 dark:text-white/50">
                    Dit is geen NMZ-werkopdracht ({gelezen.reden ?? 'sjabloon niet herkend'}); de punten
                    komen uit de opsomming. Loop ze na bij Taken.
                  </p>
                )}
                {gelezen.weggelaten.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-white/50">
                    Overgeslagen: {gelezen.weggelaten.join(', ')}.
                  </p>
                )}
                {gelezen.kluiscode && (
                  <p className="text-xs text-gray-500 dark:text-white/50">Kluiscode {gelezen.kluiscode} gevonden.</p>
                )}
                {gelezen.inspecteur && (
                  <p className="text-xs text-gray-500 dark:text-white/50">
                    Inspecteur {gelezen.inspecteur}
                    {gelezen.inspecteurTelefoon ? ` (${gelezen.inspecteurTelefoon})` : ''}.
                  </p>
                )}

                {!overgenomen && gelezen.punten.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => {
                    neemPuntenOver(gelezen.punten)
                    setOvergenomen(true)
                    toast.goed(`${gelezen.punten.length} ${gelezen.punten.length === 1 ? 'punt' : 'punten'} overgenomen`)
                  }}>
                    <IconListCheck className="w-4 h-4" /> Punten overnemen
                  </Button>
                )}
              </div>
            )}

            <DocumentKiezer
              label="Werktekening (PDF)"
              hint="Optioneel — te openen vanaf de bon"
              waarde={tekeningPdf?.name ?? null}
              onKies={kiesTekening}
              onWis={() => setTekeningPdf(null)}
            />
          </div>
        </Card>

        <Card>
          <SectionHeading
            title="Taken"
            actions={
              <div className="flex gap-1 bg-surface-2 dark:bg-white/5 p-1 rounded-sm">
                {(['handmatig','gripp'] as const).map((t) => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all ${activeTab === t ? 'bg-white dark:bg-surface-dark-2 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-white/50'}`}>
                    {t === 'handmatig' ? 'Handmatig' : 'Gripp import'}
                  </button>
                ))}
              </div>
            }
          />

          {activeTab === 'gripp' ? (
            <div className="space-y-3">
              <Textarea label="Plak tekst uit Gripp" rows={8}
                placeholder={"1. CV-ketel controleren\n2. Radiatoren ontluchten\n- Lekkage inspectie"}
                value={grippTekst} onChange={(e) => setGrippTekst(e.target.value)} />
              <Button variant="primary" onClick={parseerGripp}><IconWand className="w-4 h-4" /> Herkennen</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {taken.map((taak, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input type="text" placeholder={`Taak ${i + 1}…`} value={taak.titel}
                      onChange={(e) => setTaken((prev) => prev.map((t, j) => j === i ? { ...t, titel: e.target.value } : t))}
                      className="w-full px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none focus:border-brand-yellow" />
                    <input type="text" placeholder="Toelichting (optioneel)" value={taak.omschrijving}
                      onChange={(e) => setTaken((prev) => prev.map((t, j) => j === i ? { ...t, omschrijving: e.target.value } : t))}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-sm outline-none focus:border-brand-yellow text-gray-500 dark:text-white/50" />
                  </div>
                  <button onClick={() => setTaken((prev) => prev.filter((_, j) => j !== i))}
                    className="p-2 text-tekst-fijn dark:text-white/40 hover:text-brand-red transition-colors mt-0.5">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setTaken((prev) => [...prev, { titel: '', omschrijving: '' }])}>
                <IconPlus className="w-4 h-4" /> Taak toevoegen
              </Button>
            </div>
          )}
        </Card>

        <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handleSave}>Werkbon opslaan</Button>
      </div>
    </PageWrapper>
  )
}

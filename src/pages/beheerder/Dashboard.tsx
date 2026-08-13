import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MeldingItem } from '@/components/dashboard/MeldingItem'
import { ProjectTabel } from '@/components/dashboard/ProjectTabel'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Standbalk } from '@/components/dashboard/Standbalk'
import { Voorzieningenkaart } from '@/components/dashboard/Voorzieningenkaart'
import { Weekdoorkijk } from '@/components/dashboard/Weekdoorkijk'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState } from '@/components/ui/EmptyState'
import { STANDEN } from '@/lib/klusstand'
import { ErrorState } from '@/components/ui/ErrorState'
import {
  IconPlus,
  IconClock,
  IconAlertTriangle,
  IconCircleCheck,
  IconPlayerPlay,
  IconClockExclamation,
  IconPlayerPause,
  IconCalendar,
} from '@tabler/icons-react'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function formatDatumLang(): string {
  return new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, loading, error, refetch } = useDashboard()
  const voornaam = (profile?.naam ?? '').split(' ')[0]

  if (loading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="flex justify-center py-32"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper title="Dashboard">
        <ErrorState
          melding="Het dashboard kon niet worden geladen. Controleer je verbinding."
          onOpnieuw={refetch}
        />
      </PageWrapper>
    )
  }

  // De werkvoorraad, in dezelfde standen als de rest van de app.
  //
  // Dit telde uitsluitend werkbonnen met de datum van vandaag: vijf van
  // de eenendertig, terwijl er veertien klussen lopen. Een klus die
  // vorige week begon en volgende week doorloopt viel er helemaal
  // buiten, en dat is nou juist de klus waar je iets van wilt weten.
  const v = data.werkvoorraad
  // Wat er nog te doen is: alles behalve wat af of opgeleverd is.
  const openstaand = v.stilgelegd + v.af_te_ronden + v.bezig + v.niet_gestart

  const urgenteMeldingen = data.meldingen.filter(
    (m) => m.type === 'niet_gestart' || m.type === 'controle' || m.type === 'geen_fotos'
  )

  return (
    <PageWrapper
      title="Dashboard"
      actions={
        <Button variant="primary" onClick={() => navigate('/werkbonnen/nieuw')}>
          <IconPlus className="w-4 h-4" /> Nieuwe werkbon
        </Button>
      }
    >
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white break-words">
          {greeting()}, {voornaam}
        </h1>
        <p className="text-sm text-gray-400 dark:text-white/40 mt-1.5 capitalize">{formatDatumLang()}</p>
        {urgenteMeldingen.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm font-medium px-3 py-1.5 rounded-lg">
            <IconAlertTriangle className="w-4 h-4" />
            {urgenteMeldingen.length} aandachtspunt{urgenteMeldingen.length !== 1 ? 'en' : ''} vereisen actie
          </div>
        )}
      </div>

      {/* De werkvoorraad in vijf getallen, met dezelfde woorden en
          kleuren als op de werkbonnen, de planning en het archief. Een
          status mag op het dashboard niet anders heten dan een scherm
          verderop.

          Wat aandacht vraagt staat vooraan: wat stilligt, dan wat op
          één druk op de knop wacht, dan wat loopt.

          Elke tegel gaat naar de werkbonnenlijst met dat filter al aan.
          Alleen "Uitgelopen" wijkt af en houdt zijn eigen scherm: daar
          staat de reden en de historie bij, en dat is een andere vraag
          dan "welke klussen zijn dit".

          Een tegel op nul gaat nergens heen. Doorklikken naar een lege
          lijst is een belofte die niet wordt waargemaakt, en het haalt
          bovendien het optillen bij hover weg — zie KpiCard. */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <KpiCard
          label={STANDEN.stilgelegd.label}
          value={v.stilgelegd}
          icon={<IconPlayerPause />}
          variant={v.stilgelegd > 0 ? 'red' : 'neutral'}
          onClick={v.stilgelegd > 0 ? () => navigate('/werkbonnen?stand=stilgelegd') : undefined}
          actie={v.stilgelegd > 0 ? 'Bekijk klussen' : undefined}
        />
        <KpiCard
          label={STANDEN.af_te_ronden.kort}
          value={v.af_te_ronden}
          icon={<IconCircleCheck />}
          variant={v.af_te_ronden > 0 ? 'violet' : 'neutral'}
          onClick={v.af_te_ronden > 0 ? () => navigate('/werkbonnen?stand=af_te_ronden') : undefined}
          actie={v.af_te_ronden > 0 ? 'Bekijk klussen' : undefined}
        />
        <KpiCard
          label={STANDEN.bezig.label}
          value={v.bezig}
          icon={<IconPlayerPlay />}
          variant={v.bezig > 0 ? 'blue' : 'neutral'}
          onClick={v.bezig > 0 ? () => navigate('/werkbonnen?stand=bezig') : undefined}
          actie={v.bezig > 0 ? 'Bekijk klussen' : undefined}
        />
        <KpiCard
          label={STANDEN.niet_gestart.kort}
          value={v.niet_gestart}
          icon={<IconClock />}
          variant="neutral"
          onClick={v.niet_gestart > 0 ? () => navigate('/werkbonnen?stand=niet_gestart') : undefined}
          actie={v.niet_gestart > 0 ? 'Bekijk klussen' : undefined}
        />
        {/* De enige tegel die ergens heen gaat. Uitloop heeft een eigen
            scherm met de reden erbij; dit getal is het startpunt van die
            vraag en niet het antwoord. Zonder klussen die uitlopen is er
            ook niets te bekijken, dan blijft het een tegel. */}
        <KpiCard
          label="Uitgelopen"
          value={data.uitgelopen}
          icon={<IconClockExclamation />}
          variant={data.uitgelopen > 0 ? 'red' : 'neutral'}
          onClick={data.uitgelopen > 0 ? () => navigate('/uitloop') : undefined}
          actie={data.uitgelopen > 0 ? 'Bekijk uitloop' : undefined}
        />
      </div>

      {/* De vorm van de werkvoorraad, en hoe de week eruitziet.
          Vijf getallen vertellen hoevéél er is maar niet hoe het staat:
          of de voorraad vooral uit wachtend werk bestaat of uit klussen
          die lopen, en of morgen vol staat of leeg. Dat is de vraag
          waarvoor iemand anders naar de planning klikte om te tellen. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8 mb-8 sm:mb-10">
        <div className="xl:col-span-2 min-w-0 bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
          <SectionHeading
            title="Werkvoorraad"
            actions={
              <span className="text-xs text-gray-400 dark:text-white/40">
                {openstaand} {openstaand === 1 ? 'klus' : 'klussen'} open
              </span>
            }
          />
          <Standbalk
            dik
            rijen
            verdeling={v}
            leeg="Er staat niets open. Zodra de synchronisatie klussen binnenhaalt verschijnen ze hier."
          />
        </div>
        <div className="min-w-0 bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
          <SectionHeading
            title="Deze week"
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/planning')}>
                Planning →
              </Button>
            }
          />
          <Weekdoorkijk dagen={data.doorkijk} onDag={() => navigate('/planning')} />
        </div>
      </div>

      {/* Wat er bij een derde partij besteld en afgemeld moet worden.
          Staat bewust boven het projectoverzicht: dit is het enige blok
          op dit scherm waar een dag uitstel direct geld kost — huur die
          doorloopt, of een ploeg die op dag één zonder container staat. */}
      <div className="mb-6 xl:mb-8">
        <Voorzieningenkaart />
      </div>

      {/* Projectoverzicht + Activiteit */}
      {/* min-w-0 op beide kolommen. Zonder dat groeit een grid-kind mee
          met zijn inhoud in plaats van zich aan de kolom te houden, en
          dan schuift de hele pagina opzij — dat was het overzicht dat
          buiten de marges viel. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8">
        <div className="xl:col-span-2 min-w-0 bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
          <SectionHeading
            title="Projectoverzicht"
            actions={
              <>
                {/* Op een telefoon passen twee knoppen niet naast de kop
                    en liep "Alle projecten" het scherm uit. Planning
                    staat daar al in de balk onderin. */}
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/planning')}>
                  <IconCalendar className="w-4 h-4" /> Planning
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/projecten')}>
                  Alle projecten →
                </Button>
              </>
            }
          />
          {data.projecten.length === 0 ? (
            <EmptyState
              icon={<IconCalendar />}
              titel="Vandaag staat er niets gepland"
              uitleg="Werkbonnen met de datum van vandaag verschijnen hier zodra ze zijn aangemaakt."
              actie={<Button variant="primary" size="sm" onClick={() => navigate('/werkbonnen/nieuw')}><IconPlus className="w-4 h-4" /> Nieuwe werkbon</Button>}
            />
          ) : (
            <ProjectTabel projecten={data.projecten} />
          )}
        </div>
        <div className="min-w-0 bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
          <SectionHeading title="Activiteit vandaag" />
          <ActivityFeed activiteit={data.activiteit} />
        </div>
      </div>

      {/* Operationele meldingen onderaan.
          Ze stonden bovenaan, boven het overzicht en de activiteit. Dat
          las als een storingspagina met een dashboard eronder, terwijl
          dit scherm over het werk gaat. Wat écht opvalt staat al als
          chip bij de begroeting; de lijst zelf is om na te lopen, niet
          om als eerste te zien. */}
      {data.meldingen.length > 0 && (
        <div className="mt-8 sm:mt-10">
          <SectionHeading title="Operationele meldingen" />
          <div className="space-y-2">
            {data.meldingen.map((m) => (
              <MeldingItem key={m.id} melding={m} />
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}

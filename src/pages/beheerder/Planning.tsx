import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Select'
import { usePlanning } from '@/hooks/useProjecten'
import { PlanningKaart } from '@/components/werkbon/PlanningKaart'
import { Weekkiezer } from '@/components/layout/Weekkiezer'
import { cn, formatDatumKort } from '@/lib/utils'
import { isoDatum, weekDagen, maandagVerschoven, moetOpnieuwIngepland } from '@/lib/planning'
import { zoektMee } from '@/lib/zoeken'
import { klusstand, looptUit, isAsbest, STANDEN, STANDVOLGORDE, type Klusstand } from '@/lib/klusstand'
import { Standbalk, type Standverdeling } from '@/components/dashboard/Standbalk'
import type { PlanningItem } from '@/types'
import { IconAlertTriangle, IconSearch, IconX, IconCalendarRepeat, IconChevronRight } from '@tabler/icons-react'

// Zes dagen: zaterdag wordt gebruikt om dingen af te maken en voor
// garantiewerk, en hoort dus gewoon in de planning.
const DAG_NAMEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

/**
 * De volgorde binnen een dagkolom.
 *
 * Stond op de volgorde waarin de database de bonnen teruggaf — in de
 * praktijk op datum, wat binnen één dag niets betekent. Nu op stand:
 * wat stilligt bovenaan, dan wat op afronden wacht, dan wat loopt.
 * Bij gelijke stand op adres, zodat de kolom niet verspringt tussen
 * twee ophaalrondes.
 *
 * Dit geldt alleen hier, op de planning van kantoor. "Mijn week" van de
 * zwamsaneerder houdt zijn eigen volgorde: die kijkt naar één dag met
 * één of twee klussen en heeft aan sorteren niets — daar telt waar je
 * heen moet, niet welke klus de meeste aandacht vraagt.
 */
function feitenVan(p: PlanningItem) {
  return {
    status: p.status === 'afgerond' ? 'voltooid' : 'open',
    stilgelegd_op: p.status === 'stilgelegd' ? 'ja' : null,
    puntenKlaar: p.puntenKlaar,
    punten: p.punten,
    // Geklokt telt als bezig, net als op het dashboard.
    looptNu: p.looptNu,
  }
}

/**
 * De zwaarste stand van de dag, voor de telling in de dagkop.
 *
 * Eén getal per kolom zegt hoe druk een dag is, maar niet wat die dag
 * van je vraagt. De kleur doet dat: staat er iets stil, dan is de
 * telling rood. Zo zie je bij het openslaan van de week in welke
 * kolommen iets te doen is, zonder één kaart te lezen.
 *
 * Dezelfde tabel als de kaarten eronder — geen nieuwe kleuren, alleen
 * de zwaarste van wat er die dag staat.
 */
function zwaarsteStand(items: PlanningItem[]): Klusstand | null {
  if (items.length === 0) return null
  return items
    .map((p) => klusstand(feitenVan(p)))
    .reduce((zwaarste, s) => (STANDVOLGORDE[s] < STANDVOLGORDE[zwaarste] ? s : zwaarste))
}

/** Hoeveel klussen per stand staan er op deze dag. */
function verdelingVan(items: PlanningItem[]): Standverdeling {
  const uit: Standverdeling = {}
  for (const p of items) {
    const stand = klusstand(feitenVan(p))
    uit[stand] = (uit[stand] ?? 0) + 1
  }
  return uit
}

function opStand(items: PlanningItem[]): PlanningItem[] {
  return [...items].sort((a, b) => {
    const verschil = STANDVOLGORDE[klusstand(feitenVan(a))] - STANDVOLGORDE[klusstand(feitenVan(b))]
    return verschil !== 0 ? verschil : a.adres.localeCompare(b.adres)
  })
}

/**
 * Zaterdag is de zesde kolom, en de laatste.
 *
 * Hij hoort in de planning — er wordt afgemaakt en garantiewerk gedaan —
 * maar het is geen dag als de andere vijf: wat hier staat is bijwerk, en
 * een volle zaterdag zegt iets anders dan een volle dinsdag. Daarom een
 * eigen tint in plaats van dezelfde grijze kop als de rest.
 *
 * Bewust leisteen en geen nieuwe felle kleur. Blauw, groen en rood zijn
 * vergeven aan de status van een klus; geel is vandaag. Een dag van de
 * week hoort geen kleur te lenen die ergens anders iets betekent.
 */
const ZATERDAG = 5

const ZATERDAGTINT = {
  kop: 'bg-slate-200/70 dark:bg-slate-400/20 border-slate-300/70 dark:border-slate-400/20',
  vlak: 'bg-slate-50/60 dark:bg-slate-400/[0.07]',
  rand: 'border-slate-200 dark:border-slate-400/20',
}

export default function Planning() {
  const { planning, loading } = usePlanning()
  const navigate = useNavigate()
  // Vooruit en achteruit bladeren. De planning liep alleen over de
  // huidige week, terwijl er werk staat tot ver in de maand — en na een
  // uitloop wil je juist terugkijken.
  const [week, setWeek] = useState(0)
  // Twee vragen die een planner elke dag stelt en waar bladeren geen
  // antwoord op geeft: "waar staat Mario deze week" en "zit dat adres
  // er al ergens in". Een filter op ploeg en een zoekveld beantwoorden
  // ze allebei zonder de weekindeling los te laten.
  const [ploeg, setPloeg] = useState('alle')
  const [zoek, setZoek] = useState('')
  // De derde vraag, en de enige die de planner 's ochtends als eerste
  // stelt: "wat vraagt vandaag iets van mij". Filteren op stand maakt
  // van een volle week een lijstje van vier klussen die stilliggen of
  // over hun opleverdatum heen zijn.
  const [stand, setStand] = useState<'alle' | 'uitloop' | 'asbest' | Klusstand>('alle')
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)

  const alleDagen = weekDagen(maandagVerschoven(week))

  /**
   * Zaterdag staat er altijd bij.
   *
   * Hij is een tijdlang alleen getoond als er zaterdag werk stond, om
   * ruimte te winnen: zes kolommen op een laptop van 1440 laten zo'n 150
   * pixels per dag over, en daar breken adressen in af. Dat probleem is
   * nu bij de bron opgelost — elke dagkolom is minstens 190 pixels breed
   * en de week schuift desnoods opzij.
   *
   * En belangrijker: zaterdag is bij NMZ inmiddels een bijna gewone
   * werkdag. Een week die er de ene keer uit vijf en de andere keer uit
   * zes kolommen bestaat, is dan verwarrender dan een lege kolom.
   */
  const dagen = alleDagen

  // Iedereen die deze maand ergens op staat, één keer, op alfabet.
  const ploegen = [...new Set(planning.flatMap((p) => p.medewerkers))].sort((a, b) => a.localeCompare(b))

  const feiten = (p: PlanningItem) => ({
    status: p.status === 'afgerond' ? 'voltooid' : 'open',
    stilgelegd_op: p.status === 'stilgelegd' ? 'ja' : null,
    puntenKlaar: p.puntenKlaar,
    punten: p.punten,
    geplande_eind: p.eind,
    datum: p.datum,
  })

  const standPast = (p: PlanningItem) =>
    stand === 'alle' ||
    (stand === 'uitloop' ? looptUit(feiten(p))
      : stand === 'asbest' ? isAsbest(p.stillegReden)
      : klusstand(feiten(p)) === stand)

  const past = (p: PlanningItem) =>
    (ploeg === 'alle' || p.medewerkers.includes(ploeg)) &&
    standPast(p) &&
    zoektMee(
      {
        adres: p.adres,
        plaats: p.plaats,
        bonnummer: p.bonnummer,
        kluiscode: p.kluiscode,
        medewerkers: p.medewerkers.map((naam) => ({ naam })),
      },
      zoek
    )

  const zichtbaar = planning.filter(past)
  const filtersAan = ploeg !== 'alle' || zoek.trim() !== '' || stand !== 'alle'

  // Wat staat er in déze week. Hier stond het totaal over alle weken —
  // dat getal veranderde dus niet als je bladerde, en dat is precies het
  // moment waarop je niet meer weet welke week je bekijkt.
  const vanWeek = isoDatum(dagen[0])
  const totWeek = isoDatum(dagen[dagen.length - 1])
  const dezeWeek = zichtbaar.filter(
    (p) => !moetOpnieuwIngepland({ datum: p.datum, geplande_eind: p.eind, vervolg_soort: p.vervolgSoort })
      && p.datum <= totWeek && (p.eind ?? p.datum) >= vanWeek,
  )

  // Wat van het bord af is gehaald. Deze klussen staan met opzet niet
  // meer in een week: de bewoner was niet thuis, de vloer lag niet vrij.
  // Ze hier laten staan op hun oude dag zou betekenen dat de week vol
  // lijkt met werk dat zeker niet doorgaat.
  //
  // Maar ze mogen ook niet zomaar verdwijnen — dan is "van het bord"
  // hetzelfde als "kwijt". Vandaar een eigen blok, met de reden erbij,
  // want dat is precies wat de planner nodig heeft om hem opnieuw in te
  // zetten. Los van de week: ze horen bij géén week, dus bladeren mag
  // ze niet laten verdwijnen.
  const opnieuwInplannen = planning.filter((p) =>
    moetOpnieuwIngepland({ datum: p.datum, geplande_eind: p.eind, vervolg_soort: p.vervolgSoort }),
  )

  /**
   * Wie staat er op deze dag op meer dan één klus?
   *
   * ClickUp kent alleen een start- en een einddatum, dus een klus van
   * drie weken vult alle dagen ertussen — ook de dagen waarop de ploeg
   * ergens anders is. Dat kunnen we niet weten en niet oplossen.
   *
   * Wat we wél kunnen: het zichtbaar maken. Staat iemand op één dag op
   * twee klussen, dan is dat óf een fout in de planning, óf een klus
   * die feitelijk even stilligt. In beide gevallen wil je het maandag
   * zien en niet donderdag horen.
   */
  const dubbelOpDag = (items: typeof planning): Set<string> => {
    const geteld = new Map<string, number>()
    for (const item of items) {
      for (const naam of item.medewerkers) {
        geteld.set(naam, (geteld.get(naam) ?? 0) + 1)
      }
    }
    return new Set([...geteld].filter(([, n]) => n > 1).map(([naam]) => naam))
  }

  /**
   * Dezelfde overlappingen, maar één keer voor de hele week.
   *
   * Het waarschuwingsvlak stond per dagkolom, dus wie drie dagen dubbel
   * stond kreeg drie identieke oranje blokken naast elkaar te zien —
   * dezelfde zin, drie keer, en samen meer aandacht dan de klussen
   * eronder. Terwijl de vraag die je stelt niet "welke kolom" is maar
   * "staat er iemand dubbel, en wanneer".
   *
   * Eén regel per persoon dus, met de dagen erachter. Dat is rustiger én
   * completer dan wat er stond: je ziet nu in één blik dat het om drie
   * dagen van dezelfde man gaat en niet om drie losse problemen.
   */
  const dubbelInWeek = (): { naam: string; dagen: string[] }[] => {
    const perPersoon = new Map<string, string[]>()
    dagen.forEach((dag, i) => {
      const dagStr = isoDatum(dag)
      const dagItems = zichtbaar.filter((x) => x.datum <= dagStr && (x.eind ?? x.datum) >= dagStr)
      for (const naam of dubbelOpDag(dagItems)) {
        perPersoon.set(naam, [...(perPersoon.get(naam) ?? []), DAG_NAMEN[i].slice(0, 2).toLowerCase()])
      }
    })
    return [...perPersoon].map(([naam, d]) => ({ naam, dagen: d }))
  }

  if (loading) {
    return (
      <PageWrapper title="Planning">
        <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Weekplanning">
      <Weekkiezer
        week={week}
        onWissel={setWeek}
        telling={`${dezeWeek.length} ${dezeWeek.length === 1 ? 'klus' : 'klussen'}`}
        className="mb-4"
      />

      {opnieuwInplannen.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <IconCalendarRepeat className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400" />
            <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
              {opnieuwInplannen.length === 1
                ? 'Eén klus moet opnieuw ingepland worden'
                : `${opnieuwInplannen.length} klussen moeten opnieuw ingepland worden`}
            </span>
          </div>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/60 mb-2.5">
            Deze staan in geen enkele week. Zet er een datum op om ze terug op het bord te krijgen.
          </p>
          <div className="space-y-1.5">
            {opnieuwInplannen.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/werkbonnen/${p.id}`)}
                className="w-full min-h-[44px] flex items-center gap-2 text-left px-3 py-2 rounded-sm bg-white dark:bg-surface-dark-2 border border-amber-200 dark:border-amber-500/25 hover:border-amber-400 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white break-words">
                    {p.adres}
                  </span>
                  {p.vervolgReden && (
                    <span className="block text-xs text-amber-800/80 dark:text-amber-200/60 mt-0.5 break-words">
                      {p.vervolgReden}
                    </span>
                  )}
                </span>
                <IconChevronRight className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-white/40" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* `flex-wrap` plus een ondergrens op het zoekveld. Zonder allebei
          werd dit op een tablet in staand formaat onbruikbaar: de zijbalk
          pakt 240 pixels, de twee keuzelijsten samen 448, en wat er voor
          het zoekveld overbleef was een vakje van vijftig pixels met alleen
          het vergrootglas erin — niet meer herkenbaar als invoerveld.
          PROJECT.md zegt met zoveel woorden dat kantoor ook op een tablet
          moet kunnen werken. Nu wijkt de rij uit naar een tweede regel in
          plaats van het zoekveld plat te drukken. */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-5">
        <div className="relative flex-1 sm:min-w-[240px] sm:max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tekst-gedempt dark:text-white/55" />
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Adres, plaats of bonnummer…"
            className="w-full min-h-[44px] pl-9 pr-4 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none placeholder:text-tekst-fijn dark:placeholder:text-white/45 focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20"
          />
        </div>

        {/* Alleen tonen als er iemand te kiezen valt. Een lege
            keuzelijst is een knop die niets doet. */}
        {ploegen.length > 0 && (
          <div className="sm:w-56">
            <Select
              name="ploeg"
              value={ploeg}
              onChange={(e) => setPloeg(e.target.value)}
              className="min-h-[44px]"
              opties={[
                { waarde: 'alle', label: 'Hele ploeg' },
                ...ploegen.map((naam) => ({ waarde: naam, label: naam })),
              ]}
            />
          </div>
        )}

        {/* De standen in de volgorde waarin ze om aandacht vragen —
            dezelfde volgorde als STANDVOLGORDE, want dat is de volgorde
            waarin de lijst zelf ook staat. "Loopt uit" staat er los
            boven: dat is geen stand maar een laag eroverheen, en het is
            de vraag waar kantoor mee begint. */}
        <div className="sm:w-52">
          <Select
            name="stand"
            value={stand}
            onChange={(e) => setStand(e.target.value as typeof stand)}
            className="min-h-[44px]"
            opties={[
              { waarde: 'alle', label: 'Elke stand' },
              { waarde: 'uitloop', label: 'Loopt uit' },
              { waarde: 'asbest', label: 'Asbest' },
              { waarde: 'stilgelegd', label: STANDEN.stilgelegd.label },
              { waarde: 'af_te_ronden', label: STANDEN.af_te_ronden.label },
              { waarde: 'bezig', label: STANDEN.bezig.label },
              { waarde: 'niet_gestart', label: STANDEN.niet_gestart.label },
              { waarde: 'afgerond', label: STANDEN.afgerond.label },
              { waarde: 'opgeleverd', label: STANDEN.opgeleverd.label },
            ]}
          />
        </div>

        {filtersAan && (
          <button
            onClick={() => { setPloeg('alle'); setZoek(''); setStand('alle') }}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-sm text-sm font-semibold text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
          >
            <IconX className="w-4 h-4" /> Filter wissen
          </button>
        )}
      </div>

      {/* Zonder deze regel lijkt een lege week een lege week, terwijl er
          een filter aan staat die je twee schermen geleden hebt gezet. */}
      {filtersAan && (
        <p className="text-xs text-tekst-gedempt dark:text-white/55 -mt-2 mb-4">
          Je ziet {dezeWeek.length} van de {planning.filter((p) => p.datum <= totWeek && (p.eind ?? p.datum) >= vanWeek).length} klussen in deze week.
          {ploeg !== 'alle' && ` Alleen waar ${ploeg} op staat.`}
          {stand === 'uitloop' && ' Alleen wat over de opleverdatum heen is.'}
          {stand === 'asbest' && ' Alleen wat op asbest stilligt.'}
          {stand !== 'alle' && stand !== 'uitloop' && stand !== 'asbest' &&
            ` Alleen "${STANDEN[stand].label}".`}
        </p>
      )}

      {/* Wie er deze week dubbel staat — één keer, boven de week.
          Stond hiervoor als los oranje vlak in elke dagkolom waar het
          gold, dus dezelfde zin tot drie keer naast elkaar. */}
      {(() => {
        const overlap = dubbelInWeek()
        if (overlap.length === 0) return null
        return (
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-sm bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/30">
            <IconAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
            <div className="min-w-0 text-xs leading-relaxed text-orange-800 dark:text-orange-300">
              <span className="font-bold">Dubbel ingepland deze week.</span>{' '}
              {overlap.map((o, n) => (
                <span key={o.naam}>
                  {n > 0 && ' · '}
                  <span className="font-semibold">{o.naam}</span> op {o.dagen.join(', ')}
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Desktop: 5-kolommen grid */}
      {/* Kolommen met een ondergrens, en de rij schuift opzij als ze niet
          allemaal passen.
          Als raster werden zes dagen op een laptop van 1440 zo'n 150 pixels
          breed, en daar past geen adres in: er stond "Meidoornstraa / t 4"
          en "Karolingens / traat 29". Afbreken op lettergrepen lost dat niet
          op — `hyphens: auto` werkt alleen als de browser een Nederlands
          afbreekwoordenboek heeft, en dat is lang niet overal zo.
          Een dag is dus minstens 190 pixels breed en de week schuift
          desnoods opzij. Dat is precies de uitzondering die
          DESIGN_SYSTEM.md toestaat: horizontale scroll binnen één bewust
          element, niet op de pagina. */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-2">
        {dagen.map((dag, i) => {
          const dagStr = isoDatum(dag)
          const isVandaag = dag.getTime() === vandaag.getTime()
          // Vandaag wint van zaterdag: als het zaterdag ís, is "vandaag"
          // het antwoord op de vraag die je stelt als je hier kijkt.
          const isZaterdag = i === ZATERDAG && !isVandaag
          const dagItems = opStand(zichtbaar.filter((p) => p.datum <= dagStr && (p.eind ?? p.datum) >= dagStr))

          return (
            <div
              key={i}
              className={cn(
                // Eén omhulsel om kop en inhoud in plaats van twee losse
                // vlakken die tegen elkaar aan liggen: zo is een dag
                // zichtbaar één ding, en kan vandaag als geheel oplichten
                // in plaats van alleen een gele hoed te krijgen.
                'flex flex-col rounded-lg border overflow-hidden shadow-sm',
                'flex-1 min-w-[190px]',
                isVandaag ? 'border-brand-yellow ring-1 ring-brand-yellow/40'
                  : isZaterdag ? ZATERDAGTINT.rand
                  : 'border-gray-100 dark:border-white/10'
              )}
            >
              {/* Dag header */}
              <div
                className={cn(
                  'px-3 py-2.5 border-b',
                  // Zachte tint, geen volvlak: dat gele blok las als een
                  // knop en gebruikte hetzelfde vlak als de primaire actie.
                  // De gele ring om de kolom markeert vandaag al.
                  isVandaag ? 'bg-brand-yellow-light dark:bg-brand-yellow/15 border-brand-yellow'
                    : isZaterdag ? ZATERDAGTINT.kop
                    // Stond in hetzelfde wit als de inhoud eronder, en
                    // las daardoor niet als kop.
                    : 'bg-surface-2 dark:bg-surface-dark-3 border-gray-100 dark:border-white/10'
                )}
              >
                <div className={cn('text-sm font-bold', 'text-gray-900 dark:text-white')}>
                  {DAG_NAMEN[i]}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-xs', 'text-tekst-gedempt dark:text-white/55')}>
                    {formatDatumKort(dag)}
                  </span>
                  {/* De telling stond alleen op de telefoon. Op een
                      laptop zie je zes kolommen naast elkaar en is
                      juist dáár de vraag hoe vol een dag is. */}
                  {dagItems.length > 0 && (() => {
                    const zwaarste = zwaarsteStand(dagItems)
                    const z = zwaarste ? STANDEN[zwaarste] : null
                    return (
                      <span
                        title={z ? `Zwaarste stand vandaag: ${z.label}` : undefined}
                        className={cn(
                          'flex items-center gap-1 text-[11px] font-bold px-1.5 rounded-full tabular-nums flex-shrink-0',
                          isVandaag ? 'bg-white/50 text-gray-800' : cn(z?.vlak, z?.tekst),
                        )}
                      >
                        {!isVandaag && z && (
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', z.bol)} />
                        )}
                        {dagItems.length}
                      </span>
                    )
                  })()}
                </div>

                {/* De dag in één streep. De kaarten eronder vertellen
                    wélke klus wat is; dit vertelt de vorm van de dag —
                    of hij vooral uit wachtend werk bestaat of uit iets
                    dat loopt, en hoe groot het rode stuk is. Dezelfde
                    kleuren, geen nieuwe. */}
                {dagItems.length > 0 && (
                  <Standbalk verdeling={verdelingVan(dagItems)} legenda={false} className="mt-2" />
                )}
              </div>

              {/* Items */}
              <div className={cn(
                'flex-1 p-2 space-y-2 min-h-[120px]',
                isZaterdag ? ZATERDAGTINT.vlak : 'bg-white dark:bg-surface-dark-2'
              )}>
                {dagItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-6">
                    {/* "Vrij" met een filter aan is onwaar: er staat
                        misschien van alles, alleen niet van deze man. */}
                    <span className="text-xs text-tekst-fijn dark:text-white/40">
                      {filtersAan ? 'Niets in dit filter' : 'Vrij'}
                    </span>
                  </div>
                ) : (
                  dagItems.map((item) => (
                    <PlanningKaart
                      key={item.id}
                      item={item}
                      onOpen={() => navigate(`/werkbonnen/${item.id}`)}
                      loopIn={item.datum < dagStr}
                      loopUit={(item.eind ?? item.datum) > dagStr}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: gestapeld per dag */}
      <div className="md:hidden space-y-4">
        {dagen.map((dag, i) => {
          const dagStr = isoDatum(dag)
          const isVandaag = dag.getTime() === vandaag.getTime()
          const isZaterdag = i === ZATERDAG && !isVandaag
          const dagItems = opStand(zichtbaar.filter((p) => p.datum <= dagStr && (p.eind ?? p.datum) >= dagStr))

          return (
            <div className={cn(
              'rounded-lg border shadow-sm overflow-hidden',
              isZaterdag ? ZATERDAGTINT.vlak : 'bg-white dark:bg-surface-dark-2',
              isVandaag ? 'border-brand-yellow ring-1 ring-brand-yellow/40'
                : isZaterdag ? ZATERDAGTINT.rand
                : 'border-gray-100 dark:border-white/10'
            )} key={i}>
              <div className={cn(
                'px-4 py-3 flex items-center justify-between',
                isVandaag ? 'bg-brand-yellow-light dark:bg-brand-yellow/15 border-b border-brand-yellow'
                  : isZaterdag ? cn(ZATERDAGTINT.kop, 'border-b')
                  : 'bg-surface-2 dark:bg-surface-dark-3 border-b border-gray-100 dark:border-white/10'
              )}>
                <div>
                  <span className={cn('text-sm font-bold', 'text-gray-900 dark:text-white')}>
                    {DAG_NAMEN[i]}
                  </span>
                  <span className={cn('text-xs ml-2', 'text-tekst-gedempt dark:text-white/55')}>
                    {formatDatumKort(dag)}
                  </span>
                </div>
                {dagItems.length > 0 && (
                  <span className="text-xs font-bold bg-white/50 dark:bg-white/10 text-gray-700 dark:text-white/80 px-2 py-0.5 rounded-full">
                    {dagItems.length}
                  </span>
                )}
              </div>
              {dagItems.length === 0 ? (
                <div className="px-4 py-5 text-sm text-tekst-fijn dark:text-white/40 text-center">
                  {filtersAan ? 'Niets in dit filter' : 'Niets ingepland'}
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {dagItems.map((item) => (
                    <PlanningKaart
                      key={item.id}
                      item={item}
                      ruim
                      onOpen={() => navigate(`/werkbonnen/${item.id}`)}
                      loopIn={item.datum < dagStr}
                      loopUit={(item.eind ?? item.datum) > dagStr}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </PageWrapper>
  )
}

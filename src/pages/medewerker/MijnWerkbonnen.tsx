import { useState } from 'react'
import { useWerkbonnen, useWerkbon } from '@/hooks/useWerkbonnen'
import { useAuth } from '@/hooks/useAuth'
import { useWerkdag, formatTijd, geefUren } from '@/hooks/useWerkdag'
import { useLopendeWerkdag } from '@/hooks/useLopendeWerkdag'
import { useMijnPrestaties } from '@/hooks/useMijnPrestaties'
import { usePlanningDoorkijk } from '@/hooks/usePlanningDoorkijk'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Klusuitvoering } from '@/components/werkbon/Klusuitvoering'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Voortgangsring } from '@/components/ui/Voortgangsring'
import { berekenVoortgang, cn } from '@/lib/utils'
import {
  kiesVandaag, looptVandaag, uitgelopenWerk, duurLabel, isoDatum,
  startreden, begintVandaag, startVan, eindVan, type Startreden,
} from '@/lib/planning'
import { klusstand, STANDEN, type Klusstand } from '@/lib/klusstand'
import { LOCATIE_AAN } from '@/lib/locatie'
import {
  IconCalendar, IconPlayerPlay, IconPlayerStop,
  IconPhoto, IconClock, IconTrophy,
  IconUsers, IconCircleCheck, IconAlertTriangle, IconChevronRight, IconCalendarEvent, IconMapPin,
  IconMapPinFilled,
} from '@tabler/icons-react'

function groet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function datumLang(): string {
  return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Dezelfde schil als kantoor: zijbalk op een laptop, balk onderin op
 * een telefoon. Dit scherm had een eigen opbouw zonder navigatie —
 * daardoor was er geen weg naar je andere bonnen en voelde de app leeg,
 * want er was maar één ding te zien.
 *
 * Staat bewust buiten `MijnWerkbonnen`. Als component-in-een-component
 * krijgt hij bij elke hertekening een nieuwe identiteit, en dan hangt
 * React de hele inhoud opnieuw op: elk afvinkpunt vraagt zijn
 * ondertekende fotolinks dan opnieuw op en de miniaturen knipperen
 * terug naar een grijs vakje.
 */
function Schil({ voornaam, children }: { voornaam: string; children: React.ReactNode }) {
  return (
    <PageWrapper title="Vandaag">
      <div className="max-w-5xl space-y-4 pb-28">
        <div>
          <p className="text-xs text-tekst-gedempt dark:text-white/55 first-letter:uppercase">{datumLang()}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {groet()}, {voornaam}
          </h1>
        </div>
        {children}
      </div>
    </PageWrapper>
  )
}

/**
 * Vandaag: de dag van de man in het veld.
 *
 * Eén scherm voor één dag. De dag zit in de knoppen onderin en in de
 * cijfers; de klus zelf zit in `Klusuitvoering`, precies hetzelfde blok
 * als op `/werkbon/:id`. Er stond hier vroeger een knop "Werkbon
 * openen" die naar dat andere scherm sprong en dezelfde bon nog een
 * keer liet zien, maar dan netter opgebouwd. Twee schermen voor
 * hetzelfde werk, en het mooiste verstopt achter een knop.
 */
export default function MijnWerkbonnen() {
  const { profile } = useAuth()
  const { werkbonnen, loading, refetch: refetchLijst } = useWerkbonnen()

  const voornaam = (profile?.naam ?? '').split(' ')[0]

  // Sta je geklokt, dan is dat de klus van vandaag — ook als de
  // planning inmiddels iets anders zegt. Kantoor kan er om tien uur een
  // spoedje tussen drukken; dan hoort de kaart onder de man niet weg te
  // springen terwijl zijn werkdag loopt. Het spoedje staat eronder in
  // de lijst, dus hij ziet het wel.
  const { werkbonId: geklokOp } = useLopendeWerkdag()

  // De app kiest een klus, maar de man in het veld heeft het laatste
  // woord. Staan er twee klussen voor vandaag, dan tikt hij aan waar hij
  // is en start hij dáár zijn werkdag. Zonder dit kon hij de tweede klus
  // wel zien maar er niet op klokken — precies de klacht.
  //
  // Leeg tot iemand kiest: dan blijft de automatische keuze gelden, en
  // die is bij één klus per dag altijd de goede.
  const [gekozenId, setGekozenId] = useState<string | null>(null)
  const automatisch = kiesVandaag(werkbonnen, isoDatum(), geklokOp)
  const gekozen = (gekozenId ? werkbonnen.find((w) => w.id === gekozenId) : null) ?? automatisch

  // Werk van eerdere dagen dat nog niet af is, behalve de klus die
  // hierboven al gekozen is. Staat er vandaag een nieuwe klus gepland,
  // dan pakt `kiesVandaag` die — en dan is het werk van gisteren nog
  // steeds nergens te zien. Daar gingen de meeste vragen over.
  const blijftLiggen = uitgelopenWerk(werkbonnen).filter((w) => w.id !== gekozen?.id)

  // De andere klussen die vandaag óók lopen. Iemand staat vijf dagen op
  // een klus en er komt één dag een klusje tussendoor: dan lopen er
  // twee, en hierboven kan er maar één de klus van vandaag zijn. De
  // rest stond daarmee nergens — precies de klus die niet vergeten mag
  // worden, want er is één dag om hem te doen.
  const ookVandaag = looptVandaag(werkbonnen).filter((w) => w.id !== gekozen?.id)

  /**
   * De lijst hierboven komt zonder foto's binnen — met dertig bonnen
   * erin hoort dat ook zo te blijven. Van de bon van vandáág wil je ze
   * wél zien, en die is er maar één. Dus die halen we apart op, met
   * dezelfde hook die `/werkbon/:id` gebruikt.
   *
   * Zonder dit tekende `TaakItem` hier een leeg cameravakje bij een
   * punt waar gewoon twee foto's onder zaten: `taak.fotos` was er
   * simpelweg niet, in alle drie de fasen van de werkdag.
   */
  const { werkbon: bonMetFotos, loading: bonLaadt, error: bonFout, refetch } = useWerkbon(gekozen?.id ?? null)

  // Zolang die ene bon onderweg is werken we door met de versie uit de
  // lijst: adres, punten en dagknoppen staan er dan al. Alleen de
  // foto's komen een tel later.
  const vandaag = bonMetFotos ?? gekozen
  const { state: werkdag, bezig: werkdagBezig, startWerkdag, stopWerkdag, hervatWerkdag } = useWerkdag(vandaag?.id ?? null)

  if (loading) {
    return (
      <PageWrapper title="Vandaag">
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  // ── Geen werkbon vandaag ──────────────────────────────────────
  if (!vandaag) {
    return (
      <Schil voornaam={voornaam}>
        <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm">
          <EmptyState
            icon={<IconCalendar />}
            titel="Vandaag geen werkbon"
            uitleg="Er staat nog niets voor je klaar. Neem contact op met je uitvoerder als je wél werk verwacht."
          />
        </div>
        <Prestaties />
        <WaarWerktWie />
      </Schil>
    )
  }

  const taken = vandaag.taken ?? []
  const voortgang = berekenVoortgang(taken)
  const aantalFotos = taken.flatMap((t) => t.fotos ?? []).length
  const gestart = werkdag.fase === 'actief'

  // Afvinken en fotograferen hangen aan de werkdag: lezen mag altijd,
  // wijzigen alleen als je bezig bent. Dat verschil staat er ook bij,
  // zodat niemand denkt dat de app kapot is als er niets gebeurt bij
  // aantikken.
  const bijschrift = werkdag.fase === 'voor_start'
    ? 'Lezen kan nu al — afvinken zodra je bent gestart'
    : werkdag.fase === 'gestopt'
      ? 'Hervat je werkdag om weer af te vinken'
      : 'Maak een foto vóór je afvinkt'

  return (
    <>
      <Schil voornaam={voornaam}>
        {/* Bovenaan, direct onder de groet. Punten klaar, foto's,
            voortgang en gewerkte tijd zijn het antwoord op "hoe sta ik
            ervoor" — dat is wat je wil zien als je je telefoon uit je
            zak haalt, niet iets waar je twintig afvinkpunten voor moet
            langsscrollen. */}
        {/* Het eerste wat er staat: wáár je vandaag begint.
            Hieronder stonden eerst de cijfers, dan de blokken met
            uitgelopen werk en klussen die er ook nog zijn, en pas
            daarna het adres van de klus zelf — halverwege het scherm,
            in een klein grijs bovenschriftje. Dat is de klacht: er
            stond wél waar iemand mee bezig was en wat er niet af was,
            maar het adres waar hij volgens de planning hoorde te
            beginnen moest je ertussenuit vissen. */}
        <Startkaart
          adres={vandaag.adres}
          plaats={vandaag.plaats}
          reden={startreden(vandaag, isoDatum(), geklokOp)}
          nieuweKlus={begintVandaag(vandaag)}
          duur={duurLabel(vandaag)}
          start={startVan(vandaag)}
          eind={eindVan(vandaag)}
          fase={werkdag.fase}
          startTijd={werkdag.startTijd}
        />

        <Dagkaart
          aantalKlaar={taken.filter((t) => t.voltooid).length}
          aantalTaken={taken.length}
          aantalFotos={aantalFotos}
          voortgang={voortgang}
          stand={klusstand(vandaag)}
          uren={werkdag.fase === 'voor_start' ? '—' : geefUren(werkdag.startTijd, werkdag.stopTijd)}
        />

        {werkdag.fase === 'gestopt' && (
          <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <IconCircleCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">Werkdag gestopt</h2>
            <p className="text-sm text-tekst-gedempt dark:text-white/55 mt-1">
              {formatTijd(werkdag.startTijd)} — {formatTijd(werkdag.stopTijd)} ·{' '}
              {geefUren(werkdag.startTijd, werkdag.stopTijd)} uur
            </p>
          </div>
        )}

        {/* Wat er van eerdere dagen nog openstaat. Bewust bóven de klus
            van vandaag: wie hier komt kijken omdat hij gisteren niet
            klaar kwam, moet het meteen zien en niet eerst langs een
            ander adres scrollen. */}
        {/* Je staat geklokt op de ene klus en hebt de andere gekozen.
            Nu starten geeft twee lopende werkdagen op één dag, en dan
            klopt de urenregistratie van allebei niet meer. Bewust geen
            blokkade: soms verkas je echt en dan moet het gewoon kunnen —
            maar niemand hoort er per ongeluk in te rollen. */}
        {geklokOp && gekozen && geklokOp !== gekozen.id && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <IconAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Je werkdag loopt nog op een andere klus
                </div>
                <div className="text-sm text-amber-800/80 dark:text-amber-200/70 mt-0.5 break-words">
                  {werkbonnen.find((w) => w.id === geklokOp)?.adres ?? 'Een andere klus'} —
                  stop die eerst, anders lopen er twee werkdagen tegelijk.
                </div>
                <button
                  onClick={() => setGekozenId(geklokOp)}
                  className="mt-2 min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200 underline underline-offset-2"
                >
                  Terug naar die klus
                </button>
              </div>
            </div>
          </div>
        )}

        {ookVandaag.length > 0 && (
          <div className="bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <IconCalendarEvent className="w-4 h-4 flex-shrink-0 text-blue-700 dark:text-blue-400" />
              <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                {ookVandaag.length === 1
                  ? 'Staat vandaag ook voor je ingepland'
                  : `Nog ${ookVandaag.length} klussen vandaag ingepland`}
              </span>
            </div>
            {/* Zonder deze regel is een rij een lijstje en geen knop.
                Aantikken verplaatst je werkdag naar dat adres, en dat
                hoort er te staan voordat je erop drukt. */}
            <p className="text-xs text-blue-800/80 dark:text-blue-200/60 -mt-1 mb-2.5">
              Tik een klus aan om daar je werkdag te starten.
            </p>
            <div className="space-y-1.5">
              {ookVandaag.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setGekozenId(w.id)}
                  className="w-full min-h-[44px] flex items-center gap-2 text-left px-3 py-2 rounded-sm bg-white dark:bg-surface-dark-2 border border-blue-100 dark:border-blue-500/20 hover:border-blue-400 transition-colors"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white break-words">
                      {w.adres}
                    </span>
                    {/* Welke van de twee is de spoedklus en welke loopt
                        de hele week? Twee adressen onder elkaar zeggen
                        dat niet; deze regel wel. */}
                    <span className="block text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                      {duurLabel(w)}
                    </span>
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-400 tabular-nums whitespace-nowrap">
                    {berekenVoortgang(w.taken ?? [])}%
                  </span>
                  <IconChevronRight className="w-4 h-4 flex-shrink-0 text-tekst-gedempt dark:text-white/55" />
                </button>
              ))}
            </div>
          </div>
        )}

        {blijftLiggen.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <IconAlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400" />
              <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {blijftLiggen.length === 1
                  ? 'Nog niet afgerond van een eerdere dag'
                  : `${blijftLiggen.length} klussen nog niet afgerond`}
              </span>
            </div>
            <div className="space-y-1.5">
              {blijftLiggen.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setGekozenId(w.id)}
                  className="w-full min-h-[44px] flex items-center gap-2 text-left px-3 py-2 rounded-sm bg-white dark:bg-surface-dark-2 border border-amber-200 dark:border-amber-500/25 hover:border-amber-400 transition-colors"
                >
                  <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white break-words">
                    {w.adres}
                  </span>
                  <span className="text-xs text-amber-700 dark:text-amber-400 tabular-nums whitespace-nowrap">
                    {berekenVoortgang(w.taken ?? [])}%
                  </span>
                  <IconChevronRight className="w-4 h-4 flex-shrink-0 text-tekst-gedempt dark:text-white/55" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hetzelfde blok als op /werkbon/:id. Eén opbouw, één plek om
            te onderhouden, en geen knop meer naar een mooiere versie
            van ditzelfde scherm. */}
        <Klusuitvoering
          werkbon={vandaag}
          kopje={`Vandaag werk je aan · ${duurLabel(vandaag)}`}
          // De ring bovenaan toont de voortgang al.
          zonderVoortgang
          laden={bonLaadt}
          ophaalfout={bonFout}
          readOnly={!gestart}
          bijschrift={bijschrift}
          grendel={gestart ? undefined : {
            titel: werkdag.fase === 'voor_start'
              ? 'Je werkdag is nog niet gestart'
              : 'Je werkdag is gestopt',
            uitleg: werkdag.fase === 'voor_start'
              ? 'Lezen kan nu al. Afvinken en foto\u2019s maken kan zodra je hier bent gestart \u2014 zo weet kantoor wanneer je aan deze klus begon.'
              : 'Hervat je werkdag om weer af te vinken en foto\u2019s te maken.',
            perPunt: werkdag.fase === 'voor_start'
              ? 'Start je werkdag om dit punt af te vinken'
              : 'Hervat je werkdag om dit punt af te vinken',
            actie: (
              <button
                onClick={werkdag.fase === 'voor_start' ? startWerkdag : hervatWerkdag}
                disabled={werkdagBezig}
                // Omlijnd en niet gevuld. De vaste balk onderin draagt
                // dezelfde handeling als volle groene pil, en die twee
                // stonden tegelijk in beeld — twee identieke knoppen
                // boven elkaar leest als een fout in het scherm. Dit is
                // dezelfde handeling op de plek waar de vraag opkomt,
                // en dat mag er ook zo uitzien.
                className="w-full min-h-[48px] rounded-lg border-2 border-green-600 dark:border-green-500 bg-white dark:bg-surface-dark-2 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 disabled:opacity-60 font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <IconPlayerPlay className="w-5 h-5" />
                {werkdagBezig ? 'BEZIG\u2026' : werkdag.fase === 'voor_start' ? 'START WERKDAG' : 'WERKDAG HERVATTEN'}
              </button>
            ),
          }}
          onRefresh={refetch}
          // De bon is af: de lijst moet er ook van weten, anders kiest
          // `kiesVandaag` morgen nog steeds deze bon.
          onVoltooid={() => { refetch(); refetchLijst() }}
        />

        <Prestaties />
        <WaarWerktWie />
      </Schil>

      <Werkdagbalk
        fase={werkdag.fase}
        bezig={werkdagBezig}
        onStart={startWerkdag}
        onStop={stopWerkdag}
        onHervat={hervatWerkdag}
      />
    </>
  )
}

// ── Onderdelen ────────────────────────────────────────────────

/**
 * Waar je vandaag begint.
 *
 * De eerste kaart van het scherm, en met opzet de enige die een adres
 * groot neerzet. De klacht die hem opleverde: "er staat waar ze
 * beginnen en ook wat niet af is — maar de klus waar ze volgens
 * planning moeten starten moet wel duidelijk te zien zijn." Dat klopte:
 * het adres stond er wel, maar als bovenschriftje van de derde kaart,
 * ónder twee blokken over ánder werk.
 *
 * De regel bovenaan is het hele punt. `kiesVandaag` kiest langs vier
 * wegen en die betekenen vier verschillende dingen: je staat er al, je
 * begint er vandaag, je gaat er verder, of het had gisteren af moeten
 * zijn. Alleen het adres neerzetten laat dat verschil weg, en dan moet
 * de man zelf uitrekenen of hij goed zit.
 *
 * De startknop staat er ook, en niet alleen onderin in de balk. Dit is
 * de plek waar de vraag opkomt — en zolang er niet gestart is, is het
 * de handeling die alles op dit scherm openzet.
 */
function Startkaart({
  adres, plaats, reden, nieuweKlus, duur, start, eind, fase, startTijd,
}: {
  adres: string
  plaats?: string | null
  reden: Startreden
  nieuweKlus: boolean
  duur: string
  start: string
  eind: string
  fase: 'voor_start' | 'actief' | 'gestopt'
  startTijd: Date | null
}) {
  // Vier redenen, vier zinnen. "Hier begin je vandaag" is een opdracht,
  // "je staat hier geklokt" een constatering en "dit had gisteren af
  // moeten zijn" een waarschuwing — dat verschil hoort in de woorden en
  // niet alleen in een kleur.
  const kop: Record<Startreden, { tekst: string; kleur: string; rand: string; vlak: string }> = {
    geklokt: {
      tekst: 'Je staat hier geklokt',
      kleur: 'text-green-800 dark:text-green-300',
      rand: 'border-green-300 dark:border-green-500/30',
      vlak: 'bg-gradient-to-r from-green-100 via-green-50 to-white dark:from-green-500/25 dark:via-green-500/[0.06] dark:to-surface-dark-2',
    },
    vandaag: {
      tekst: nieuweKlus ? 'Hier begin je vandaag' : 'Hier ga je vandaag verder',
      kleur: 'text-blue-900 dark:text-blue-300',
      rand: 'border-blue-300 dark:border-blue-500/30',
      vlak: 'bg-gradient-to-r from-blue-100 via-blue-50 to-white dark:from-blue-500/25 dark:via-blue-500/[0.06] dark:to-surface-dark-2',
    },
    uitgelopen: {
      tekst: 'Dit werk staat nog open',
      kleur: 'text-amber-900 dark:text-amber-200',
      rand: 'border-amber-300 dark:border-amber-500/30',
      vlak: 'bg-gradient-to-r from-amber-100 via-amber-50 to-white dark:from-amber-500/25 dark:via-amber-500/[0.06] dark:to-surface-dark-2',
    },
    komt: {
      tekst: 'Je eerstvolgende klus',
      kleur: 'text-tekst-zwak dark:text-white/70',
      rand: 'border-gray-200 dark:border-white/10',
      vlak: 'bg-gradient-to-r from-surface-2 via-surface-2/40 to-white dark:from-white/10 dark:via-white/[0.03] dark:to-surface-dark-2',
    },
  }
  const k = kop[reden]

  return (
    <div className={cn('rounded-lg border shadow-sm p-5 border-l-[6px]', k.rand, k.vlak)}>
      <p className={cn('text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5', k.kleur)}>
        <IconMapPinFilled className="w-3.5 h-3.5 flex-shrink-0" />
        {k.tekst}
      </p>

      {/* Het adres zo groot als het op dit scherm kan. Dit is het
          antwoord op de enige vraag die om zeven uur 's ochtends telt. */}
      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight break-words mt-1.5">
        {adres}
      </h2>
      {plaats && !adres.toLowerCase().includes(plaats.toLowerCase()) && (
        <p className="text-sm text-tekst-zwak dark:text-white/60">{plaats}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-tekst-zwak dark:text-white/60">
        <span className="flex items-center gap-1">
          <IconCalendar className="w-3.5 h-3.5 flex-shrink-0" />
          {start === eind ? formatKort(start) : `${formatKort(start)} t/m ${formatKort(eind)}`}
        </span>
        <span>{duur}</span>
      </div>

      {/* De stand van de werkdag, in woorden en niet als knop.
          Er stond hier eerst een tweede groene START WERKDAG. Die stond
          dan tegelijk met de vaste balk onderin in beeld — twee
          identieke knoppen boven elkaar, en dat leest als een fout in
          plaats van als een aanbod. Deze kaart beantwoordt "waar ben ik
          vandaag"; het starten hoort bij de balk die altijd binnen
          duimbereik staat, en bij het slot op de punten, want dáár komt
          de vraag op. */}
      <p className={cn(
        'flex items-center gap-1.5 text-xs font-bold mt-3 pt-3 border-t border-black/5 dark:border-white/10',
        fase === 'voor_start' ? 'text-amber-800 dark:text-amber-300' : 'text-tekst-zwak dark:text-white/60',
      )}>
        {fase === 'voor_start' ? (
          <>
            <IconPlayerPlay className="w-3.5 h-3.5 flex-shrink-0" />
            Werkdag nog niet gestart — start hem onderin om af te vinken
          </>
        ) : fase === 'actief' ? (
          <>
            <IconCircleCheck className="w-3.5 h-3.5 flex-shrink-0 text-green-600 dark:text-green-400" />
            Werkdag gestart om {formatTijd(startTijd)}
          </>
        ) : (
          <>
            <IconCircleCheck className="w-3.5 h-3.5 flex-shrink-0 text-green-600 dark:text-green-400" />
            Werkdag gestopt — hervatten kan onderin
          </>
        )}
      </p>
    </div>
  )
}

/** Een datum als "ma 1 sep" — kort genoeg voor één regel op een telefoon. */
function formatKort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * De werkdagknop, altijd op dezelfde plek.
 *
 * Stond eerst per fase ergens anders in de pagina: starten halverwege,
 * stoppen vastgezet onderin, hervatten weer bovenaan. Met dertig punten
 * onder je duim is "waar stond die knop ook alweer" een echte vraag.
 * Nu is het één balk die met de fase meebeweegt.
 *
 * Boven de navigatiebalk op een telefoon, anders valt hij eronder.
 */
function Werkdagbalk({ fase, bezig, onStart, onStop, onHervat }: {
  fase: 'voor_start' | 'actief' | 'gestopt'
  bezig: boolean
  onStart: () => void
  onStop: () => void
  onHervat: () => void
}) {
  const knop = {
    voor_start: {
      onClick: onStart,
      label: 'START WERKDAG',
      icon: <IconPlayerPlay className="w-6 h-6" />,
      className: 'bg-green-600 hover:bg-green-700 text-white',
    },
    actief: {
      onClick: onStop,
      label: 'STOP WERKDAG',
      icon: <IconPlayerStop className="w-5 h-5" />,
      className: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900',
    },
    gestopt: {
      onClick: onHervat,
      label: 'WERKDAG HERVATTEN',
      icon: <IconPlayerPlay className="w-5 h-5" />,
      className: 'bg-white dark:bg-surface-dark-2 border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white',
    },
  }[fase]

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 md:left-60 right-0 z-40 p-4 bg-white/90 dark:bg-surface-dark-2/90 backdrop-blur-sm border-t border-gray-100 dark:border-white/10">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={knop.onClick}
          disabled={bezig}
          className={cn(
            'w-full py-4 rounded-lg font-extrabold flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60 disabled:active:scale-100',
            knop.className
          )}
        >
          {knop.icon}
          {bezig ? 'BEZIG…' : knop.label}
        </button>

        {/* De informatieplicht, op de plek waar het gebeurt.
            Bij het aanmelden wordt eenmalig de locatie opgevraagd om de
            afstand tot de klus te bepalen. Dat mag alleen als degene om
            wie het gaat het weet — stil meten is niet toegestaan, hoe
            onschuldig het doel ook is. Eén regel hier, de uitleg staat
            in het personeelsreglement.
            Alleen vóór het starten: daarna is er niets meer op te
            vragen en zou het een waarschuwing zijn zonder aanleiding. */}
        {LOCATIE_AAN && fase === 'voor_start' && (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-tekst-gedempt dark:text-white/55 mt-2 max-w-prose">
            <IconMapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
            Bij het aanmelden wordt je locatie eenmalig opgevraagd om de afstand
            tot het werkadres te bepalen. Je positie wordt niet bewaard en je
            wordt niet gevolgd tijdens de dag.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Hoe sta ik ervoor vandaag.
 *
 * Waren vier losse tegels: punten klaar, foto's, voortgang en gewerkte
 * tijd, elk in een eigen vak met een eigen getal. Vier getallen naast
 * elkaar is geen antwoord op één vraag, en "Punten klaar 1/3" en
 * "Voortgang 33%" zeiden bovendien hetzelfde ding twee keer.
 *
 * Nu één kaart met de ring in het midden. Die lees je met een halve
 * blik en een handschoen aan: de kleur zegt hoe het staat, het getal
 * hoe ver. Wat er omheen staat is aanvullend en niet concurrerend.
 */
function Dagkaart({ aantalKlaar, aantalTaken, aantalFotos, voortgang, uren, stand }: {
  aantalKlaar: number; aantalTaken: number; aantalFotos: number
  voortgang: number; uren: string; stand: Klusstand
}) {
  const k = STANDEN[stand]

  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
      <div className="flex items-center gap-5">
        <Voortgangsring
          waarde={voortgang}
          onder={`${aantalKlaar}/${aantalTaken}`}
          maat={104}
          kleur={k.tekst}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <span className={cn('inline-flex items-center gap-1.5 text-sm font-bold', k.tekst)}>
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', k.bol)} />
            {k.label}
          </span>

          <div className="grid grid-cols-2 gap-3">
            <Cijfer icon={<IconClock className="w-4 h-4" />} waarde={uren} label="gewerkt" />
            <Cijfer icon={<IconPhoto className="w-4 h-4" />} waarde={aantalFotos} label={aantalFotos === 1 ? 'foto' : "foto's"} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Eén getal met een pictogram ervoor. Klein, want de ring is de kop. */
function Cijfer({ icon, waarde, label }: { icon: React.ReactNode; waarde: string | number; label: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-8 h-8 rounded-lg bg-surface-2 dark:bg-white/5 flex items-center justify-center flex-shrink-0 text-tekst-gedempt dark:text-white/55">
        {icon}
      </span>
      <span className="min-w-0">
        {/* `truncate`: een lange waarde schoof hier onder het pictogram
            van het vakje ernaast door in plaats van af te breken. */}
        <span className="block text-base font-extrabold tabular-nums leading-none text-gray-900 dark:text-white truncate">
          {waarde}
        </span>
        <span className="block text-[11px] text-tekst-gedempt dark:text-white/55 mt-0.5 truncate">{label}</span>
      </span>
    </div>
  )
}

/** Stond op verzonnen cijfers; nu geteld uit de echte tabellen. */
function Prestaties() {
  const { data, loading } = useMijnPrestaties()

  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
      <SectionHeading title="Mijn cijfers" actions={<IconTrophy className="w-4 h-4 text-brand-yellow-dark dark:text-brand-yellow" />} />
      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5" /></div>
      ) : (
        /* Drie kale getallen naast elkaar met een streepje ertussen.
           Nu elk in een eigen vakje met een pictogram: het leest als
           drie dingen in plaats van als een rij cijfers, en op een
           telefoon van 390 pixels valt het niet meer uit elkaar. */
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { waarde: data.werkbonnenAfgerond, label: 'bonnen af', icon: <IconCircleCheck className="w-4 h-4" /> },
            { waarde: data.werkdagenGewerkt, label: 'werkdagen', icon: <IconClock className="w-4 h-4" /> },
            { waarde: data.fotosGemaakt, label: "foto's", icon: <IconPhoto className="w-4 h-4" /> },
          ].map((c) => (
            <div
              key={c.label}
              className="min-w-0 text-center rounded-lg bg-surface-2/60 dark:bg-white/5 px-2 py-3"
            >
              <span className="inline-flex text-brand-yellow-dark dark:text-brand-yellow">{c.icon}</span>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums mt-1 leading-none">
                {c.waarde}
              </p>
              <p className="text-[10px] sm:text-[11px] text-tekst-gedempt dark:text-white/55 mt-1 leading-tight break-words">
                {c.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Waar zit iedereen vandaag. Toont uitsluitend adres en naam — de
 * databasefunctie geeft niet meer terug, dus een werkbon van een
 * collega blijft dicht.
 */
function WaarWerktWie() {
  const dag = isoDatum()
  const { regels, loading } = usePlanningDoorkijk(dag, dag)

  if (!loading && regels.length === 0) return null

  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-lg shadow-sm p-5">
      <SectionHeading title="Wie werkt waar vandaag" actions={<IconUsers className="w-4 h-4 text-tekst-gedempt dark:text-white/55" />} />
      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5" /></div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-white/5">
          {regels.map((r, i) => (
            <div key={`${r.adres}-${r.medewerker}-${i}`} className="flex items-center gap-3 py-2.5">
              <Avatar naam={r.medewerker} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.medewerker}</p>
                <p className="text-xs text-tekst-gedempt dark:text-white/55 truncate">
                  {r.adres}{r.plaats ? `, ${r.plaats}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// NMZ GO — hoe een klus ervoor staat, en welke kleur daarbij hoort
// ============================================================
// Eén bron voor twee vragen die overal in de app terugkwamen en overal
// een ander antwoord kregen: "staat deze klus stil, loopt hij, of is
// hij klaar?" en "welke kleur is dat dan?".
//
// Zeven schermen beantwoordden dat zelf. Een klus die liep was blauw op
// de planning, amber op de werkbon en geel op Mijn bonnen; de rand van
// een werkbonkaart was geel voor open, bezig én afgerond, en zei
// daarmee niets. Nu staat het hier, één keer.
//
// ── De kleurtaal ──
//   grijs      nog niet gestart
//   blauw      bezig
//   violet     alles afgevinkt, wacht op afronden
//   groen      afgerond en opgeleverd
//   rood       ligt stil
//
// Geel doet hier niet mee. Dat is het merk: knoppen, vandaag,
// voortgangsbalken, de kickerbalk voor een kop. Zie
// `PRODUCT_VISION.md` → Kleurgebruik. Een kleur die zowel "dit is NMZ"
// als "deze klus loopt" betekent, betekent uiteindelijk geen van beide.
//
// Kleur is nooit het enige signaal: elke stand heeft ook een woord, en
// dat woord staat er altijd bij. Fel zonlicht op een telefoonscherm in
// een voortuin maakt elk kleurverschil twijfelachtig.
// ============================================================

export type Klusstand =
  | 'niet_gestart'
  | 'bezig'
  | 'af_te_ronden'
  | 'afgerond'
  | 'opgeleverd'
  | 'stilgelegd'

/**
 * Zet de kleurwas op de lijstschermen uit.
 *
 * Aan: een kaart in een lijst krijgt een zachte tint in de kleur van
 * zijn stand, zoals de weekplanning doet. Uit: alleen de rand links en
 * de badge dragen de kleur en blijft de kaart wit.
 *
 * Dit is één schakelaar en geen instelling per scherm, want het hele
 * punt is dat de lijsten er hetzelfde uitzien.
 */
export const KLEURWAS = true

/** Genoeg van een werkbon om te weten hoe hij ervoor staat. */
export interface Klusfeiten {
  status?: string | null
  stilgelegd_op?: string | null
  opgeleverd_op?: string | null
  /** De punten, of alleen hun aantallen als het scherm die al geteld heeft. */
  taken?: { voltooid: boolean }[] | null
  puntenKlaar?: number | null
  punten?: number | null
}

/**
 * Hoe staat deze klus ervoor?
 *
 * De volgorde is de volgorde waarin je het wilt weten. Stilgelegd wint
 * van alles: dat is het enige dat een telefoontje vraagt. Daarna telt
 * wat er is opgeleverd, dan wat de ploeg heeft afgerond, en dan pas of
 * er iets loopt.
 *
 * "Bezig" komt bewust **niet** alleen uit `werkbonnen.status`. Die
 * kolom kan 'open', 'bezig' of 'voltooid' zijn, maar niets zet hem ooit
 * op 'bezig': de ClickUp-synchronisatie raakt hem niet aan en de
 * handmatige knop op de werkbon gebruikt niemand. Gevolg: alle dertig
 * bonnen stonden op 'open', ook die waar zeven punten waren afgevinkt
 * en elf foto's op stonden. Elk scherm noemde dat "nog niet gestart".
 *
 * Een afgevinkt punt is bewijs dat iemand daar is geweest. Dát is wat
 * "bezig" betekent, en daar hoeft niemand een knop voor te vinden.
 *
 * Tussen bezig en afgerond zit `af_te_ronden`: alles is afgevinkt maar
 * niemand heeft de bon dichtgedaan. Groen zou daar te vroeg zijn — er
 * moet nog iemand op een knop drukken voordat kantoor kan opleveren —
 * en "Bezig" op 100% las als een tegenspraak. Het is de wachtrij van
 * kantoor, en die hoort als aparte stand op het bord te staan.
 */
export function klusstand(k: Klusfeiten): Klusstand {
  if (k.stilgelegd_op) return 'stilgelegd'
  if (k.opgeleverd_op) return 'opgeleverd'
  if (k.status === 'voltooid') return 'afgerond'

  const punten = k.taken ?? []
  const klaar = k.puntenKlaar ?? punten.filter((t) => t.voltooid).length
  const totaal = k.punten ?? punten.length

  // Nul van nul is geen voltooide bon maar een bon zonder punten — een
  // verse klus uit ClickUp waarvan de werkopdracht nog niet is ontleed.
  if (totaal > 0 && klaar >= totaal) return 'af_te_ronden'
  if (k.status === 'bezig' || klaar > 0) return 'bezig'

  return 'niet_gestart'
}

interface Standkleur {
  /** Het woord. Staat altijd naast de kleur, nooit in plaats daarvan. */
  label: string
  /**
   * Hetzelfde woord voor een smalle kolom. Zes dagen naast elkaar op
   * een laptop laat zo'n honderdvijftig pixels over; "Nog niet
   * gestart" werd daar "Nog niet gest…" en dat leest slechter dan een
   * kortere zin die wél past.
   */
  kort: string
  /** Variant voor `<Badge>`. */
  badge: 'gray' | 'blue' | 'violet' | 'green' | 'red'
  /** Rand links van een kaart — leest van een afstand. */
  rand: string
  /** Bolletje of voortgangsbalk in de kleur van de stand. */
  bol: string
  /** Zachte tint over het hele kaartje. Alleen met `KLEURWAS` aan. */
  vlak: string
  /** Vlak en rand samen, voor een kaart zonder eigen randkleur. */
  omlijsting: string
  /** Bed onder een voortgangsbalkje. */
  balkbed: string
  /** Tekst in de kleur van de stand. */
  tekst: string
}

export const STANDEN: Record<Klusstand, Standkleur> = {
  // Wat nog niet begonnen is blijft neutraal. Anders krijgt een week vol
  // werk dat nog moet starten de meeste kleur van allemaal, en dat is
  // precies verkeerd om.
  niet_gestart: {
    label: 'Nog niet gestart',
    kort: 'Niet gestart',
    badge: 'gray',
    rand: 'border-l-gray-300 dark:border-l-white/25',
    bol: 'bg-gray-300 dark:bg-white/30',
    vlak: 'bg-white dark:bg-surface-dark-2',
    omlijsting: 'border-gray-100 dark:border-white/10',
    balkbed: 'bg-gray-100 dark:bg-white/10',
    tekst: 'text-gray-500 dark:text-white/50',
  },
  bezig: {
    label: 'Bezig',
    kort: 'Bezig',
    badge: 'blue',
    rand: 'border-l-blue-500',
    bol: 'bg-blue-500',
    vlak: 'bg-blue-50/70 dark:bg-blue-500/10',
    omlijsting: 'border-blue-100 dark:border-blue-500/20',
    balkbed: 'bg-blue-100 dark:bg-blue-500/20',
    tekst: 'text-blue-700 dark:text-blue-400',
  },
  // Alles afgevinkt, nog niet dichtgedaan — de wachtrij van kantoor.
  //
  // Violet, en dat is een bewuste omweg. Amber zou de gewone keuze zijn
  // voor "hier moet iemand iets doen", maar geel is merkkleur en zou
  // hier "actie" en "dit is NMZ" door elkaar halen. Turkoois stond hier
  // eerst en lag te dicht bij groen: in donkere modus was een klus die
  // wacht niet te onderscheiden van een klus die klaar is, en juist dat
  // verschil is de hele reden dat deze stand bestaat.
  af_te_ronden: {
    label: 'Klaar om af te ronden',
    kort: 'Af te ronden',
    badge: 'violet',
    rand: 'border-l-violet-500',
    bol: 'bg-violet-500',
    vlak: 'bg-violet-50/70 dark:bg-violet-500/10',
    omlijsting: 'border-violet-100 dark:border-violet-500/20',
    balkbed: 'bg-violet-100 dark:bg-violet-500/20',
    tekst: 'text-violet-700 dark:text-violet-400',
  },
  afgerond: {
    label: 'Afgerond',
    kort: 'Afgerond',
    badge: 'green',
    rand: 'border-l-green-500',
    bol: 'bg-green-500',
    vlak: 'bg-green-50/70 dark:bg-green-500/10',
    omlijsting: 'border-green-100 dark:border-green-500/20',
    balkbed: 'bg-green-100 dark:bg-green-500/20',
    tekst: 'text-green-700 dark:text-green-400',
  },
  // Dezelfde kleur als afgerond, een ander woord. Voor de ploeg is het
  // verschil er niet; voor kantoor zit het in het woord, want alleen
  // een uitvoerder of hoger levert op.
  opgeleverd: {
    label: 'Opgeleverd',
    kort: 'Opgeleverd',
    badge: 'green',
    rand: 'border-l-green-500',
    bol: 'bg-green-500',
    vlak: 'bg-green-50/70 dark:bg-green-500/10',
    omlijsting: 'border-green-100 dark:border-green-500/20',
    balkbed: 'bg-green-100 dark:bg-green-500/20',
    tekst: 'text-green-700 dark:text-green-400',
  },
  // Rood is hiervoor gereserveerd. Het enige dat een telefoontje vraagt.
  stilgelegd: {
    label: 'Ligt stil',
    kort: 'Ligt stil',
    badge: 'red',
    rand: 'border-l-brand-red',
    bol: 'bg-brand-red',
    vlak: 'bg-brand-red-light dark:bg-brand-red/10',
    omlijsting: 'border-brand-red/30 dark:border-brand-red/30',
    balkbed: 'bg-brand-red/15 dark:bg-brand-red/20',
    tekst: 'text-brand-red dark:text-red-400',
  },
}

/** De kleuren die bij een klus horen, in één aanroep. */
export function standkleur(k: Klusfeiten): Standkleur {
  return STANDEN[klusstand(k)]
}

/**
 * De volgorde waarin je klussen wilt zien.
 *
 * Niet alfabetisch en niet op aanmaakdatum, maar op wat er van je
 * gevraagd wordt. Bovenaan wat een telefoontje kost, onderaan wat af
 * is:
 *
 *   1. ligt stil            — iemand moet bellen
 *   2. klaar om af te ronden — één druk op de knop en het is klaar
 *   3. bezig                 — loopt, hou het in de gaten
 *   4. nog niet gestart      — staat te wachten
 *   5. afgerond              — geen actie meer
 *   6. opgeleverd            — dossier dicht
 *
 * Afgerond en opgeleverd staan onderaan omdat ze niets meer vragen.
 * Wie ze zoekt gebruikt het filter; wie het bord openslaat wil zien
 * wat er nog moet gebeuren.
 */
export const STANDVOLGORDE: Record<Klusstand, number> = {
  stilgelegd: 0,
  af_te_ronden: 1,
  bezig: 2,
  niet_gestart: 3,
  afgerond: 4,
  opgeleverd: 5,
}

/**
 * Sorteert op stand, en binnen dezelfde stand op de meegegeven sleutel
 * — in de praktijk de startdatum, zodat wat het langst wacht bovenaan
 * komt. Zonder die tweede sleutel is de volgorde binnen een stand die
 * van de database, en dat verspringt tussen twee ophaalrondes.
 */
export function vergelijkStand<T>(
  a: T,
  b: T,
  feiten: (x: T) => Klusfeiten,
  tweede: (x: T) => string = () => '',
): number {
  const verschil = STANDVOLGORDE[klusstand(feiten(a))] - STANDVOLGORDE[klusstand(feiten(b))]
  if (verschil !== 0) return verschil
  return tweede(a).localeCompare(tweede(b))
}

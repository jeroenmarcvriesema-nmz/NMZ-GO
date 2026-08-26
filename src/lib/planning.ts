// ============================================================
// NMZ GO — datum- en planningsrekenwerk
// ============================================================
// Deze functies stonden verspreid in de schermen die ze gebruiken.
// Ze zijn hierheen verhuisd om één reden: dit is waar de fouten zaten.
// "Welke klus is vandaag" gaf ooit het adres van de klus die het verst
// weg lag, en dat merk je pas als iemand 's ochtends naar de verkeerde
// stad rijdt. Zulke regels horen apart te staan en getest te worden.
// ============================================================

/**
 * De datum als `jjjj-mm-dd`, in de tijdzone van de gebruiker.
 *
 * Bewust niet `toISOString()`: die rekent in UTC, en tussen middernacht
 * en 02:00 Nederlandse zomertijd levert dat de dag ervóór op. Dat is
 * precies het moment waarop een nachtdienst of een vroege ochtend zijn
 * eigen klus niet meer zou zien.
 */
export function isoDatum(d: Date = new Date()): string {
  const jaar = d.getFullYear()
  const maand = String(d.getMonth() + 1).padStart(2, '0')
  const dag = String(d.getDate()).padStart(2, '0')
  return `${jaar}-${maand}-${dag}`
}

/** Zoveel dagen telt een werkweek bij ons: maandag tot en met zaterdag. */
export const WERKDAGEN = 6

/** Maandag van de week waar deze datum in valt. */
export function maandagVan(d: Date): Date {
  const kopie = new Date(d)
  const dag = (kopie.getDay() + 6) % 7 // maandag = 0
  kopie.setDate(kopie.getDate() - dag)
  kopie.setHours(0, 0, 0, 0)
  return kopie
}

/**
 * De werkdagen van een week, vanaf maandag.
 *
 * Zes dagen, niet vijf. Zaterdag wordt bij ons gebruikt om dingen af te
 * maken en voor garantiewerk — die dag hoort dus gewoon in de planning
 * en niet in een uitzondering. Zondag blijft eruit: dat is geen
 * werkdag, en een lege zevende kolom kost alleen ruimte.
 */
export function weekDagen(maandag: Date, aantal = WERKDAGEN): Date[] {
  return Array.from({ length: aantal }, (_, n) => {
    const d = new Date(maandag)
    d.setDate(maandag.getDate() + n)
    return d
  })
}

/**
 * Het weeknummer volgens ISO 8601 — het nummer waar in Nederland mee
 * gepland wordt.
 *
 * "Week 33" zegt iedereen op kantoor en in de bus; "10 t/m 14 augustus"
 * moet je omrekenen. De regel is: week 1 is de week met de eerste
 * donderdag van het jaar erin. Vandaar dat we naar de donderdag van
 * deze week springen en dáár het jaar van pakken — een week eind
 * december kan bij het volgende jaar horen en andersom.
 */
export function weeknummer(d: Date): number {
  const donderdag = new Date(d)
  donderdag.setHours(0, 0, 0, 0)
  // Naar de donderdag van deze week (maandag = 0).
  donderdag.setDate(donderdag.getDate() - ((d.getDay() + 6) % 7) + 3)

  const eersteDonderdag = new Date(donderdag.getFullYear(), 0, 4)
  eersteDonderdag.setDate(
    eersteDonderdag.getDate() - ((eersteDonderdag.getDay() + 6) % 7) + 3,
  )

  const dagen = (donderdag.getTime() - eersteDonderdag.getTime()) / 86_400_000
  return 1 + Math.round(dagen / 7)
}

/**
 * Hoe je een week noemt als je hem op het scherm zet.
 *
 * "Deze week" en "volgende week" zijn hoe erover gepraat wordt; het
 * weeknummer erbij zodat het aansluit op ClickUp en op de planning aan
 * de muur. Verder weg dan een week of twee zegt "deze/volgende" niets
 * meer en blijft alleen het nummer over.
 */
export function weekLabel(verschuiving: number, vanaf: Date = new Date()): string {
  const weekend = vanaf.getDay() === 0

  if (verschuiving === 0) {
    // In het weekend is "deze week" de week die maandag begint. Hem
    // "deze week" noemen is dan verwarrend — je staat er nog niet in.
    return weekend ? 'Komende week' : 'Deze week'
  }
  if (verschuiving === 1) return weekend ? 'De week daarna' : 'Volgende week'
  if (verschuiving === -1) return weekend ? 'Afgelopen week' : 'Vorige week'
  if (verschuiving > 1) return `Over ${verschuiving} weken`
  return `${Math.abs(verschuiving)} weken terug`
}

/**
 * De maandag van de wérkweek waar je op dit moment naar kijkt.
 *
 * In het weekend is dat de week die eraan komt, niet de week die net
 * is afgelopen. Dat wijkt bewust af van de ISO-regel die `maandagVan()`
 * volgt — daar hoort zondag nog bij de week ervoor, en dat klopt voor
 * een weeknummer.
 *
 * Maar niemand kijkt op zondagavond naar de planning van de week die
 * vrijdag is geëindigd. Wie in het weekend de app opent wil weten wat
 * er maandag staat. Zonder deze regel opende de planning op zondag op
 * een lege week terwijl al het werk in de week erna stond, en dan lijkt
 * het alsof er niets is ingepland.
 */
export function maandagVanWerkweek(vanaf: Date = new Date()): Date {
  // Alleen zondag rolt door. Zaterdag is sinds de werkweek zes dagen
  // telt een gewone werkdag: wie er dan naar kijkt wil zíjn dag zien,
  // niet die van overmorgen.
  if (vanaf.getDay() === 0) {
    const morgen = new Date(vanaf)
    morgen.setDate(morgen.getDate() + 1)
    return maandagVan(morgen)
  }
  return maandagVan(vanaf)
}

/** De maandag van de week die `verschuiving` werkweken van nu ligt. */
export function maandagVerschoven(verschuiving: number, vanaf: Date = new Date()): Date {
  const ma = maandagVanWerkweek(vanaf)
  ma.setDate(ma.getDate() + verschuiving * 7)
  return ma
}

/**
 * Valt deze klus in de week die op `maandag` begint?
 *
 * Een klus van drie weken valt in alle drie die weken — daarom kijken
 * we naar overlap en niet naar de startdatum. Wie in week 34 kijkt wil
 * ook de klus zien die in week 33 begon en nog loopt.
 */
export function inWeek(w: Ingepland, maandag: Date): boolean {
  const dagen = weekDagen(maandag)
  const van = isoDatum(dagen[0])
  const tot = isoDatum(dagen[dagen.length - 1])
  return startVan(w) <= tot && eindVan(w) >= van
}

/**
 * Het minimum dat een bon moet hebben om ingepland te kunnen worden.
 * Bewust structureel getypeerd: dan werkt dit ook voor een rij uit een
 * andere query zonder dat het hele `Werkbon`-type mee hoeft.
 */
export interface Ingepland {
  datum: string
  geplande_start?: string | null
  geplande_eind?: string | null
  status?: string | null
  opgeleverd_op?: string | null
}

/** Eerste dag waarop deze klus loopt. */
export function startVan(w: Ingepland): string {
  return w.geplande_start ?? w.datum
}

/** Laatste dag waarop deze klus loopt. */
export function eindVan(w: Ingepland): string {
  return w.geplande_eind ?? w.geplande_start ?? w.datum
}

/** Loopt deze klus op die dag? Een meerdaagse klus telt op elke dag mee. */
export function looptOp(w: Ingepland, dag: string): boolean {
  return startVan(w) <= dag && eindVan(w) >= dag
}

/**
 * Welke klus is vandaag aan de beurt?
 *
 * Iemand kan op meerdere werkbonnen staan — de planning loopt weken
 * vooruit. "De eerste open bon" was hier ooit goed genoeg omdat er één
 * bon was; met de echte planning erin pakte dat de bon met de láátste
 * datum, dus de klus die het verst weg ligt. Iemand kreeg dan 's
 * ochtends het verkeerde adres te zien.
 *
 * De volgorde die klopt:
 *   1. De klus waarop je geklokt staat. Je bent er al.
 *   2. Een klus die vandaag loopt. Lopen er meerdere, dan die het
 *      eerst af moet — zie `looptVandaag`.
 *   3. Anders werk dat nog niet af is en waarvan de datum voorbij is.
 *   4. Anders de eerstvolgende die nog moet beginnen.
 *
 * Punt 3 stond hier eerst onderaan, ná "de eerstvolgende die nog moet
 * beginnen". Dat was verkeerd om, en het leverde de meeste vragen op
 * van de hele app: een klus die uitliep verdween 's ochtends van het
 * scherm van de ploeg. Ze stonden er nog, maar de app liet hun
 * volgende klus zien — of, als die er niet was, niets.
 *
 * Wat gisteren niet af kwam is vandaag het eerste dat af moet. Dat
 * weegt zwaarder dan werk dat pas volgende week begint, en zwaarder
 * dan een leeg scherm.
 */
/**
 * Alles wat vandaag loopt, in de volgorde waarin het af moet.
 *
 * Er staat lang niet altijd één klus op een dag. Iemand staat vijf
 * dagen op een klus en er komt één dag een klusje tussendoor: dan
 * lopen er twee, en de tussendoorklus is degene die vandáág af moet.
 *
 * Vandaar de volgorde op einddatum en niet op begindatum. Wat vandaag
 * eindigt gaat voor wat pas donderdag eindigt — er is maar één dag om
 * het te doen. Bij een gelijke einddatum wint de klus die het langst
 * loopt, want daar staat de ploeg al.
 *
 * Op begindatum sorteren gaf hier het verkeerde antwoord: dan wint de
 * meerdaagse klus altijd, en stond de tussendoorklus nergens op het
 * scherm van de ploeg. Precies de klus die niet vergeten mag worden.
 */
export function looptVandaag<T extends Ingepland>(
  bonnen: T[],
  nu: string = isoDatum(),
): T[] {
  return bonnen
    .filter((w) => w.status !== 'voltooid' && !w.opgeleverd_op && looptOp(w, nu))
    .sort((a, b) => {
      const eind = eindVan(a).localeCompare(eindVan(b))
      return eind !== 0 ? eind : startVan(a).localeCompare(startVan(b))
    })
}

export function kiesVandaag<T extends Ingepland & { id?: string }>(
  bonnen: T[],
  nu: string = isoDatum(),
  geklokOp?: string | null,
): T | null {
  const open = bonnen.filter((w) => w.status !== 'voltooid' && !w.opgeleverd_op)
  if (open.length === 0) return null

  // Sta je geklokt, dan is dat de klus. Geen planning die daar
  // overheen gaat: je bent er, dat is geen voorspelling maar een feit.
  //
  // Dit is het geval waar de planning het mis heeft en de man niet.
  // Iemand klokt 's ochtends in op de weekklus, kantoor drukt er om
  // tien uur een spoedje tussen — zonder dit springt de bovenste kaart
  // naar dat spoedje terwijl zijn werkdag nog op de weekklus loopt, en
  // vinkt hij punten af op het verkeerde adres.
  if (geklokOp) {
    const bezig = open.find((w) => w.id === geklokOp)
    if (bezig) return bezig
  }

  const loopt = looptVandaag(open, nu)
  if (loopt.length > 0) return loopt[0]

  // Uitgelopen werk. De klus die het kortst geleden had moeten
  // eindigen staat vooraan: daar stond de ploeg gisteren, en dat is de
  // klus waar ze vanochtend over bellen.
  const uitgelopen = uitgelopenWerk(open, nu)
  if (uitgelopen.length > 0) return uitgelopen[0]

  const komt = open
    .filter((w) => startVan(w) > nu)
    .sort((a, b) => startVan(a).localeCompare(startVan(b)))
  if (komt.length > 0) return komt[0]

  return [...open].sort((a, b) => eindVan(b).localeCompare(eindVan(a)))[0]
}

/**
 * Alles wat niet af is en waarvan de einddatum voorbij is.
 *
 * `kiesVandaag` pakt hier de eerste uit, maar het scherm heeft de hele
 * lijst nodig: staat er vandaag óók een nieuwe klus gepland, dan kiest
 * `kiesVandaag` die, en moet het werk van gisteren er alsnog naast
 * staan. Anders is het precies zo onzichtbaar als het was.
 *
 * Nieuwste eind eerst — wat gisteren afliep vóór wat vorige maand
 * afliep.
 */
export function uitgelopenWerk<T extends Ingepland>(
  bonnen: T[],
  nu: string = isoDatum(),
): T[] {
  return bonnen
    .filter((w) => w.status !== 'voltooid' && !w.opgeleverd_op && eindVan(w) < nu)
    .sort((a, b) => eindVan(b).localeCompare(eindVan(a)))
}

/**
 * Zet een lijst klussen op volgorde, in blokken per week.
 *
 * Een lijst van dertig bonnen achter elkaar zegt niets over wanneer
 * iets staat — dat was precies de klacht: "ik zie alles staan maar niet
 * bij welke week het hoort".
 *
 * Een klus die meerdere weken duurt staat in élke week waarin hij
 * loopt, niet alleen in de week waarin hij begon. Dat is geen
 * verdubbeling maar de werkelijkheid: de Bentinckstraat loopt van 24
 * juli tot 14 augustus, en wie week 33 bekijkt hoort te zien dat er
 * die week iemand staat. Hem alleen onder week 30 zetten betekent dat
 * je hem in week 33 niet ziet en denkt dat de ploeg vrij is.
 *
 * Per week staat erbij of hij daar begint of eindigt, zodat het scherm
 * "loopt door" kan tonen en het onderscheid zichtbaar blijft.
 *
 * Nieuwste week bovenaan, want de vraag gaat vrijwel altijd over wat
 * eraan komt en niet over wat is geweest.
 */
export interface Weekblok<T> {
  maandag: Date
  nummer: number
  items: { bon: T; begintHier: boolean; eindigtHier: boolean }[]
}

/** Meer dan een halfjaar doorlopen is geen klus meer maar een fout in de data. */
const MAX_WEKEN = 26

export function groepeerPerWeek<T extends Ingepland>(bonnen: T[]): Weekblok<T>[] {
  const blokken = new Map<string, Weekblok<T>>()

  const zet = (ma: Date, bon: T, begintHier: boolean, eindigtHier: boolean) => {
    const sleutel = isoDatum(ma)
    let blok = blokken.get(sleutel)
    if (!blok) {
      blok = { maandag: new Date(ma), nummer: weeknummer(ma), items: [] }
      blokken.set(sleutel, blok)
    }
    blok.items.push({ bon, begintHier, eindigtHier })
  }

  for (const b of bonnen) {
    const eersteMa = maandagVan(new Date(startVan(b)))
    const laatsteMa = maandagVan(new Date(eindVan(b)))

    const loop = new Date(eersteMa)
    let n = 0
    while (loop.getTime() <= laatsteMa.getTime() && n < MAX_WEKEN) {
      zet(
        loop,
        b,
        loop.getTime() === eersteMa.getTime(),
        loop.getTime() === laatsteMa.getTime(),
      )
      loop.setDate(loop.getDate() + 7)
      n++
    }
  }

  return [...blokken.values()]
    .sort((a, b) => b.maandag.getTime() - a.maandag.getTime())
    .map((blok) => ({
      ...blok,
      items: blok.items.sort((a, b) => startVan(a.bon).localeCompare(startVan(b.bon))),
    }))
}

/**
 * Waar in de klus zit deze dag?
 *
 * Een zwamsaneerder staat soms tien dagen op één adres en krijgt er een
 * spoedje van twee dagen tussendoor. Twee adressen onder elkaar zonder
 * meer zegt dan niets: welke is de lange, welke moet vandaag af, en hoe
 * ver ben ik? Vandaar dag en totaal, in dagen zoals de planning ze
 * telt.
 *
 * Buiten de periode wordt geklemd. Een klus die uitloopt heeft zijn
 * eigen blok op het scherm; hier hoort geen "dag 12 van 10" te staan.
 */
export function dagInKlus(w: Ingepland, nu: string = isoDatum()): { dag: number; totaal: number } {
  const dagen = (van: string, tot: string) =>
    Math.round((Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) / 86_400_000)

  const totaal = Math.max(1, dagen(startVan(w), eindVan(w)) + 1)
  const dag = Math.min(totaal, Math.max(1, dagen(startVan(w), nu) + 1))
  return { dag, totaal }
}

/**
 * Hetzelfde in één regel, zoals het op het scherm van de ploeg staat.
 *
 * "Alleen vandaag" is het belangrijkste geval: dat is het spoedje dat
 * er tussendoor is gedrukt en waar één dag voor is. "Laatste dag" komt
 * daarna — dat is de dag waarop iemand nog even doorzet in plaats van
 * het naar morgen te schuiven.
 */
export function duurLabel(w: Ingepland, nu: string = isoDatum()): string {
  const { dag, totaal } = dagInKlus(w, nu)
  if (totaal === 1) return 'alleen vandaag'
  if (dag === totaal) return `laatste dag van ${totaal}`
  return `dag ${dag} van ${totaal}`
}

/**
 * Hoeveel dagen loopt deze klus over zijn planning heen?
 *
 * Nul betekent op schema of nog bezig binnen de planning. Een negatief
 * getal bestaat niet: eerder klaar is geen uitloop.
 */
export function dagenUitloop(w: Ingepland, nu: string = isoDatum()): number {
  if (w.opgeleverd_op || w.status === 'voltooid') return 0
  const eind = eindVan(w)
  if (eind >= nu) return 0
  const verschil = Date.parse(`${nu}T00:00:00Z`) - Date.parse(`${eind}T00:00:00Z`)
  return Math.round(verschil / 86_400_000)
}

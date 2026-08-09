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

/** Maandag van de week waar deze datum in valt. */
export function maandagVan(d: Date): Date {
  const kopie = new Date(d)
  const dag = (kopie.getDay() + 6) % 7 // maandag = 0
  kopie.setDate(kopie.getDate() - dag)
  kopie.setHours(0, 0, 0, 0)
  return kopie
}

/** De werkdagen van een week, vanaf maandag. */
export function weekDagen(maandag: Date, aantal = 5): Date[] {
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
  const dag = vanaf.getDay()
  const weekend = dag === 0 || dag === 6

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
  const dag = vanaf.getDay() // 0 = zondag, 6 = zaterdag
  if (dag === 0 || dag === 6) {
    const komende = new Date(vanaf)
    komende.setDate(komende.getDate() + (dag === 6 ? 2 : 1))
    return maandagVan(komende)
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
  const tot = isoDatum(dagen[4])
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
 *   1. Een klus die vandaag loopt (vandaag valt binnen start en eind).
 *   2. Anders de eerstvolgende die nog moet beginnen.
 *   3. Anders de laatste die nog niet af is — dan is hij uitgelopen en
 *      moet hij juist bovenaan staan.
 */
export function kiesVandaag<T extends Ingepland>(bonnen: T[], nu: string = isoDatum()): T | null {
  const open = bonnen.filter((w) => w.status !== 'voltooid' && !w.opgeleverd_op)
  if (open.length === 0) return null

  const loopt = open
    .filter((w) => looptOp(w, nu))
    .sort((a, b) => startVan(a).localeCompare(startVan(b)))
  if (loopt.length > 0) return loopt[0]

  const komt = open
    .filter((w) => startVan(w) > nu)
    .sort((a, b) => startVan(a).localeCompare(startVan(b)))
  if (komt.length > 0) return komt[0]

  // Alles ligt in het verleden en is niet af: uitgelopen werk.
  return [...open].sort((a, b) => eindVan(b).localeCompare(eindVan(a)))[0]
}

/**
 * Zet een lijst klussen op volgorde, in blokken per week.
 *
 * Een lijst van dertig bonnen achter elkaar zegt niets over wanneer
 * iets staat — dat was precies de klacht: "ik zie alles staan maar niet
 * bij welke week het hoort". Een klus wordt ingedeeld op de week waarin
 * hij begint; loopt hij door, dan zegt zijn eigen datumregel de rest.
 *
 * Nieuwste week bovenaan, want de vraag gaat vrijwel altijd over wat
 * eraan komt en niet over wat is geweest.
 */
export function groepeerPerWeek<T extends Ingepland>(
  bonnen: T[],
): { maandag: Date; nummer: number; bonnen: T[] }[] {
  const blokken = new Map<string, { maandag: Date; nummer: number; bonnen: T[] }>()

  for (const b of bonnen) {
    const ma = maandagVan(new Date(startVan(b)))
    const sleutel = isoDatum(ma)
    let blok = blokken.get(sleutel)
    if (!blok) {
      blok = { maandag: ma, nummer: weeknummer(ma), bonnen: [] }
      blokken.set(sleutel, blok)
    }
    blok.bonnen.push(b)
  }

  return [...blokken.values()]
    .sort((a, b) => b.maandag.getTime() - a.maandag.getTime())
    .map((blok) => ({
      ...blok,
      bonnen: blok.bonnen.sort((a, b) => startVan(a).localeCompare(startVan(b))),
    }))
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

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

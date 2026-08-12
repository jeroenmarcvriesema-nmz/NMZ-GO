import type { Werkbon } from '@/types'
import { klusstand, vergelijkStand, STANDVOLGORDE, type Klusstand } from '@/lib/klusstand'

/**
 * Van losse werkbonnen naar iets dat je een project kunt noemen.
 *
 * De projectenpagina las de tabel `projecten`. Daar staat sinds de
 * ClickUp-koppeling geen enkele rij in: één ClickUp-taak wordt één
 * werkbon, en niets maakt er ooit een project van. De pagina was dus
 * altijd leeg, en zoeken vond daarom nooit iets — niet omdat het
 * zoekveld stuk was, maar omdat er niets te doorzoeken viel.
 *
 * Wat er wél is, is het opdrachtnummer. Bij een groot project vult
 * kantoor daar met de hand iets als "C515" in, en dan horen alle bonnen
 * met dat nummer bij elkaar. Bij een losse klus blijft het leeg en is
 * het adres het enige dat de klus benoemt.
 *
 * Dat is precies de indeling die hier wordt gemaakt: gelijke
 * opdrachtnummers vormen één groep, en alles zonder nummer is een groep
 * van één. Geen tabel nodig, geen invoerscherm, en de pagina vult
 * zichzelf met wat er werkelijk staat.
 */
export interface Klusgroep {
  /** Het opdrachtnummer bij een project, het bon-id bij een losse klus. */
  sleutel: string
  soort: 'project' | 'klus'
  /** "C515" bij een project, het adres bij een losse klus. */
  naam: string
  opdrachtgever: string
  /** Waar het werk zit. Bij een project kunnen dat meerdere adressen zijn. */
  plaatsen: string[]
  status: Klusstand
  /** Eerste en laatste dag over alle bonnen heen. Leeg als er geen datum bekend is. */
  van: string
  tot: string
  bonnen: Werkbon[]
  punten: number
  puntenKlaar: number
  medewerkers: string[]
}

/**
 * De plaats, desnoods uit het adres gevist.
 *
 * De kolom `plaats` is in de database bij alle dertig bonnen leeg — de
 * ClickUp-parser vult hem niet. De plaats staat er wél, alleen in
 * `adres`: "Stuyvesantstraat 72 te Den Haag", of met een komma erin,
 * "Boerlagestraat 12, Zandvoort". Zonder deze afleiding blijft het
 * plaatsregeltje op elke kaart leeg terwijl de informatie er gewoon is.
 *
 * Dit vervangt de kolom niet en repareert de brongegevens niet. Zodra
 * de parser `plaats` wél vult wint die, want die kolom is het antwoord
 * en dit is een gok op basis van twee schrijfwijzen.
 */
export function plaatsUitAdres(adres: string | null | undefined): string | null {
  if (!adres) return null

  // " te " met spaties eromheen, zodat "79 t/m 129" niet meetelt. De
  // láátste, want "Van Beuningenstraat te ..." zou anders halverwege
  // afbreken.
  const te = adres.lastIndexOf(' te ')
  if (te !== -1) {
    const staart = adres.slice(te + 4).trim()
    if (staart) return staart
  }

  const komma = adres.lastIndexOf(',')
  if (komma !== -1) {
    const staart = adres.slice(komma + 1).trim()
    if (staart) return staart
  }

  return null
}

/** De dag waarop een bon begint, en de dag waarop hij eindigt. */
function begin(bon: Werkbon): string {
  return bon.geplande_start ?? bon.datum ?? ''
}
function eind(bon: Werkbon): string {
  return bon.geplande_eind ?? bon.geplande_start ?? bon.datum ?? ''
}

/**
 * Hoe staat deze groep ervoor?
 *
 * Dezelfde standen als één losse klus, zodat "Bezig" op de
 * projectenpagina hetzelfde woord en dezelfde kleur is als op de
 * werkbonnen en de planning. Hier stond een eigen lijstje
 * (`ProjectStatus`) met "actief" waar de rest van de app "bezig" zegt.
 *
 * De volgorde is geen smaak maar prioriteit: wat een telefoontje vraagt
 * staat bovenaan. Ligt er één bon stil, dan is dat het antwoord voor de
 * hele groep — ook als de andere negen keurig lopen. Daarna wat loopt,
 * dan wat op afronden wacht, en pas als álles af is heet de groep af.
 */
export function groepsstatus(bonnen: Werkbon[]): Klusstand {
  if (bonnen.length === 0) return 'niet_gestart'

  const standen = bonnen.map(klusstand)

  if (standen.includes('stilgelegd')) return 'stilgelegd'
  if (standen.includes('bezig')) return 'bezig'
  if (standen.includes('af_te_ronden')) return 'af_te_ronden'

  const klaar = (s: Klusstand) => s === 'afgerond' || s === 'opgeleverd'
  if (standen.every((s) => s === 'opgeleverd')) return 'opgeleverd'
  if (standen.every(klaar)) return 'afgerond'

  // Deels klaar, deels nog niet begonnen: er is aan gewerkt, dus de
  // groep loopt. Een project half af "niet gestart" noemen klopt niet.
  if (standen.some(klaar)) return 'bezig'

  return 'niet_gestart'
}

/** Ontdubbelt en gooit lege waarden weg, met behoud van volgorde. */
function uniek(waarden: (string | null | undefined)[]): string[] {
  const gezien = new Set<string>()
  const uit: string[] = []
  for (const w of waarden) {
    if (!w) continue
    if (gezien.has(w)) continue
    gezien.add(w)
    uit.push(w)
  }
  return uit
}

function maakGroep(sleutel: string, soort: Klusgroep['soort'], bonnen: Werkbon[]): Klusgroep {
  const taken = bonnen.flatMap((b) => b.taken ?? [])
  const datums = bonnen.map(begin).filter(Boolean).sort()
  const einddatums = bonnen.map(eind).filter(Boolean).sort()

  return {
    sleutel,
    soort,
    // Bij een project is het opdrachtnummer de naam waaronder erover
    // gepraat wordt. Bij een losse klus is dat het adres — een lege
    // `projectnaam` als kop zetten is precies wat de oude kaarten deden.
    naam: soort === 'project' ? sleutel : (bonnen[0]?.adres || 'Zonder adres'),
    opdrachtgever: uniek(bonnen.map((b) => b.opdrachtgever))[0] ?? '',
    plaatsen: uniek(bonnen.map((b) => b.plaats ?? plaatsUitAdres(b.adres))),
    status: groepsstatus(bonnen),
    van: datums[0] ?? '',
    tot: einddatums[einddatums.length - 1] ?? '',
    bonnen,
    punten: taken.length,
    puntenKlaar: taken.filter((t) => t.voltooid).length,
    medewerkers: uniek(bonnen.flatMap((b) => (b.medewerkers ?? []).map((m) => m.naam))),
  }
}

/**
 * Groepeert werkbonnen tot projecten en losse klussen.
 *
 * Gesorteerd op voortgang en niet op datum: wat stilligt staat bovenaan,
 * dan wat op afronden wacht, dan wat loopt, dan wat nog moet beginnen,
 * en onderaan wat af is. Binnen dezelfde stand op begindatum, oudste
 * eerst — wat het langst wacht heeft de meeste haast.
 *
 * Het was gesorteerd op begindatum, nieuwste eerst. Daardoor stond een
 * klus die volgende maand begint bóven een klus die vandaag stilligt.
 */
export function groepeerKlussen(werkbonnen: Werkbon[]): Klusgroep[] {
  const perNummer = new Map<string, Werkbon[]>()
  const los: Werkbon[] = []

  for (const bon of werkbonnen) {
    const nummer = (bon.opdrachtnummer ?? '').trim()
    if (nummer === '') {
      los.push(bon)
      continue
    }
    const rij = perNummer.get(nummer)
    if (rij) rij.push(bon)
    else perNummer.set(nummer, [bon])
  }

  const groepen: Klusgroep[] = []

  for (const [nummer, bonnen] of perNummer) {
    // Eén bon met een opdrachtnummer is nog geen project. Hem toch zo
    // tonen levert een kaart op die je moet openklappen om één adres te
    // zien — dat is een klik zonder opbrengst.
    groepen.push(maakGroep(nummer, bonnen.length > 1 ? 'project' : 'klus', bonnen))
  }

  for (const bon of los) {
    groepen.push(maakGroep(bon.id, 'klus', [bon]))
  }

  return groepen.sort((a, b) => {
    const verschil = STANDVOLGORDE[a.status] - STANDVOLGORDE[b.status]
    if (verschil !== 0) return verschil
    return (a.van || '9999').localeCompare(b.van || '9999')
  })
}

import type { Rol } from '@/types'

// ============================================================
// NMZ GO — wie mag waarbij
// ============================================================
// Deze lijsten zijn de tegenhanger van mag_gebruikers_beheren() en
// mag_werk_beheren() in de database (migratie 008). Ze bepalen wat je
// te zíen krijgt; de database bepaalt wat je mág. Raken ze uit de pas,
// dan is het gevolg een knop die een foutmelding geeft — vervelend,
// maar niet onveilig. Andersom kan niet.
//
// Waarom dit één bestand is: het stond op twee plekken, in App.tsx voor
// de routes en in useAuth.ts voor de menu's. Die twee liepen uit de pas
// en het gevolg was een knop "Team" in de mobiele balk die een
// uitvoerder terugsmeet naar het dashboard. Eén bron, en een test die
// het menu tegen de routes houdt.
// ============================================================

/** Wachtwoorden resetten, uitnodigen, rollen toekennen. */
export const GEBRUIKERSBEHEER: Rol[] = ['eigenaar', 'beheerder']

/** Werkbonnen maken en wijzigen, alles inzien, zoeken, plannen. */
export const WERKBEHEER: Rol[] = ['eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner']

export const ALLE_ROLLEN: Rol[] = [
  'eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner', 'medewerker',
]

export function magWerkBeheren(rol: Rol | undefined | null): boolean {
  return !!rol && WERKBEHEER.includes(rol)
}

export function magGebruikersBeheren(rol: Rol | undefined | null): boolean {
  return !!rol && GEBRUIKERSBEHEER.includes(rol)
}

/** Welk slot zit er op een pad. */
export type Slot = 'kantoor' | 'gebruikersbeheer' | 'ingelogd'

/**
 * Het slot per route, precies zoals App.tsx het zet.
 *
 * Dit is geen documentatie maar de bron: de test houdt het menu hier
 * tegenaan, zodat er geen knop meer kan bestaan die je wegstuurt.
 */
export const ROUTE_SLOT: Record<string, Slot> = {
  '/dashboard':        'kantoor',
  '/projecten':        'kantoor',
  '/planning':         'kantoor',
  '/werkbonnen':       'kantoor',
  '/werkbonnen/nieuw': 'kantoor',
  '/rapporten':        'kantoor',
  '/archief':          'kantoor',
  '/uitloop':          'kantoor',
  '/medewerkers':      'gebruikersbeheer',
  '/medewerkers/:id':  'gebruikersbeheer',

  '/mijn-werkbonnen': 'ingelogd',
  '/mijn-week':       'ingelogd',
  '/mijn-bonnen':     'ingelogd',
  '/afgerond':        'ingelogd',
}

/** Mag deze rol dit pad openen zonder teruggestuurd te worden? */
export function magBijPad(rol: Rol | undefined | null, pad: string): boolean {
  const slot = ROUTE_SLOT[pad]
  if (!slot) return false
  if (slot === 'gebruikersbeheer') return magGebruikersBeheren(rol)
  if (slot === 'kantoor') return magWerkBeheren(rol)
  return !!rol
}

/** Waar iemand terechtkomt als hij de app opent. */
export function startPad(rol: Rol | undefined | null): string {
  return magWerkBeheren(rol) ? '/dashboard' : '/mijn-werkbonnen'
}

import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDatum(datum: string | null | undefined): string {
  if (!datum) return '—'
  try {
    return new Date(datum).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return datum
  }
}

export function formatDatumKort(datum: string | Date | null | undefined): string {
  if (!datum) return '—'
  try {
    return new Date(datum).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return String(datum)
  }
}

export function genereerBonnummer(): string {
  const jaar = new Date().getFullYear()
  const random = Math.floor(Math.random() * 9000) + 1000
  return `NMZ-${jaar}-${random}`
}

export function berekenVoortgang(taken: { voltooid: boolean }[]): number {
  if (!taken.length) return 0
  return Math.round((taken.filter((t) => t.voltooid).length / taken.length) * 100)
}

export function initialen(naam: string): string {
  return (naam || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// De rol zoals hij in de database staat, en zoals hij op het scherm
// hoort te heten. `medewerker` is bewust generiek gehouden in het
// datamodel; het bedrijf noemt die mensen zwamsaneerders.
export const ROL_LABEL: Record<string, string> = {
  eigenaar: 'Eigenaar',
  beheerder: 'Beheerder',
  uitvoerder: 'Uitvoerder',
  werkvoorbereider: 'Werkvoorbereider',
  medewerker: 'Zwamsaneerder',
}

export function rolLabel(rol: string | undefined | null): string {
  if (!rol) return '—'
  return ROL_LABEL[rol] ?? rol
}

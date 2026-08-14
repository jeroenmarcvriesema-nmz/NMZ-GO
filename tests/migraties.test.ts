import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Deze test bestaat door één storing, en hij bestaat om precies die
// storing te laten terugkomen als build-fout in plaats van als
// telefoontje.
//
// `werkbon_gebeurtenissen` kreeg in migratie 015 een check met drie
// soorten. Migratie 030, 032 en 033 zetten er functies bij die elk een
// nieuwe soort in datzelfde logboek schrijven, zonder de check mee te
// laten groeien. Gevolg: vier knoppen die maandenlang niets deden.
//
// En niet "een logregel ontbrak". De insert in het logboek is de
// laatste stap ín die functies, en een functie is één transactie — de
// afgekeurde regel rolt de hele handeling terug. Kantoor kreeg dus een
// foutmelding over een check-constraint terwijl wat er écht misging was
// dat de ploeg niet gewijzigd werd. De fout wees niet naar de schade.
//
// Wat deze test doet: hij leest de migraties zoals Postgres ze zou
// toepassen, houdt per kolom bij welke waarden de laatste check nog
// toestaat, en legt daar elke letterlijke waarde naast die ergens in
// een insert in die kolom wordt geschreven. Staat er iets tussen dat
// niet mag, dan valt de CI om vóórdat iemand op de knop drukt.
//
// Wat hij bewust niet doet: praten met Supabase. Er staan geen sleutels
// in de CI en dat blijft zo (zie `.github/workflows/controle.yml`). Dit
// is puur tekst tegen tekst, en dat is genoeg — schrijven naar deze
// tabellen gaat uitsluitend via de functies in deze migraties, want de
// RLS-policy op `werkbon_gebeurtenissen` staat alleen `select` toe.

const MIGRATIEMAP = path.resolve(__dirname, '../supabase/migrations')

/**
 * Commentaar eruit, tekst met rust laten.
 *
 * Naïef op `--` knippen kan niet: migratie 034 heeft de foutmelding
 * `violates check constraint ...` in zijn kop staan, en een `--` binnen
 * een string zou een halve regel opeten. Vandaar een loopje dat weet
 * wanneer het in een tekstliteral zit, inclusief de `''`-ontsnapping
 * die in `dixi''s` staat.
 */
function zonderCommentaar(sql: string): string {
  let uit = ''
  let inTekst = false
  let i = 0

  while (i < sql.length) {
    const teken = sql[i]

    if (inTekst) {
      uit += teken
      if (teken === "'") {
        if (sql[i + 1] === "'") {
          uit += "'"
          i += 2
          continue
        }
        inTekst = false
      }
      i++
      continue
    }

    if (teken === "'") {
      inTekst = true
      uit += teken
      i++
      continue
    }

    if (teken === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      continue
    }

    if (teken === '/' && sql[i + 1] === '*') {
      i += 2
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i += 2
      continue
    }

    uit += teken
    i++
  }

  return uit
}

/**
 * De argumenten van een `values (...)` uit elkaar halen, op het niveau
 * van de haakjes zelf.
 *
 * Niet op komma's splitsen: in deze migraties staan `case when ... end`
 * en `jsonb_build_object(...)` tussen de waarden, en die hebben hun
 * eigen komma's en haakjes. `start` wijst naar het teken ná het
 * openingshaakje.
 */
function splitsArgumenten(sql: string, start: number): string[] | null {
  const uit: string[] = []
  let huidig = ''
  let diepte = 1
  let inTekst = false
  let i = start

  while (i < sql.length) {
    const teken = sql[i]

    if (inTekst) {
      huidig += teken
      if (teken === "'") {
        if (sql[i + 1] === "'") {
          huidig += "'"
          i += 2
          continue
        }
        inTekst = false
      }
      i++
      continue
    }

    if (teken === "'") {
      inTekst = true
      huidig += teken
      i++
      continue
    }

    if (teken === '(') diepte++

    if (teken === ')') {
      diepte--
      if (diepte === 0) {
        uit.push(huidig.trim())
        return uit
      }
    }

    if (teken === ',' && diepte === 1) {
      uit.push(huidig.trim())
      huidig = ''
      i++
      continue
    }

    huidig += teken
    i++
  }

  // Onafgesloten haakje. Dat is geen geldige SQL en dus geen insert
  // waar deze test iets zinnigs over kan zeggen.
  return null
}

/** `'niet meer '` → `niet meer `, en `null` als het geen literal is. */
function alsLiteral(uitdrukking: string): string | null {
  const m = /^'((?:[^']|'')*)'$/.exec(uitdrukking)
  return m ? m[1].replace(/''/g, "'") : null
}

function migratiesOpVolgorde(): { naam: string; sql: string }[] {
  return fs
    .readdirSync(MIGRATIEMAP)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((naam) => ({
      naam,
      sql: zonderCommentaar(fs.readFileSync(path.join(MIGRATIEMAP, naam), 'utf8')),
    }))
}

/**
 * Per `tabel.kolom` de waarden die de laatste check toestaat.
 *
 * De laatste wint, net als in de database: een migratie die de
 * constraint dropt en opnieuw zet, vervangt wat ervoor stond. De
 * tabelnaam komt van de dichtstbijzijnde `create table` of `alter
 * table` erboven — beide vormen staan in deze migraties, inline in de
 * kolomdefinitie (015) en los als constraint (034).
 */
function toegestaneWaarden(): Map<string, { waarden: Set<string>; bron: string }> {
  const kaart = new Map<string, { waarden: Set<string>; bron: string }>()

  const patroon =
    /(?:create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+))|(?:alter\s+table\s+(?:only\s+)?(?:public\.)?(\w+))|(?:check\s*\(\s*(\w+)\s+in\s*\(([^)]*)\))/gi

  for (const { naam, sql } of migratiesOpVolgorde()) {
    let tabel: string | null = null
    let m: RegExpExecArray | null
    patroon.lastIndex = 0

    while ((m = patroon.exec(sql)) !== null) {
      if (m[1] || m[2]) {
        tabel = (m[1] ?? m[2]).toLowerCase()
        continue
      }

      if (!tabel) continue

      const kolom = m[3].toLowerCase()
      const waarden = new Set<string>()
      for (const l of m[4].matchAll(/'((?:[^']|'')*)'/g)) {
        waarden.add(l[1].replace(/''/g, "'"))
      }

      if (waarden.size > 0) kaart.set(`${tabel}.${kolom}`, { waarden, bron: naam })
    }
  }

  return kaart
}

/** Elke letterlijke waarde die ergens in een insert wordt geschreven. */
function geschrevenWaarden(): {
  migratie: string
  tabel: string
  kolom: string
  waarde: string
}[] {
  const uit: { migratie: string; tabel: string; kolom: string; waarde: string }[] = []
  const patroon = /insert\s+into\s+(?:public\.)?(\w+)\s*\(([^)]*)\)\s*values\s*\(/gi

  for (const { naam, sql } of migratiesOpVolgorde()) {
    let m: RegExpExecArray | null
    patroon.lastIndex = 0

    while ((m = patroon.exec(sql)) !== null) {
      const tabel = m[1].toLowerCase()
      const kolommen = m[2].split(',').map((k) => k.trim().toLowerCase())
      const argumenten = splitsArgumenten(sql, m.index + m[0].length)

      if (!argumenten || argumenten.length !== kolommen.length) continue

      kolommen.forEach((kolom, i) => {
        const waarde = alsLiteral(argumenten[i])
        if (waarde !== null) uit.push({ migratie: naam, tabel, kolom, waarde })
      })
    }
  }

  return uit
}

describe('migraties', () => {
  // Een kapotte lezer die niets vindt zou vrolijk groen blijven en
  // daarmee erger zijn dan geen test. Deze twee houden hem eerlijk.
  it('leest de checks en de inserts überhaupt', () => {
    const checks = toegestaneWaarden()
    const inserts = geschrevenWaarden()

    expect(checks.size).toBeGreaterThan(5)
    expect(inserts.length).toBeGreaterThan(10)
    expect(checks.has('werkbon_gebeurtenissen.soort')).toBe(true)
  })

  it('kent de soorten van het logboek zoals migratie 034 ze zet', () => {
    const check = toegestaneWaarden().get('werkbon_gebeurtenissen.soort')
    expect([...check!.waarden].sort()).toEqual([
      'hervat',
      'opgeleverd',
      'planning_gewijzigd',
      'ploeg_gewijzigd',
      'punt_toegevoegd',
      'punt_verwijderd',
      'stilgelegd',
      'voorziening',
    ])
  })

  // Dit is de test die er echt toe doet.
  it('schrijft nergens een waarde die de check verbiedt', () => {
    const checks = toegestaneWaarden()
    const fouten: string[] = []

    for (const { migratie, tabel, kolom, waarde } of geschrevenWaarden()) {
      const check = checks.get(`${tabel}.${kolom}`)
      if (!check || check.waarden.has(waarde)) continue

      fouten.push(
        `${migratie} schrijft '${waarde}' in ${tabel}.${kolom}, ` +
          `maar de check uit ${check.bron} staat alleen toe: ` +
          `${[...check.waarden].sort().join(', ')}. ` +
          `Zet '${waarde}' erbij in dezelfde migratie — anders rolt de insert ` +
          `de hele handeling terug in plaats van alleen de logregel.`,
      )
    }

    expect(fouten).toEqual([])
  })
})

#!/usr/bin/env node
// ============================================================
// NMZ GO — migratienummers controleren
// ============================================================
// Twee sessies die tegelijk een migratie schrijven, pakken allebei
// het eerstvolgende nummer. Dat is hier al twee keer gebeurd: bij 027,
// en later bij 030 en 031 die daardoor allebei dubbel bestaan.
//
// De database heeft er niet onder geleden — de inhoud verschilde en
// alle vier zijn toegepast — maar de map is er misleidend van geworden,
// en de volgorde waarin migraties horen te draaien is niet meer af te
// lezen aan de naam. Dat is precies het soort fout dat je pas merkt
// als je de database ergens opnieuw moet opbouwen.
//
// Deze controle draait in de pre-commit hook en in `npm run controle`.
// ============================================================

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const MAP = 'supabase/migrations'

// Dubbele nummers van vóór deze controle, bewust doorgelaten omdat ze
// al zijn toegepast en hernoemen dan de historie zou vervalsen.
//
//   030, 031 — twee sessies, augustus 2026
//   039      — idem, en dit is de derde keer dat het gebeurt. Nog
//              niet nagelopen of beide 039's al op de database staan;
//              zo niet, hernoem `039_klus_niet_gestart_om_half_negen`
//              naar het eerstvolgende vrije nummer en haal 039 hier weg.
//
// Zet hier nooit een nieuw nummer bij om een melding weg te krijgen.
// Dat is precies de fout die deze controle moet voorkomen — pak een
// vrij nummer, `npm run migraties` vertelt welk.
const TOEGESTAAN = new Set(['030', '031', '039'])

function nummers() {
  const perNummer = new Map()

  for (const bestand of readdirSync(MAP)) {
    if (!bestand.endsWith('.sql')) continue

    const match = bestand.match(/^(\d{3})_/)
    if (!match) {
      console.error(`✖ ${join(MAP, bestand)}`)
      console.error('  Naam begint niet met drie cijfers plus een liggend streepje.')
      console.error('  Verwacht bijvoorbeeld: 038_waar_het_over_gaat.sql\n')
      process.exit(1)
    }

    const nummer = match[1]
    if (!perNummer.has(nummer)) perNummer.set(nummer, [])
    perNummer.get(nummer).push(bestand)
  }

  return perNummer
}

const perNummer = nummers()

const dubbel = [...perNummer.entries()]
  .filter(([nummer, bestanden]) => bestanden.length > 1 && !TOEGESTAAN.has(nummer))
  .sort(([a], [b]) => a.localeCompare(b))

const hoogste = [...perNummer.keys()].sort().at(-1) ?? '000'
const volgende = String(Number(hoogste) + 1).padStart(3, '0')

if (dubbel.length > 0) {
  console.error('\n✖ Migratienummer dubbel gebruikt\n')

  for (const [nummer, bestanden] of dubbel) {
    console.error(`  ${nummer}:`)
    for (const bestand of bestanden) console.error(`    ${bestand}`)
  }

  console.error(`\n  Hernoem er één naar ${volgende} — het eerstvolgende vrije nummer.`)
  console.error('  Draait de migratie al op de database? Overleg dan eerst;')
  console.error('  hernoemen van iets dat al is uitgevoerd, hoort niet zomaar.\n')
  process.exit(1)
}

console.log(`✓ Migratienummers in orde (${perNummer.size} stuks, eerstvolgende vrij: ${volgende})`)

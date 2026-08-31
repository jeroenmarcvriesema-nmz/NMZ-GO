// Voert een handeling écht uit en kijkt of er iets verandert dat níét
// had mogen veranderen.
//   node flowtest.mjs [poort]
//
// Dit script bestaat omdat twee bevindingen uit de eerste audit zijn
// teruggedraaid: allebei zagen ze er op een schermafdruk goed uit en
// gingen ze pas mis in de overgang. Een schermafdruk toont een toestand;
// een fout zit vaak in de beweging ertussen.
import { chromium } from 'playwright-core'
import fs from 'fs'

const POORT = process.argv[2] ?? 5199

// Een echte, minimale JPEG om te uploaden.
fs.writeFileSync('/tmp/proef.jpg', Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64'))

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
await p.goto(`http://127.0.0.1:${POORT}/mijn-werkbonnen`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1600)

/** De toestand van elk punt: gegevens én vorm. */
const lees = () => p.evaluate(() =>
  [...document.querySelectorAll('div')]
    .filter((d) => (d.className || '').toString().includes('border rounded-lg p-5 mb-3'))
    .map((k) => {
      const knop = [...k.querySelectorAll('button')].find((b) => /Afvinken|Afgevinkt/.test(b.innerText))
      const s = knop && getComputedStyle(knop)
      return {
        titel: (k.querySelector('.text-sm.font-semibold')?.textContent || '').trim().slice(0, 30),
        afgevinkt: (k.className || '').toString().includes('border-green-200'),
        knoptekst: knop?.innerText.trim() ?? null,
        knopUit: knop?.disabled ?? null,
        knopKleur: s?.backgroundColor ?? null,
        knopDekking: s?.opacity ?? null,
        top: Math.round(k.getBoundingClientRect().top),
      }
    }))

const voor = await lees()
const i = voor.findIndex((x) => !x.afgevinkt && x.knopUit === true)
if (i < 0) { console.log('geen punt gevonden dat nog een foto nodig heeft'); await br.close(); process.exit(0) }

console.log(`punt ${i + 1}: "${voor[i].titel}"`)
console.log('  vóór:', JSON.stringify(voor[i]))

const inputs = await p.$$('input[type=file]')
await inputs[i].setInputFiles('/tmp/proef.jpg')
await p.waitForTimeout(2500)

const na = await lees()
console.log('  ná:  ', JSON.stringify(na[i]))

// Wat had niet mogen veranderen?
const klachten = []
if (na[i].afgevinkt !== voor[i].afgevinkt) klachten.push('het punt is afgevinkt door een upload')
if (na[i].knoptekst !== voor[i].knoptekst) klachten.push(`de knoptekst sprong naar "${na[i].knoptekst}"`)
if (na[i].knopKleur !== voor[i].knopKleur) klachten.push(`de knop sprong van ${voor[i].knopKleur} naar ${na[i].knopKleur} — dat leest als "afgevinkt"`)
if (Math.abs(na[i].top - voor[i].top) > 8) klachten.push(`het punt verschoof ${na[i].top - voor[i].top} px onder je handen`)

console.log(klachten.length
  ? '\nFOUT:\n  - ' + klachten.join('\n  - ')
  : '\nGOED: alleen de dekking veranderde; het punt bleef open en stond stil.')
await br.close()

// Meet wat je anders zou schatten: contrast, aanraakvlakken, paginahoogte.
//   node meten.mjs [poort-na] [poort-voor]
// Met twee poorten vergelijkt hij twee draaiende versies naast elkaar.
import { chromium } from 'playwright-core'

const NA = process.argv[2] ?? 5199
const VOOR = process.argv[3]        // optioneel

// ── Contrast, uit de échte tokens ───────────────────────────
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const L = (a) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2])
export const verhouding = (a, b) => ((Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05))
/** Halftransparant wit (`white/40`) eerst over de ondergrond leggen. */
const over = (kleur, dekking, grond) => kleur.map((c, i) => Math.round(dekking * c + (1 - dekking) * grond[i]))

function contrastrapport() {
  const wit = [255, 255, 255]
  const canvasL = hex('#F4F3EF'), kaartD = hex('#161b22')
  console.log('\n── CONTRAST ──  norm: 4,5:1 tekst · 3:1 betekenisvolle niet-tekst')
  for (const [naam, h] of [['gray-400', '#9CA3AF'], ['gray-500', '#6B7280'], ['gray-600', '#4B5563']]) {
    console.log(`  licht ${naam.padEnd(10)} op wit ${verhouding(hex(h), wit).toFixed(2)} · op canvas ${verhouding(hex(h), canvasL).toFixed(2)}`)
  }
  for (const d of [0.4, 0.55, 0.6]) {
    console.log(`  donker white/${Math.round(d * 100)}`.padEnd(20) + ` op kaart ${verhouding(over(wit, d, kaartD), kaartD).toFixed(2)}`)
  }
}

// ── In de browser ───────────────────────────────────────────
async function meetPagina(browser, poort, pad, label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(`http://127.0.0.1:${poort}${pad}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const m = await page.evaluate(() => ({
    // LET OP: dit is CSS-pixels. Vergelijk dit nooit met de afmeting van
    // een schermafdruk — die staat op deviceScaleFactor en is groter.
    pagina: document.body.scrollHeight,
    schermen: +(document.body.scrollHeight / window.innerHeight).toFixed(1),
    klein: [...document.querySelectorAll('button,a,label,input,select')]
      .map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), tekst: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 32) } })
      .filter((x) => x.h > 0 && x.h < 44),
    zonderNaam: [...document.querySelectorAll('button')]
      .filter((b) => !b.innerText.trim() && !b.getAttribute('aria-label')).length,
  }))
  console.log(`\n── ${label} (${pad}) ──`)
  console.log(`  hoogte ${m.pagina} CSS px · ${m.schermen} schermen`)
  console.log(`  aanraakvlakken onder 44 px: ${m.klein.length}`)
  for (const k of m.klein.slice(0, 8)) console.log(`    ${String(k.h).padStart(3)} px  ${k.tekst || '(geen naam)'}`)
  if (m.zonderNaam) console.log(`  knoppen zonder toegankelijke naam: ${m.zonderNaam}`)
  await ctx.close()
  return m
}

contrastrapport()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const na = await meetPagina(browser, NA, '/mijn-werkbonnen', 'NA')
if (VOOR) {
  const voor = await meetPagina(browser, VOOR, '/mijn-werkbonnen', 'VOOR')
  const pct = Math.round((1 - na.pagina / voor.pagina) * 100)
  console.log(`\n── VERSCHIL ──\n  pagina ${voor.pagina} → ${na.pagina} CSS px (${pct}% korter)`)
  console.log('  Noem altijd de conditie erbij: hoeveel punten, hoeveel daarvan af, welke rol.')
}
await browser.close()

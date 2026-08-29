// Neemt elk scherm op in elke combinatie, en meldt echte fouten.
//   node opnames.mjs <uitvoermap> [poort]
//
// Chromium staat in deze omgeving op /opt/pw-browsers/chromium.
// Installeer playwright-core in je scratchpad, niet in het project.
import { chromium } from 'playwright-core'
import fs from 'fs'

const OUT = process.argv[2]
const POORT = process.argv[3] ?? 5199
fs.mkdirSync(OUT, { recursive: true })

// Routes van kantoor; voor de medewerkerschermen draai je opnieuw met
// `rol: 'medewerker'` in de fixtures — anders sturen deze routes door.
const ROUTES = [
  ['login', '/login'], ['dashboard', '/dashboard'], ['werkbonnen', '/werkbonnen'],
  ['planning', '/planning'], ['lopend', '/lopend'], ['uitloop', '/uitloop'],
  ['voorzieningen', '/voorzieningen'], ['archief', '/archief'], ['projecten', '/projecten'],
  ['rapporten', '/rapporten'], ['medewerkers', '/medewerkers'],
  ['werkbon-detail', '/werkbonnen/wb1'], ['werkbon-nieuw', '/werkbonnen/nieuw'],
  ['vandaag', '/mijn-werkbonnen'], ['mijn-week', '/mijn-week'], ['mijn-bonnen', '/mijn-bonnen'],
]

const APPARATEN = [
  ['telefoon', { width: 390, height: 844 }, true],
  ['tablet',   { width: 820, height: 1180 }, false],
  ['laptop',   { width: 1440, height: 950 }, false],
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const meldingen = []

for (const [apparaat, viewport, mobiel] of APPARATEN) {
  for (const thema of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5, isMobile: mobiel, hasTouch: mobiel })
    await ctx.addInitScript((t) => {
      localStorage.setItem('nmzgo-theme', JSON.stringify({ state: { theme: t }, version: 0 }))
    }, thema)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => meldingen.push(`[${apparaat}/${thema}] PAGEERROR ${e.message}`))
    page.on('console', (m) => {
      const t = m.text()
      // Geblokkeerde externe afbeeldingen zijn ruis van de nep-backend.
      if (m.type() === 'error' && !/Failed to load resource/.test(t)) {
        meldingen.push(`[${apparaat}/${thema}] CONSOLE ${t.slice(0, 160)}`)
      }
    })

    for (const [naam, pad] of ROUTES) {
      try {
        await page.goto(`http://127.0.0.1:${POORT}${pad}`, { waitUntil: 'networkidle', timeout: 15000 })
        await page.waitForTimeout(700)
        await page.screenshot({ path: `${OUT}/${apparaat}-${thema}-${naam}.jpg`, type: 'jpeg', quality: 74, fullPage: true })

        const o = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
          pad: location.pathname,
        }))
        if (o.sw > o.cw) meldingen.push(`[${apparaat}/${thema}] H-SCROLL op ${pad}: ${o.sw} > ${o.cw}`)
        // Doorgestuurd? Dan kijk je naar een ander scherm dan je denkt.
        if (o.pad !== pad) meldingen.push(`[${apparaat}/${thema}] ${pad} stuurde door naar ${o.pad} — klopt de rol in de fixtures?`)
      } catch (e) {
        meldingen.push(`[${apparaat}/${thema}] ${pad}: ${e.message.split('\n')[0]}`)
      }
    }
    await ctx.close()
  }
}

await browser.close()
fs.writeFileSync(`${OUT}/meldingen.txt`, meldingen.join('\n'))
console.log(`klaar — ${meldingen.length} melding(en)`)
if (meldingen.length) console.log(meldingen.slice(0, 20).join('\n'))

// ============================================================
// NMZ GO — het opleverrapport, als document
// ============================================================
// Dit is het enige stuk dat NMZ GO naar buiten stuurt. Alles wat
// hier staat komt bij de opdrachtgever op tafel, en een fout blijft
// dus niet binnen.
//
// De indeling komt uit het bestaande document (Opleverrapport
// Scheibeekstraat 9 te Assendelft, vijf pagina's), met de twee
// beslissingen van de eigenaar erin verwerkt: de kwaliteitschecklist
// van zes vaste punten hoeft niet, en drie tekstvelden volstaan.
//
//   1. Titelblad          — wat het is, waar, wanneer, door wie
//   2. Projectgegevens    — de harde feiten plus de drie tekstvelden
//   3. Uitgevoerde werk   — de punten uit de werkopdracht
//   4. Fotorapportage     — het bewijs, per punt
//
// ── Waarom HTML en niet rechtstreeks PDF ──
// Een PDF-bibliotheek in Deno moet de opmaak zelf tekenen: elke
// regelafbreking, elke pagina-overgang en elke fotopositie met de hand.
// Bij drieëntwintig foto's van wisselend formaat is dat precies het
// soort code waarin een rapport stilletjes een halve zin afkapt.
//
// Een browser doet die opmaak al, en doet hem goed. Dit document
// draagt zijn eigen A4-drukregels mee: openen en afdrukken naar PDF
// geeft hetzelfde resultaat, en de weg naar een renderer die dat
// serverkant doet blijft open omdat er niets aan dit bestand hoeft te
// veranderen.
//
// ── Waarom niets een vaste hoogte heeft ──
// De eerste opzet gaf elk blad exact 297 mm met `overflow: hidden`.
// Dat ziet er op het scherm netjes uit en is levensgevaarlijk: een
// bewonersopmerking van tien regels wordt dan een bewonersopmerking
// van zes, zonder dat iemand ziet dat er iets weg is. De bladen
// groeien nu mee en de browser bepaalt waar de pagina breekt. Op het
// scherm is een blad daardoor soms iets langer dan een echt vel —
// dat is de goede kant om het mis te hebben.
// ============================================================

/** Eén foto, klaar om in het document te zetten. */
export interface Rapportfoto {
  /** Volledige `data:`-URI. Het document staat op zichzelf. */
  bron: string
  /** 'voor' of 'na', zoals op de foto vastgelegd. */
  fase?: string | null
}

/** Eén punt uit de werkopdracht, met wat eraan hangt. */
export interface Rapportpunt {
  titel: string
  voltooid: boolean
  fotos: Rapportfoto[]
}

/**
 * De twee vaste alinea's uit het bestaande document.
 *
 * Ontbreken ze, dan valt de hele kop weg — een rapport dat naar de
 * opdrachtgever gaat zet geen "nog aan te leveren" op papier.
 */
export interface VasteTeksten {
  algemeen?: string | null
  werkzaamheden?: string | null
}

/**
 * Alleen de voornaam van de ploeg op het rapport.
 *
 * Dit document gaat naar een opdrachtgever. Die hoeft niet te weten hoe
 * de jongens voluit heten; "Danny en Martijn zijn er geweest" is wat er
 * toe doet. Achternamen van personeel op een extern stuk zetten is
 * gegevens weggeven die niemand nodig heeft.
 *
 * Twee keer dezelfde voornaam is het geval waar een simpele regel
 * stukgaat: bij dertig man zitten er twee Justins, en "Justin, Justin"
 * op een rapport leest als een fout. Alleen dán komt de eerste letter
 * van de achternaam erbij, en alleen bij de namen die botsen.
 */
export function voornamen(namen: string[]): string[] {
  const gesplitst = namen
    .map((naam) => String(naam ?? '').trim().split(/\s+/).filter(Boolean))
    .filter((delen) => delen.length > 0)

  const telling = new Map<string, number>()
  for (const delen of gesplitst) {
    const eerste = delen[0].toLowerCase()
    telling.set(eerste, (telling.get(eerste) ?? 0) + 1)
  }

  return gesplitst.map((delen) => {
    const eerste = delen[0]
    if ((telling.get(eerste.toLowerCase()) ?? 0) < 2 || delen.length < 2) return eerste
    // De eerste letter van het laatste naamdeel: "Justin de Wit" wordt
    // "Justin W." en niet "Justin d.".
    return `${eerste} ${delen[delen.length - 1][0].toUpperCase()}.`
  })
}

export interface Rapportgegevens {
  bonnummer: string | null
  projectnaam: string | null
  adres: string | null
  postcode: string | null
  plaats: string | null
  opdrachtgever: string | null
  opdrachtnummer: string | null
  inspecteur: string | null
  aannemer: string
  /** Al opgemaakt: "14 augustus 2026". */
  opgeleverdOp: string | null
  opgeleverdDoor: string | null
  /** Al opgemaakt: "9 t/m 14 augustus 2026". */
  uitvoering: string | null
  ploeg: string[]
  opmerkingenBewoners: string | null
  extraWerkzaamheden: string | null
  bijzonderheden: string | null
  punten: Rapportpunt[]
  /** Foto's die aan de bon hangen maar aan geen enkel punt. */
  losseFotos: Rapportfoto[]
  vast?: VasteTeksten
}

const MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

/**
 * "2026-08-14" of een tijdstempel → "14 augustus 2026".
 *
 * Voluit en niet 14-08-2026: dit is een brief aan een opdrachtgever en
 * geen invoerveld. In UTC gerekend, want een datum zonder tijd die door
 * een tijdzone wordt gehaald verschuift een halve wereld lang een dag —
 * en een opleverdatum die een dag verkeerd op papier staat is precies
 * het soort fout waar een discussie over komt.
 */
export function datumInWoorden(waarde: string | null | undefined): string | null {
  if (!waarde) return null
  const d = new Date(waarde)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCDate()} ${MAANDEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/**
 * De periode waarin gewerkt is, in één regel.
 *
 * Eén dag blijft één datum. Twee dagen in dezelfde maand korten we in
 * tot "9 t/m 14 augustus 2026" — dat leest als een periode en niet als
 * twee losse feiten die je zelf nog moet optellen.
 */
export function periodeInWoorden(
  van: string | null | undefined,
  tot: string | null | undefined,
): string | null {
  const a = datumInWoorden(van)
  const b = datumInWoorden(tot)
  if (!a && !b) return null
  if (!a || !b || a === b) return a ?? b

  const dA = new Date(String(van))
  const dB = new Date(String(tot))
  if (dA.getUTCMonth() === dB.getUTCMonth() && dA.getUTCFullYear() === dB.getUTCFullYear()) {
    return `${dA.getUTCDate()} t/m ${b}`
  }
  return `${a} t/m ${b}`
}

export function ontsnap(tekst: unknown): string {
  return String(tekst ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  )
}

/**
 * Tekst uit een invoerveld, met regelafbrekingen.
 *
 * Wat iemand op de werkbon in drie alinea's typt hoort in het rapport
 * ook drie alinea's te zijn. Zonder dit wordt het één blok en leest
 * niemand het.
 */
function alineas(tekst: string): string {
  return tekst
    .split(/\n{2,}/)
    .map((blok) => blok.trim())
    .filter(Boolean)
    .map((blok) => `<p class="alinea">${ontsnap(blok).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Een rij in de gegevenstabel. Leeg blijft leeg en niet weggelaten. */
function rij(label: string, waarde: string | null | undefined): string {
  const gevuld = String(waarde ?? '').trim()
  return `<dt>${ontsnap(label)}</dt><dd>${gevuld ? ontsnap(gevuld) : '<span class="leeg">—</span>'}</dd>`
}

/** Een tekstveld met kop. Niet ingevuld = kop en al weg. */
function tekstblok(kop: string, waarde: string | null): string {
  const gevuld = String(waarde ?? '').trim()
  if (!gevuld) return ''
  return `<h3 class="subkop">${ontsnap(kop)}</h3>${alineas(gevuld)}`
}

function fotovak(f: Rapportfoto): string {
  const fase = String(f.fase ?? '').trim()
  return `<figure class="vak">
      <img src="${ontsnap(f.bron)}" alt="">
      ${fase ? `<figcaption>${ontsnap(fase)}</figcaption>` : ''}
    </figure>`
}

/**
 * Het hele document als één bestand.
 *
 * Alles zit erin — opmaak en foto's — zodat het rapport ook nog klopt
 * als het over een jaar uit een archiefmap komt. Een document dat naar
 * buiten gaat mag niet afhangen van een server die er dan nog moet zijn.
 */
export function bouwRapport(g: Rapportgegevens): string {
  const adresRegel = [g.adres, [g.postcode, g.plaats].filter(Boolean).join(' ')]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join(', ')

  const metFotos = g.punten.filter((p) => p.fotos.length > 0)
  const aantalFotos = g.punten.reduce((n, p) => n + p.fotos.length, 0) + g.losseFotos.length

  const titel = `Opleverrapport ${adresRegel || g.bonnummer || ''}`.trim()

  // ── Blad 3 — de punten uit de werkopdracht ──
  const werkzaamheden = g.punten.length === 0 ? '' : `
    <section class="blad">
      <h2 class="sectie">Uitgevoerde werkzaamheden</h2>
      ${g.vast?.werkzaamheden ? alineas(g.vast.werkzaamheden) : ''}
      <ol class="punten">
        ${g.punten.map((p) => `
          <li class="${p.voltooid ? 'af' : 'open'}">
            <span class="teken" aria-hidden="true">${p.voltooid ? '✓' : '·'}</span>
            <span class="omschrijving">${ontsnap(p.titel)}</span>
          </li>`).join('')}
      </ol>
    </section>`

  // ── Blad 4 en verder — de fotorapportage ──
  // De browser breekt zelf af waar het moet; elke puntgroep blijft bij
  // elkaar zolang hij op één pagina past.
  const fotorapportage = aantalFotos === 0 ? '' : `
    <section class="blad">
      <h2 class="sectie">Fotorapportage</h2>
      ${metFotos.map((p, i) => `
        <div class="groep">
          <h3 class="groepkop">
            <span class="nr">${i + 1}</span>
            <span>${ontsnap(p.titel)}</span>
          </h3>
          <div class="raster">${p.fotos.map(fotovak).join('')}</div>
        </div>`).join('')}
      ${g.losseFotos.length === 0 ? '' : `
        <div class="groep">
          <h3 class="groepkop"><span>Overige foto's</span></h3>
          <div class="raster">${g.losseFotos.map(fotovak).join('')}</div>
        </div>`}
    </section>`

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ontsnap(titel)}</title>
<style>
  :root {
    --papier: #FFFFFF;
    --inkt: #1A1814;
    --inkt-zacht: #5C564D;
    --inkt-licht: #8F887D;
    --liniaal: #D9D4C9;
    --liniaal-fijn: #EDEAE2;
    --geel: #F0B420;
    --bureau: #E8E4DB;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bureau);
    color: var(--inkt);
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .blad {
    background: var(--papier);
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 8mm;
    padding: 18mm 18mm 16mm;
    box-shadow: 0 2px 12px rgba(0,0,0,.14);
    display: flex;
    flex-direction: column;
  }
  .blad + .blad { break-before: page; page-break-before: always; }

  /* ── Titelblad ── */
  .merk { display: flex; align-items: center; gap: 3mm; font-size: 13pt; font-weight: 800; }
  .merk .blokje { width: 7mm; height: 7mm; border-radius: 1mm; background: var(--geel); }
  .titelmidden { margin: auto 0; display: flex; flex-direction: column; gap: 7mm; }
  .streep { width: 26mm; height: 1.6mm; background: var(--geel); border-radius: .8mm; }
  h1 {
    margin: 0; font-size: 30pt; line-height: 1.1; font-weight: 700;
    letter-spacing: -.01em; text-wrap: balance;
  }
  .titeladres { font-size: 14pt; font-weight: 600; line-height: 1.3; }
  .titelmeta {
    display: grid; grid-template-columns: max-content 1fr; gap: 1.5mm 8mm;
    margin: 3mm 0 0; font-size: 10pt;
  }
  .titelmeta dt { color: var(--inkt-licht); }
  .titelmeta dd { margin: 0; font-weight: 600; }

  /* ── Secties ── */
  .sectie {
    font-size: 16pt; font-weight: 700; margin: 0 0 5mm;
    padding-bottom: 2mm; border-bottom: .6mm solid var(--inkt);
    letter-spacing: -.01em;
  }
  .subkop {
    font-size: 8.5pt; font-weight: 700; letter-spacing: .09em;
    text-transform: uppercase; color: var(--inkt-licht);
    margin: 7mm 0 2mm;
  }
  .alinea { margin: 0 0 2.5mm; }
  .alinea:last-child { margin-bottom: 0; }

  .gegevens { display: grid; grid-template-columns: max-content 1fr; margin: 0; }
  .gegevens dt, .gegevens dd {
    margin: 0; padding: 1.6mm 0; border-bottom: .2mm solid var(--liniaal-fijn);
  }
  .gegevens dt { color: var(--inkt-zacht); padding-right: 10mm; }
  .gegevens dd { font-weight: 600; }
  .leeg { color: var(--inkt-licht); font-weight: 400; }

  /* ── De punten ── */
  .punten { list-style: none; margin: 0; padding: 0; }
  .punten li {
    display: grid; grid-template-columns: 6mm 1fr; gap: 2mm;
    padding: 2mm 0; border-bottom: .2mm solid var(--liniaal-fijn);
    break-inside: avoid; page-break-inside: avoid;
  }
  .punten .teken { font-weight: 700; text-align: center; }
  .punten .af .teken { color: #2F6B4F; }
  .punten .open .teken { color: var(--inkt-licht); }

  /* ── Fotorapportage ── */
  .groep { margin-bottom: 6mm; break-inside: avoid; page-break-inside: avoid; }
  .groepkop {
    display: grid; grid-template-columns: auto 1fr; gap: 3mm;
    align-items: baseline; font-size: 9.5pt; font-weight: 600;
    margin: 0 0 2.5mm; line-height: 1.35;
  }
  .groepkop .nr {
    font-weight: 700; background: var(--geel); color: var(--inkt);
    padding: .4mm 1.8mm; border-radius: 1mm; font-size: 9pt;
  }
  .raster { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
  .vak { margin: 0; break-inside: avoid; page-break-inside: avoid; }
  .vak img {
    display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover;
    border: .2mm solid var(--liniaal); border-radius: 1mm; background: #F2EFE8;
  }
  .vak figcaption {
    margin-top: .8mm; font-size: 7.5pt; font-weight: 700;
    letter-spacing: .06em; text-transform: uppercase; color: var(--inkt-licht);
  }

  /* ── Voet ── */
  .voet {
    margin-top: auto; padding-top: 4mm;
    border-top: .2mm solid var(--liniaal-fijn);
    display: flex; justify-content: space-between; gap: 6mm;
    font-size: 8pt; color: var(--inkt-licht);
  }

  /* ── Afdrukken ── */
  @page { size: A4; margin: 14mm 16mm; }
  @media print {
    body { background: #fff; }
    .blad {
      width: auto; min-height: 0; margin: 0; padding: 0;
      box-shadow: none;
    }
  }

  @media screen and (max-width: 220mm) {
    .blad { width: 100%; padding: 8mm; }
    h1 { font-size: 22pt; }
    .raster { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>

<section class="blad">
  <div class="merk"><span class="blokje"></span>${ontsnap(g.aannemer)}</div>
  <div class="titelmidden">
    <div class="streep"></div>
    <h1>Opleverrapport<br>algemeen</h1>
    <div class="titeladres">${ontsnap(adresRegel)}</div>
    <dl class="titelmeta">
      ${rij('Opdrachtnummer', g.bonnummer)}
      ${g.opdrachtnummer ? rij('Projectnummer', g.opdrachtnummer) : ''}
      ${rij('Opgeleverd op', g.opgeleverdOp)}
      ${rij('Opgemaakt door', g.opgeleverdDoor)}
    </dl>
  </div>
  <div class="voet">
    <span>${ontsnap(g.aannemer)}</span>
    <span>${ontsnap(g.punten.length)} werkzaamheden · ${ontsnap(aantalFotos)} foto's</span>
  </div>
</section>

<section class="blad">
  <h2 class="sectie">Projectgegevens</h2>
  <dl class="gegevens">
    ${rij('Opdrachtgever', g.opdrachtgever)}
    ${rij('Werkadres', g.adres)}
    ${rij('Postcode en plaats', [g.postcode, g.plaats].filter(Boolean).join(' '))}
    ${rij('Opdrachtnummer', g.bonnummer)}
    ${rij('Projectnummer', g.opdrachtnummer)}
    ${rij('Soort werk', g.projectnaam)}
    ${rij('Inspecteur', g.inspecteur)}
    ${rij('Uitvoering', g.uitvoering)}
    ${rij('Uitgevoerd door', g.ploeg.join(', '))}
    ${rij('Opleverdatum', g.opgeleverdOp)}
  </dl>

  ${g.vast?.algemeen ? `<h3 class="subkop">Algemeen</h3>${alineas(g.vast.algemeen)}` : ''}
  ${tekstblok('Opmerkingen bewoners', g.opmerkingenBewoners)}
  ${tekstblok('Extra uitgevoerde werkzaamheden', g.extraWerkzaamheden)}
  ${tekstblok('Bijzonderheden', g.bijzonderheden)}

  <div class="voet">
    <span>${ontsnap(adresRegel)}</span>
    <span>Opdrachtnummer ${ontsnap(g.bonnummer)}</span>
  </div>
</section>
${werkzaamheden}
${fotorapportage}

</body>
</html>`
}

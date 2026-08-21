// NMZ GO — het opleverrapport als document
//
// Losse module zonder afhankelijkheden, om dezelfde reden als
// ontleden.ts en statusregels.ts: dit is opmaak die klopt of niet
// klopt, en dat hoort een test te bewaken in plaats van de eerste
// opdrachtgever die het rapport openslaat.
//
// Waarom HTML en geen PDF-bibliotheek: het rapport is A4 met
// paginaovergangen, en dat kan een browser al. Afdrukken -> Bewaar als
// PDF levert exact dit document. Een PDF-bibliotheek zou hetzelfde
// resultaat met meer code en een extra dependency moeten benaderen, en
// een headless browser draait niet in een Edge Function.
//
// De structuur komt uit het echte document (Scheibeekstraat 9) en uit
// de beslissingen die daarover zijn vastgelegd in .ai/HANDOVER.md:
// titelblad, projectgegevens, fotorapportage. De kwaliteitschecklist
// hoeft niet. Drie tekstvelden volstaan. Het projectnummer staat er
// alleen als het is ingevuld.

export interface RapportFoto {
  /** Data-URI of URL. De handler zet er data-URI's in, zodat het rapport één bestand is. */
  bron: string
  /** Het punt waar de foto bij hoort. Leeg mag: dan staat er alleen de fase. */
  bijschrift: string
  /** 'voor', 'tijdens' of 'na'. */
  fase: string
}

export interface Rapportgegevens {
  adres: string
  postcode: string | null
  plaats: string | null
  opdrachtnummer: string | null
  opdrachtgever: string | null
  opleverdatum: string | null
  opgemaaktDoor: string | null
  ploeg: string[]
  opmerkingenBewoners: string | null
  extraWerkzaamheden: string | null
  bijzonderheden: string | null
  punten: { titel: string; voltooid: boolean }[]
  fotos: RapportFoto[]
  gemaaktOp: string
  /**
   * De twee vaste alinea's uit het papieren sjabloon. Bewust optioneel
   * en bewust niet hier verzonnen: dit is tekst die naar een
   * opdrachtgever gaat, en die hoort woordelijk uit het echte document
   * te komen. Zolang ze leeg zijn blijven de kopjes weg.
   */
  juridischeAlinea?: string | null
  werkzaamhedenAlinea?: string | null
}

const FASEN: { sleutel: string; kop: string }[] = [
  { sleutel: 'voor', kop: 'Voor aanvang' },
  { sleutel: 'tijdens', kop: 'Tijdens de werkzaamheden' },
  { sleutel: 'na', kop: 'Na afronding' },
]

/**
 * Tekst veilig in HTML zetten.
 *
 * Alles wat hier langskomt is door een mens ingetypt: een adres, een
 * opmerking van een bewoner, de titel van een punt. Eén `<` in zo'n
 * veld zou de rest van het rapport onzichtbaar maken.
 */
export function veilig(waarde: unknown): string {
  if (waarde === null || waarde === undefined) return ''
  return String(waarde)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Vrije tekst met regelovergangen, veilig en met de witregels intact. */
function alinea(tekst: string): string {
  return veilig(tekst)
    .split(/\n{2,}/)
    .map((deel) => `<p>${deel.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** 2026-08-21 -> 21 augustus 2026. Leeg blijft leeg. */
export function datumInWoorden(iso: string | null | undefined): string {
  if (!iso) return ''
  const maanden = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ]
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`
}

/** "1017 AB Amsterdam", en netjes leeg als er niets is ingevuld. */
export function postadres(postcode: string | null, plaats: string | null): string {
  return [postcode, plaats].filter((d) => d && d.trim()).join(' ').trim()
}

/** Een regel in de projectgegevens. Lege waarden slaan we over. */
function regel(naam: string, waarde: string): string {
  if (!waarde.trim()) return ''
  return `<dt>${veilig(naam)}</dt><dd>${veilig(waarde)}</dd>`
}

/** Een tekstblok met kop. Leeg blok betekent geen kop. */
function blok(kop: string, tekst: string | null | undefined): string {
  if (!tekst || !tekst.trim()) return ''
  return `<section class="blok"><h2>${veilig(kop)}</h2>${alinea(tekst)}</section>`
}

function titelblad(g: Rapportgegevens): string {
  const plek = postadres(g.postcode, g.plaats)
  return `<div class="blad titelblad">
  <div class="merk"><span class="blokje"></span>NMZ</div>
  <div class="titelmidden">
    <div class="streep"></div>
    <h1>Opleverrapport</h1>
    <div class="titeladres">${veilig(g.adres)}${plek ? `<br>${veilig(plek)}` : ''}</div>
    <dl class="titelmeta">
      ${regel('Opleverdatum', datumInWoorden(g.opleverdatum))}
      ${regel('Projectnummer', g.opdrachtnummer ?? '')}
      ${regel('Opdrachtgever', g.opdrachtgever ?? '')}
      ${regel('Opgemaakt door', g.opgemaaktDoor ?? '')}
      ${regel('Uitgevoerd door', g.ploeg.join(', '))}
    </dl>
  </div>
  <div class="voet">Opgemaakt op ${veilig(datumInWoorden(g.gemaaktOp))}</div>
</div>`
}

function projectgegevens(g: Rapportgegevens): string {
  const plek = postadres(g.postcode, g.plaats)
  const punten = g.punten.length
    ? `<section class="blok"><h2>Uitgevoerde werkzaamheden</h2>
      <ul class="punten">${g.punten
        .map(
          (p) =>
            `<li class="${p.voltooid ? 'af' : 'open'}">${veilig(p.titel)}${
              p.voltooid ? '' : ' <span class="open-merk">niet afgerond</span>'
            }</li>`,
        )
        .join('')}</ul></section>`
    : ''

  return `<div class="blad">
  <div class="kop"><span class="blokje"></span>Opleverrapport · ${veilig(g.adres)}</div>
  <section class="blok">
    <h2>Projectgegevens</h2>
    <dl class="gegevens">
      ${regel('Werkadres', g.adres)}
      ${regel('Postcode en plaats', plek)}
      ${regel('Opdrachtgever', g.opdrachtgever ?? '')}
      ${regel('Projectnummer', g.opdrachtnummer ?? '')}
      ${regel('Opleverdatum', datumInWoorden(g.opleverdatum))}
      ${regel('Uitgevoerd door', g.ploeg.join(', '))}
    </dl>
  </section>
  ${blok('Algemeen', g.juridischeAlinea)}
  ${blok('Toelichting werkzaamheden', g.werkzaamhedenAlinea)}
  ${punten}
  ${blok('Opmerkingen bewoners', g.opmerkingenBewoners)}
  ${blok('Extra uitgevoerde werkzaamheden', g.extraWerkzaamheden)}
  ${blok('Bijzonderheden', g.bijzonderheden)}
</div>`
}

function fotorapportage(g: Rapportgegevens): string {
  if (!g.fotos.length) return ''

  const groepen = FASEN.map((f) => ({
    kop: f.kop,
    fotos: g.fotos.filter((foto) => foto.fase === f.sleutel),
  })).filter((groep) => groep.fotos.length > 0)

  // Een fase die niet in de lijst staat hoort er niet stilzwijgend uit
  // te vallen; dan mist er bewijs zonder dat iemand het ziet.
  const bekend = new Set(FASEN.map((f) => f.sleutel))
  const overig = g.fotos.filter((foto) => !bekend.has(foto.fase))
  if (overig.length) groepen.push({ kop: 'Overige foto’s', fotos: overig })

  const secties = groepen
    .map(
      (groep) => `<section class="fasegroep">
    <h3>${veilig(groep.kop)}</h3>
    <div class="raster">${groep.fotos
      .map(
        (foto) => `<figure>
        <img src="${veilig(foto.bron)}" alt="${veilig(foto.bijschrift || groep.kop)}">
        ${foto.bijschrift ? `<figcaption>${veilig(foto.bijschrift)}</figcaption>` : ''}
      </figure>`,
      )
      .join('')}</div>
  </section>`,
    )
    .join('')

  return `<div class="blad">
  <div class="kop"><span class="blokje"></span>Opleverrapport · ${veilig(g.adres)}</div>
  <section class="blok">
    <h2>Fotorapportage</h2>
    ${secties}
  </section>
</div>`
}

const STIJL = `
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

  .merk { display: flex; align-items: center; gap: 3mm; font-size: 13pt; font-weight: 800; }
  .blokje { width: 7mm; height: 7mm; border-radius: 1mm; background: var(--geel); display: inline-block; }
  .titelmidden { margin: auto 0; display: flex; flex-direction: column; gap: 7mm; }
  .streep { width: 26mm; height: 1.6mm; background: var(--geel); border-radius: .8mm; }
  h1 { margin: 0; font-size: 30pt; line-height: 1.1; font-weight: 700; letter-spacing: -.01em; }
  .titeladres { font-size: 14pt; font-weight: 600; line-height: 1.3; }
  .titelmeta, .gegevens {
    display: grid; grid-template-columns: max-content 1fr; gap: 1.5mm 8mm;
    margin: 3mm 0 0; font-size: 10pt;
  }
  .titelmeta dt, .gegevens dt { color: var(--inkt-licht); }
  .titelmeta dd, .gegevens dd { margin: 0; font-weight: 600; }
  .voet { margin-top: auto; font-size: 9pt; color: var(--inkt-licht); }

  .kop {
    display: flex; align-items: center; gap: 2.5mm;
    padding-bottom: 3mm; margin-bottom: 8mm;
    border-bottom: .4mm solid var(--liniaal);
    font-size: 9.5pt; font-weight: 700; color: var(--inkt-zacht);
  }
  .kop .blokje { width: 4mm; height: 4mm; }

  .blok { margin-bottom: 8mm; }
  .blok h2 {
    margin: 0 0 3mm; font-size: 12pt; font-weight: 700;
    padding-bottom: 1.5mm; border-bottom: .3mm solid var(--liniaal-fijn);
  }
  .blok p { margin: 0 0 2.5mm; }
  .blok p:last-child { margin-bottom: 0; }

  .punten { margin: 0; padding-left: 5mm; }
  .punten li { margin-bottom: 1.5mm; }
  .punten li.open { color: var(--inkt-zacht); }
  .open-merk {
    font-size: 8pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: .04em; color: var(--inkt-licht);
  }

  .fasegroep { margin-bottom: 7mm; break-inside: avoid; }
  .fasegroep h3 { margin: 0 0 3mm; font-size: 10.5pt; font-weight: 700; color: var(--inkt-zacht); }
  .raster { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  figure { margin: 0; break-inside: avoid; }
  figure img {
    width: 100%; height: 62mm; object-fit: cover;
    border: .3mm solid var(--liniaal); border-radius: 1mm; display: block;
  }
  figcaption { margin-top: 1.5mm; font-size: 8.5pt; color: var(--inkt-zacht); }

  /* Op papier hoort het papier weg te vallen: geen schaduw, geen
     bureaukleur, en de marge komt van de printer. */
  @page { size: A4; margin: 0; }
  @media print {
    body { background: var(--papier); }
    .blad { margin: 0; box-shadow: none; }
  }
`

/** Het hele rapport als één zelfstandig HTML-bestand. */
export function bouwRapport(g: Rapportgegevens): string {
  const plek = postadres(g.postcode, g.plaats)
  const titel = `Opleverrapport ${g.adres}${plek ? ` te ${g.plaats ?? ''}`.trimEnd() : ''}`

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${veilig(titel)}</title>
<style>${STIJL}</style>
</head>
<body>
${titelblad(g)}
${projectgegevens(g)}
${fotorapportage(g)}
</body>
</html>
`
}

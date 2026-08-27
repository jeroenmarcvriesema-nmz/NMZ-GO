// NMZ GO — het opleverrapport als PDF
//
// Waarom naast `rapportsjabloon.ts` en niet in plaats daarvan: dat
// sjabloon bepaalt wát er op het rapport staat en in welke volgorde —
// titelblad, projectgegevens, de punten met hun foto's. Die beslissing
// hoort op één plek te blijven. Dit bestand doet er niets aan toe; het
// zet dezelfde `Rapportgegevens` op papier in plaats van in HTML.
//
// Waarom een PDF-bibliotheek en geen browser: een opdrachtgever krijgt
// dit rapport per mail en moet het kunnen openen, printen en bewaren.
// Een HTML-bestand van acht megabyte is geen bijlage die je verstuurt.
// Een headless browser draait niet in een Edge Function, dus HTML naar
// PDF omzetten kan daar niet — deze weg tekent de pagina rechtstreeks.
//
// `pdf-lib` via een `npm:`-specifier. Dat raakt `package.json` niet:
// edge functions halen hun afhankelijkheden per URL op, net als
// `jsr:@supabase/supabase-js@2` hierboven in de andere bestanden.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import type { Rapportfoto, Rapportgegevens } from './rapportsjabloon.ts'

// A4 in punten. Marges zoals het HTML-sjabloon ze heeft: 18 mm opzij,
// 16 mm onder. Eén millimeter is 2.8346 punt.
const MM = 2.8346
const BREEDTE = 210 * MM
const HOOGTE = 297 * MM
const MARGE = 18 * MM
const ONDER = 16 * MM
const KOLOM = BREEDTE - 2 * MARGE

const INKT = rgb(0.102, 0.094, 0.078)
const ZACHT = rgb(0.361, 0.337, 0.302)
const LICHT = rgb(0.561, 0.533, 0.490)
const LINIAAL = rgb(0.851, 0.831, 0.788)
const GEEL = rgb(0.941, 0.706, 0.125)

interface Pen {
  doc: PDFDocument
  pagina: PDFPage
  y: number
  gewoon: PDFFont
  vet: PDFFont
  adres: string
}

/** Tekst afbreken op de kolombreedte, op hele woorden. */
function breek(tekst: string, font: PDFFont, grootte: number, breedte: number): string[] {
  const regels: string[] = []

  for (const alinea of String(tekst).split('\n')) {
    if (!alinea.trim()) { regels.push(''); continue }
    let regel = ''
    for (const woord of alinea.split(/\s+/)) {
      const kandidaat = regel ? `${regel} ${woord}` : woord
      if (font.widthOfTextAtSize(kandidaat, grootte) <= breedte) {
        regel = kandidaat
      } else {
        if (regel) regels.push(regel)
        // Eén woord dat zelf te lang is (een lange straatnaam zonder
        // spaties) breken we hard af; anders loopt hij de marge uit.
        if (font.widthOfTextAtSize(woord, grootte) > breedte) {
          let stuk = ''
          for (const teken of woord) {
            if (font.widthOfTextAtSize(stuk + teken, grootte) > breedte) {
              regels.push(stuk); stuk = teken
            } else stuk += teken
          }
          regel = stuk
        } else regel = woord
      }
    }
    regels.push(regel)
  }

  return regels
}

/** Een nieuwe pagina met de doorlopende kop erop. */
function nieuwePagina(pen: Pen, metKop = true): void {
  pen.pagina = pen.doc.addPage([BREEDTE, HOOGTE])
  pen.y = HOOGTE - MARGE

  if (!metKop) return

  pen.pagina.drawRectangle({ x: MARGE, y: pen.y - 4 * MM, width: 4 * MM, height: 4 * MM, color: GEEL })
  pen.pagina.drawText(`Opleverrapport · ${pen.adres}`, {
    x: MARGE + 6 * MM, y: pen.y - 3.2 * MM, size: 9.5, font: pen.vet, color: ZACHT,
  })
  pen.y -= 7 * MM
  pen.pagina.drawLine({
    start: { x: MARGE, y: pen.y }, end: { x: BREEDTE - MARGE, y: pen.y },
    thickness: 0.4 * MM, color: LINIAAL,
  })
  pen.y -= 8 * MM
}

/** Ruimte reserveren; past het niet, dan een nieuwe pagina. */
function ruimte(pen: Pen, hoogte: number): void {
  if (pen.y - hoogte < ONDER) nieuwePagina(pen)
}

function kop(pen: Pen, tekst: string): void {
  ruimte(pen, 14 * MM)
  pen.pagina.drawText(tekst, { x: MARGE, y: pen.y, size: 12, font: pen.vet, color: INKT })
  pen.y -= 2.5 * MM
  pen.pagina.drawLine({
    start: { x: MARGE, y: pen.y }, end: { x: BREEDTE - MARGE, y: pen.y },
    thickness: 0.3 * MM, color: LINIAAL,
  })
  pen.y -= 6 * MM
}

function lopendeTekst(pen: Pen, tekst: string, grootte = 10.5): void {
  for (const regel of breek(tekst, pen.gewoon, grootte, KOLOM)) {
    ruimte(pen, 6 * MM)
    if (regel) {
      pen.pagina.drawText(regel, { x: MARGE, y: pen.y, size: grootte, font: pen.gewoon, color: INKT })
    }
    pen.y -= grootte * 1.45
  }
  pen.y -= 2 * MM
}

/** Een regel "naam: waarde". Lege waarden slaan we over. */
function veld(pen: Pen, naam: string, waarde: string | null | undefined): void {
  if (!waarde || !String(waarde).trim()) return
  const labelBreedte = 38 * MM
  const regels = breek(String(waarde), pen.vet, 10, KOLOM - labelBreedte)

  ruimte(pen, regels.length * 5.5 * MM)
  pen.pagina.drawText(naam, { x: MARGE, y: pen.y, size: 10, font: pen.gewoon, color: LICHT })
  regels.forEach((regel, i) => {
    pen.pagina.drawText(regel, {
      x: MARGE + labelBreedte, y: pen.y - i * 5 * MM, size: 10, font: pen.vet, color: INKT,
    })
  })
  pen.y -= regels.length * 5 * MM + 1.5 * MM
}

/** Een blok vrije tekst met kop. Leeg blok betekent geen kop. */
function blok(pen: Pen, titel: string, tekst: string | null | undefined): void {
  if (!tekst || !String(tekst).trim()) return
  kop(pen, titel)
  lopendeTekst(pen, String(tekst))
  pen.y -= 3 * MM
}

/** `data:image/jpeg;base64,...` terug naar bytes. */
function uitDataUri(bron: string): { bytes: Uint8Array; png: boolean } | null {
  const m = /^data:(image\/[a-z+]+);base64,(.*)$/is.exec(bron.trim())
  if (!m) return null
  try {
    const ruw = atob(m[2])
    const bytes = new Uint8Array(ruw.length)
    for (let i = 0; i < ruw.length; i++) bytes[i] = ruw.charCodeAt(i)
    if (bytes.length === 0) return null
    return { bytes, png: m[1].toLowerCase().includes('png') }
  } catch {
    return null
  }
}

/**
 * De foto's van één punt, twee naast elkaar.
 *
 * Een foto die niet in te sluiten is slaan we over in plaats van het
 * hele rapport te laten mislukken: negentien foto's op papier is beter
 * dan geen rapport omdat er één stuk was.
 */
async function fotos(pen: Pen, lijst: Rapportfoto[], onderschrift: string): Promise<number> {
  const breedte = (KOLOM - 5 * MM) / 2
  const hoogte = 45 * MM
  let geplaatst = 0
  let kolom = 0

  for (const foto of lijst) {
    const rauw = uitDataUri(foto.bron)
    if (!rauw) continue

    let beeld
    try {
      beeld = rauw.png ? await pen.doc.embedPng(rauw.bytes) : await pen.doc.embedJpg(rauw.bytes)
    } catch {
      continue
    }

    if (kolom === 0) ruimte(pen, hoogte + 8 * MM)

    const x = MARGE + kolom * (breedte + 5 * MM)
    const verhouding = Math.min(breedte / beeld.width, hoogte / beeld.height)
    const b = beeld.width * verhouding
    const h = beeld.height * verhouding

    pen.pagina.drawImage(beeld, { x: x + (breedte - b) / 2, y: pen.y - hoogte + (hoogte - h) / 2, width: b, height: h })
    pen.pagina.drawRectangle({
      x, y: pen.y - hoogte, width: breedte, height: hoogte,
      borderColor: LINIAAL, borderWidth: 0.3 * MM,
    })

    const label = [onderschrift, foto.fase].filter(Boolean).join(' · ')
    if (label) {
      pen.pagina.drawText(breek(label, pen.gewoon, 8, breedte)[0] ?? '', {
        x, y: pen.y - hoogte - 4 * MM, size: 8, font: pen.gewoon, color: ZACHT,
      })
    }

    geplaatst++
    kolom++
    if (kolom === 2) { kolom = 0; pen.y -= hoogte + 9 * MM }
  }

  if (kolom === 1) pen.y -= hoogte + 9 * MM
  return geplaatst
}

/** Het hele opleverrapport als PDF-bytes. */
export async function bouwRapportPdf(g: Rapportgegevens): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const gewoon = await doc.embedFont(StandardFonts.Helvetica)
  const vet = await doc.embedFont(StandardFonts.HelveticaBold)
  const adres = g.adres ?? ''

  doc.setTitle(`Opleverrapport ${adres}`)
  doc.setProducer('NMZ GO')
  doc.setCreator('NMZ GO')

  const pen: Pen = { doc, pagina: doc.addPage([BREEDTE, HOOGTE]), y: HOOGTE - MARGE, gewoon, vet, adres }

  // ── Titelblad ──
  pen.pagina.drawRectangle({ x: MARGE, y: pen.y - 7 * MM, width: 7 * MM, height: 7 * MM, color: GEEL })
  pen.pagina.drawText('NMZ', { x: MARGE + 10 * MM, y: pen.y - 5.5 * MM, size: 13, font: vet, color: INKT })

  pen.y = HOOGTE / 2 + 40 * MM
  pen.pagina.drawRectangle({ x: MARGE, y: pen.y, width: 26 * MM, height: 1.6 * MM, color: GEEL })
  pen.y -= 14 * MM
  pen.pagina.drawText('Opleverrapport', { x: MARGE, y: pen.y, size: 30, font: vet, color: INKT })
  pen.y -= 12 * MM

  for (const regel of breek(adres, vet, 14, KOLOM)) {
    pen.pagina.drawText(regel, { x: MARGE, y: pen.y, size: 14, font: vet, color: INKT })
    pen.y -= 7 * MM
  }
  const plek = [g.postcode, g.plaats].filter(Boolean).join(' ')
  if (plek) {
    pen.pagina.drawText(plek, { x: MARGE, y: pen.y, size: 14, font: vet, color: INKT })
    pen.y -= 7 * MM
  }

  pen.y -= 6 * MM
  veld(pen, 'Opgeleverd op', g.opgeleverdOp)
  veld(pen, 'Uitvoering', g.uitvoering)
  veld(pen, 'Bonnummer', g.bonnummer)
  veld(pen, 'Projectnummer', g.opdrachtnummer)
  veld(pen, 'Opdrachtgever', g.opdrachtgever)
  veld(pen, 'Opgemaakt door', g.opgeleverdDoor)
  veld(pen, 'Uitgevoerd door', g.ploeg.join(', '))

  // ── Projectgegevens ──
  nieuwePagina(pen)
  kop(pen, 'Projectgegevens')
  veld(pen, 'Werkadres', adres)
  veld(pen, 'Postcode en plaats', plek)
  veld(pen, 'Project', g.projectnaam)
  veld(pen, 'Opdrachtgever', g.opdrachtgever)
  veld(pen, 'Projectnummer', g.opdrachtnummer)
  veld(pen, 'Inspecteur', g.inspecteur)
  veld(pen, 'Aannemer', g.aannemer)
  veld(pen, 'Opgeleverd op', g.opgeleverdOp)
  veld(pen, 'Uitvoering', g.uitvoering)
  veld(pen, 'Uitgevoerd door', g.ploeg.join(', '))
  pen.y -= 4 * MM

  blok(pen, 'Algemeen', g.vast?.algemeen)
  blok(pen, 'Toelichting werkzaamheden', g.vast?.werkzaamheden)
  blok(pen, 'Opmerkingen bewoners', g.opmerkingenBewoners)
  blok(pen, 'Extra uitgevoerde werkzaamheden', g.extraWerkzaamheden)
  blok(pen, 'Bijzonderheden', g.bijzonderheden)

  // ── Uitgevoerde werkzaamheden, met het bewijs eronder ──
  if (g.punten.length > 0) {
    kop(pen, 'Uitgevoerde werkzaamheden')
    for (const punt of g.punten) {
      const regels = breek(punt.titel, pen.gewoon, 10.5, KOLOM - 8 * MM)
      ruimte(pen, regels.length * 6 * MM + 4 * MM)

      pen.pagina.drawCircle({
        x: MARGE + 1.5 * MM, y: pen.y + 1.2 * MM, size: 1.2 * MM,
        color: punt.voltooid ? GEEL : LINIAAL,
      })
      regels.forEach((regel, i) => {
        pen.pagina.drawText(regel, {
          x: MARGE + 6 * MM, y: pen.y - i * 5.5 * MM, size: 10.5, font: pen.gewoon,
          color: punt.voltooid ? INKT : ZACHT,
        })
      })
      pen.y -= regels.length * 5.5 * MM

      if (!punt.voltooid) {
        pen.pagina.drawText('NIET AFGEROND', {
          x: MARGE + 6 * MM, y: pen.y, size: 8, font: vet, color: LICHT,
        })
        pen.y -= 5 * MM
      }
      pen.y -= 2 * MM
    }
  }

  // ── Fotorapportage ──
  const metFotos = g.punten.filter((p) => p.fotos.length > 0)
  if (metFotos.length > 0 || g.losseFotos.length > 0) {
    nieuwePagina(pen)
    kop(pen, 'Fotorapportage')

    for (const punt of metFotos) {
      ruimte(pen, 12 * MM)
      for (const regel of breek(punt.titel, vet, 10.5, KOLOM)) {
        pen.pagina.drawText(regel, { x: MARGE, y: pen.y, size: 10.5, font: vet, color: ZACHT })
        pen.y -= 5.5 * MM
      }
      pen.y -= 2 * MM
      await fotos(pen, punt.fotos, '')
      pen.y -= 3 * MM
    }

    if (g.losseFotos.length > 0) {
      ruimte(pen, 12 * MM)
      pen.pagina.drawText('Overige foto’s', { x: MARGE, y: pen.y, size: 10.5, font: vet, color: ZACHT })
      pen.y -= 7.5 * MM
      await fotos(pen, g.losseFotos, '')
    }
  }

  // ── Paginanummers ──
  const paginas = doc.getPages()
  paginas.forEach((p, i) => {
    const tekst = `${i + 1} / ${paginas.length}`
    p.drawText(tekst, {
      x: BREEDTE - MARGE - gewoon.widthOfTextAtSize(tekst, 8),
      y: ONDER - 6 * MM, size: 8, font: gewoon, color: LICHT,
    })
  })

  return await doc.save()
}

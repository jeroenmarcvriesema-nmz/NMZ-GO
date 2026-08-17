import { describe, it, expect } from 'vitest'
import {
  bouwRapport,
  datumInWoorden,
  ontsnap,
  periodeInWoorden,
  type Rapportgegevens,
} from '../supabase/functions/verwerker/rapportsjabloon'

// Het opleverrapport is het enige document dat NMZ GO naar buiten
// stuurt. Elke test hieronder hoort bij iets dat bij een opdrachtgever
// op tafel zou komen als het misging.

const kaal: Rapportgegevens = {
  bonnummer: '5815',
  projectnaam: 'Zwamsanering',
  adres: 'Hooistraat 8 te Amsterdam',
  postcode: null,
  plaats: null,
  opdrachtgever: null,
  opdrachtnummer: null,
  inspecteur: 'Rob Saffrie',
  aannemer: 'Nooitmeerzwam',
  opgeleverdOp: '14 augustus 2026',
  opgeleverdDoor: 'Jeroen Vriesema',
  uitvoering: '9 t/m 14 augustus 2026',
  ploeg: ['Danny', 'Martijn'],
  opmerkingenBewoners: null,
  extraWerkzaamheden: null,
  bijzonderheden: null,
  punten: [],
  losseFotos: [],
}

const foto = (fase = 'na') => ({ bron: 'data:image/jpeg;base64,AAAA', fase })

// Het woord "Fotorapportage" staat ook in een CSS-commentaar. Zoeken op
// de kop zelf, anders keurt een test de opmaak goed in plaats van de
// inhoud — en dat was precies de eerste uitkomst hier.
const FOTOKOP = '<h2 class="sectie">Fotorapportage</h2>'

describe('ontsnap', () => {
  it('maakt tekst onschadelijk die anders het document breekt', () => {
    // Een adres als "Kerkstraat 3 <achter>" of een bewonersopmerking
    // met een &: zonder ontsnappen loopt de opmaak vanaf dat teken in
    // de soep, en dat merk je pas als de opdrachtgever belt.
    expect(ontsnap('<script>')).toBe('&lt;script&gt;')
    expect(ontsnap('Jansen & Zn')).toBe('Jansen &amp; Zn')
    expect(ontsnap(null)).toBe('')
  })
})

describe('datumInWoorden', () => {
  it('schrijft een datum voluit', () => {
    expect(datumInWoorden('2026-08-14')).toBe('14 augustus 2026')
    expect(datumInWoorden('2026-01-01')).toBe('1 januari 2026')
  })

  it('verschuift niet door een tijdzone', () => {
    // Een opleverdatum die een dag verkeerd op papier staat levert een
    // discussie op die niemand kan winnen. Vroeg op de dag in UTC is
    // het gevaarlijkste geval: lokaal is het dan al de dag ervoor.
    expect(datumInWoorden('2026-08-14T00:30:00+00:00')).toBe('14 augustus 2026')
    expect(datumInWoorden('2026-08-14T23:30:00+00:00')).toBe('14 augustus 2026')
  })

  it('geeft niets terug bij niets of onzin', () => {
    expect(datumInWoorden(null)).toBeNull()
    expect(datumInWoorden('')).toBeNull()
    expect(datumInWoorden('geen datum')).toBeNull()
  })
})

describe('periodeInWoorden', () => {
  it('kort een periode binnen dezelfde maand in', () => {
    expect(periodeInWoorden('2026-08-09', '2026-08-14')).toBe('9 t/m 14 augustus 2026')
  })

  it('schrijft beide datums uit over een maandgrens heen', () => {
    expect(periodeInWoorden('2026-07-28', '2026-08-17')).toBe('28 juli 2026 t/m 17 augustus 2026')
  })

  it('houdt één dag één datum', () => {
    expect(periodeInWoorden('2026-08-14', '2026-08-14')).toBe('14 augustus 2026')
    expect(periodeInWoorden('2026-08-14', null)).toBe('14 augustus 2026')
    expect(periodeInWoorden(null, null)).toBeNull()
  })
})

describe('bouwRapport', () => {
  it('zet de harde feiten op het titelblad en de gegevenspagina', () => {
    const html = bouwRapport(kaal)
    expect(html).toContain('Hooistraat 8 te Amsterdam')
    expect(html).toContain('5815')
    expect(html).toContain('14 augustus 2026')
    expect(html).toContain('Danny, Martijn')
    expect(html).toContain('Nooitmeerzwam')
  })

  it('laat een leeg tekstveld helemaal weg', () => {
    // Niet "niet ingevuld" en zeker niet "nog aan te leveren": dit gaat
    // naar de opdrachtgever. Een kop zonder inhoud roept een vraag op
    // die niemand kan beantwoorden.
    const html = bouwRapport(kaal)
    expect(html).not.toContain('Opmerkingen bewoners')
    expect(html).not.toContain('Bijzonderheden')
    expect(html).not.toContain('aan te leveren')
  })

  it("laat de vaste alinea's weg zolang ze er niet zijn", () => {
    expect(bouwRapport(kaal)).not.toContain('Algemeen')
    const met = bouwRapport({ ...kaal, vast: { algemeen: 'Vaste tekst van kantoor.' } })
    expect(met).toContain('Algemeen')
    expect(met).toContain('Vaste tekst van kantoor.')
  })

  it('houdt alinea-indeling van een ingevuld veld overeind', () => {
    // Wie op de werkbon drie alinea's typt hoort er drie terug te zien.
    const html = bouwRapport({
      ...kaal,
      bijzonderheden: 'Kruipluik zat vast.\n\nAfgestemd met de inspecteur.',
    })
    expect(html).toContain('Bijzonderheden')
    expect(html).toContain('Kruipluik zat vast.')
    expect(html).toContain('Afgestemd met de inspecteur.')
    expect(html.match(/class="alinea"/g)?.length).toBe(2)
  })

  it('kapt een lange tekst nooit af', () => {
    // De eerste opzet gaf elk blad een vaste hoogte met overflow
    // hidden. Een bewonersopmerking van tien regels werd er dan zes,
    // zonder spoor. Alles wat erin gaat moet er ook in staan.
    const lang = Array.from({ length: 60 }, (_, i) => `Regel ${i + 1} van de opmerking.`).join(' ')
    const html = bouwRapport({ ...kaal, opmerkingenBewoners: lang })
    expect(html).toContain('Regel 1 van de opmerking.')
    expect(html).toContain('Regel 60 van de opmerking.')
  })

  it('zet alle punten in de werkzaamheden en alleen die met foto in de fotorapportage', () => {
    const html = bouwRapport({
      ...kaal,
      punten: [
        { titel: 'Kruipruimte inspecteren', voltooid: true, fotos: [foto()] },
        { titel: 'Ventilatieroosters schoonmaken', voltooid: true, fotos: [] },
      ],
    })
    expect(html).toContain('Uitgevoerde werkzaamheden')
    expect(html).toContain('Kruipruimte inspecteren')
    expect(html).toContain('Ventilatieroosters schoonmaken')

    // Het punt zonder foto hoort wel in de lijst maar niet in de
    // fotorapportage — anders staat er een kop boven niets.
    const fotodeel = html.slice(html.indexOf(FOTOKOP))
    expect(fotodeel).toContain('Kruipruimte inspecteren')
    expect(fotodeel).not.toContain('Ventilatieroosters schoonmaken')
  })

  it('laat de fotorapportage weg als er geen enkele foto is', () => {
    const html = bouwRapport({
      ...kaal,
      punten: [{ titel: 'Alleen dit punt', voltooid: true, fotos: [] }],
    })
    expect(html).not.toContain(FOTOKOP)
  })

  it("neemt foto's mee die aan geen punt hangen", () => {
    const html = bouwRapport({ ...kaal, losseFotos: [foto('voor')] })
    expect(html).toContain(FOTOKOP)
    expect(html).toContain('Overige')
    expect(html).toContain('data:image/jpeg;base64,AAAA')
  })

  it("draagt de foto's in het bestand zelf", () => {
    // Geen verwijzing naar een server die er over een jaar misschien
    // niet meer is: het rapport moet uit een archiefmap nog kloppen.
    const html = bouwRapport({
      ...kaal,
      punten: [{ titel: 'Punt', voltooid: true, fotos: [foto()] }],
    })
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"')
    expect(html).not.toMatch(/src="https?:/)
  })

  it("telt de werkzaamheden en foto's op het titelblad", () => {
    const html = bouwRapport({
      ...kaal,
      punten: [
        { titel: 'Een', voltooid: true, fotos: [foto(), foto()] },
        { titel: 'Twee', voltooid: true, fotos: [foto()] },
      ],
      losseFotos: [foto()],
    })
    expect(html).toContain("2 werkzaamheden · 4 foto's")
  })

  it('overleeft een adres met tekens die opmaak zijn', () => {
    const html = bouwRapport({ ...kaal, adres: 'Kerkstraat 3 <achter> & co' })
    expect(html).toContain('Kerkstraat 3 &lt;achter&gt; &amp; co')
    expect(html).not.toContain('<achter>')
  })
})

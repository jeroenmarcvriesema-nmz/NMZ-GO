import { describe, it, expect } from 'vitest'
import {
  bouwRapport,
  datumInWoorden,
  postadres,
  veilig,
  type Rapportgegevens,
} from '../supabase/functions/verwerker/rapportsjabloon'

// Het opleverrapport gaat naar een opdrachtgever. Wat hier misgaat
// wordt niet door een collega gezien maar door een klant, en dat is
// precies waarom deze opmaak een test heeft en geen handmatige
// doorloop.

const BASIS: Rapportgegevens = {
  adres: 'Hooistraat 8',
  postcode: '1017 AB',
  plaats: 'Amsterdam',
  opdrachtnummer: null,
  opdrachtgever: 'Woningstichting De Key',
  opleverdatum: '2026-08-18',
  opgemaaktDoor: 'M. de Vries',
  ploeg: ['Danny', 'Martijn'],
  opmerkingenBewoners: 'Bewoner was tevreden over de communicatie vooraf.',
  extraWerkzaamheden: null,
  bijzonderheden: null,
  punten: [
    { titel: 'Kruipruimte behandeld', voltooid: true },
    { titel: 'Meterkast geïsoleerd', voltooid: false },
  ],
  fotos: [
    { bron: 'data:image/jpeg;base64,AAA', bijschrift: 'Kruipruimte behandeld', fase: 'voor' },
    { bron: 'data:image/jpeg;base64,BBB', bijschrift: 'Kruipruimte behandeld', fase: 'na' },
  ],
  gemaaktOp: '2026-08-21T09:00:00.000Z',
}

describe('veilig', () => {
  // Een adres of een opmerking van een bewoner is ingetypt door een
  // mens. Eén losse punthaak zou de rest van het rapport onzichtbaar
  // maken.
  it('ontmantelt tekst die anders als opmaak zou tellen', () => {
    expect(veilig('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;')
    expect(veilig('Jansen & Zn. "de oude"')).toBe('Jansen &amp; Zn. &quot;de oude&quot;')
  })

  it('laat leeg leeg en valt niet over null', () => {
    expect(veilig(null)).toBe('')
    expect(veilig(undefined)).toBe('')
  })
})

describe('datumInWoorden', () => {
  it('schrijft de maand voluit', () => {
    expect(datumInWoorden('2026-08-18')).toBe('18 augustus 2026')
    expect(datumInWoorden('2026-01-01')).toBe('1 januari 2026')
  })

  // Een leeg veld hoort leeg te blijven en niet als "Invalid Date" op
  // een document bij de opdrachtgever te belanden.
  it('geeft niets terug bij leeg of onzin', () => {
    expect(datumInWoorden(null)).toBe('')
    expect(datumInWoorden('geen datum')).toBe('')
  })
})

describe('postadres', () => {
  it('plakt postcode en plaats aan elkaar', () => {
    expect(postadres('1017 AB', 'Amsterdam')).toBe('1017 AB Amsterdam')
  })

  it('houdt geen losse spatie over als er één ontbreekt', () => {
    expect(postadres(null, 'Amsterdam')).toBe('Amsterdam')
    expect(postadres('1017 AB', null)).toBe('1017 AB')
    expect(postadres(null, null)).toBe('')
  })
})

describe('bouwRapport', () => {
  const html = bouwRapport(BASIS)

  it('levert één zelfstandig document op', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('<title>Opleverrapport Hooistraat 8 te Amsterdam</title>')
    // Geen enkele verwijzing naar buiten: alles moet in het bestand
    // zelf zitten, anders is het rapport na doorsturen leeg.
    expect(html).not.toMatch(/<link[^>]+href="http/i)
    expect(html).not.toMatch(/<script/i)
  })

  it('zet de drie delen op eigen bladen', () => {
    expect(html).toContain('Opleverrapport')
    expect(html).toContain('Projectgegevens')
    expect(html).toContain('Fotorapportage')
    // Titelblad, projectgegevens, fotorapportage.
    expect(html.match(/class="blad/g)?.length).toBe(3)
  })

  it('zet de ploeg en de opdrachtgever erop', () => {
    expect(html).toContain('Danny, Martijn')
    expect(html).toContain('Woningstichting De Key')
    expect(html).toContain('18 augustus 2026')
  })

  // Een punt dat niet af is hoort niet stilzwijgend als afgerond op een
  // opleverrapport te staan. Dat is precies het soort verschil waar een
  // discussie over meerwerk op uitkomt.
  it('markeert een punt dat niet is afgerond', () => {
    expect(html).toContain('Kruipruimte behandeld')
    expect(html).toContain('niet afgerond')
  })

  it('groepeert de foto’s per fase', () => {
    expect(html).toContain('Voor aanvang')
    expect(html).toContain('Na afronding')
    // 'Tijdens' zit niet in deze klus en hoort er dan ook niet als lege
    // kop te staan.
    expect(html).not.toContain('Tijdens de werkzaamheden')
  })

  // Een fase die niemand voorzag mag niet stilzwijgend verdwijnen:
  // dan mist er bewijs zonder dat iemand het ziet.
  it('laat een onbekende fase niet uit het rapport vallen', () => {
    const uit = bouwRapport({
      ...BASIS,
      fotos: [{ bron: 'data:image/jpeg;base64,CCC', bijschrift: '', fase: 'onbekend' }],
    })
    expect(uit).toContain('Overige foto')
    expect(uit).toContain('CCC')
  })

  it('laat een leeg tekstveld weg in plaats van een lege kop te tonen', () => {
    expect(html).toContain('Opmerkingen bewoners')
    expect(html).not.toContain('Extra uitgevoerde werkzaamheden')
    expect(html).not.toContain('Bijzonderheden')
  })

  // De twee vaste alinea's uit het papieren sjabloon zijn bewust niet
  // verzonnen. Zolang ze niet zijn aangeleverd blijven de kopjes weg.
  it('toont de vaste alinea’s alleen als ze zijn aangeleverd', () => {
    expect(html).not.toContain('Algemeen')
    const met = bouwRapport({ ...BASIS, juridischeAlinea: 'Op al onze werkzaamheden.' })
    expect(met).toContain('Algemeen')
    expect(met).toContain('Op al onze werkzaamheden.')
  })

  it('overleeft een klus zonder foto’s, zonder ploeg en zonder datum', () => {
    const kaal = bouwRapport({
      ...BASIS,
      ploeg: [],
      fotos: [],
      punten: [],
      opleverdatum: null,
      opdrachtgever: null,
      opmerkingenBewoners: null,
    })
    expect(kaal).toContain('Hooistraat 8')
    expect(kaal).not.toContain('Fotorapportage')
    expect(kaal).not.toContain('Invalid Date')
    expect(kaal).not.toContain('undefined')
    expect(kaal).not.toContain('null')
  })

  it('ontmantelt een adres met opmaak erin', () => {
    const stout = bouwRapport({ ...BASIS, adres: '<img src=x onerror=1>' })
    expect(stout).not.toContain('<img src=x')
    expect(stout).toContain('&lt;img src=x')
  })
})

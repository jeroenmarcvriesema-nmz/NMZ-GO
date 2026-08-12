import { describe, it, expect } from 'vitest'
import { groepeerKlussen, groepsstatus, plaatsUitAdres } from '@/lib/klusgroepen'
import type { Werkbon } from '@/types'

// ============================================================
// Wat deze test bewaakt
// ============================================================
// De projectenpagina las de tabel `projecten`. Die heeft nul rijen en
// krijgt er ook nooit een bij: uit ClickUp komt één taak als één
// werkbon, nooit als project. De pagina toonde dus altijd de lege
// staat, en zoeken vond daarom niets — niet omdat het zoekveld stuk
// was, maar omdat de lijst leeg was.
//
// De groepering hieronder maakt de lijst uit de werkbonnen zelf.
// Gelijke opdrachtnummers horen bij elkaar; al het andere is een losse
// klus. Bij ons is vandaag geen enkel opdrachtnummer gevuld, dus de
// test dat dertig lege nummers dertig losse klussen opleveren en niet
// één grote groep is geen randgeval maar de normale toestand.
// ============================================================

function bon(over: Partial<Werkbon>): Werkbon {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    bonnummer: '', projectnaam: '', adres: 'Kerkstraat 1',
    opdrachtgever: null, datum: '2026-08-10', status: 'open',
    aangemaakt_door: null, created_at: '', updated_at: '',
    ...over,
  }
}

describe('groepeerKlussen', () => {
  it('maakt van elke bon zonder opdrachtnummer een eigen klus', () => {
    const groepen = groepeerKlussen([
      bon({ id: 'a', adres: 'Kerkstraat 1' }),
      bon({ id: 'b', adres: 'Dorpsstraat 2' }),
    ])
    expect(groepen).toHaveLength(2)
    expect(groepen.every((g) => g.soort === 'klus')).toBe(true)
  })

  // Dit is de toestand van vandaag: geen enkele bon heeft een
  // opdrachtnummer. Een lege string mag niet als sleutel gelden, anders
  // wordt alles één project met dertig adressen.
  it('gooit lege opdrachtnummers niet op één hoop', () => {
    const groepen = groepeerKlussen([
      bon({ id: 'a', opdrachtnummer: '' }),
      bon({ id: 'b', opdrachtnummer: null }),
      bon({ id: 'c', opdrachtnummer: '   ' }),
    ])
    expect(groepen).toHaveLength(3)
  })

  it('bundelt bonnen met hetzelfde opdrachtnummer tot één project', () => {
    const groepen = groepeerKlussen([
      bon({ id: 'a', opdrachtnummer: 'C515', adres: 'Scheibeekstraat 9', plaats: 'Assendelft' }),
      bon({ id: 'b', opdrachtnummer: 'C515', adres: 'Scheibeekstraat 11', plaats: 'Assendelft' }),
      bon({ id: 'c', adres: 'Losse klus' }),
    ])
    expect(groepen).toHaveLength(2)
    const project = groepen.find((g) => g.soort === 'project')!
    expect(project.naam).toBe('C515')
    expect(project.bonnen).toHaveLength(2)
    // Twee keer dezelfde plaats hoort er één keer te staan.
    expect(project.plaatsen).toEqual(['Assendelft'])
  })

  // Eén bon met een nummer is nog geen project: dat zou een kaart
  // opleveren die je moet openklappen om één adres te zien.
  it('noemt één bon met een opdrachtnummer een klus, geen project', () => {
    const [groep] = groepeerKlussen([bon({ opdrachtnummer: 'C515', adres: 'Kerkstraat 1' })])
    expect(groep.soort).toBe('klus')
    expect(groep.naam).toBe('Kerkstraat 1')
  })

  it('telt de punten van alle bonnen bij elkaar op', () => {
    const [groep] = groepeerKlussen([
      bon({
        opdrachtnummer: 'C515',
        taken: [
          { id: '1', werkbon_id: 'a', titel: '', omschrijving: null, voltooid: true, foto_vereist: true, opmerking: null, volgorde: 0, created_at: '' },
          { id: '2', werkbon_id: 'a', titel: '', omschrijving: null, voltooid: false, foto_vereist: true, opmerking: null, volgorde: 1, created_at: '' },
        ],
      }),
      bon({
        opdrachtnummer: 'C515',
        taken: [
          { id: '3', werkbon_id: 'b', titel: '', omschrijving: null, voltooid: true, foto_vereist: true, opmerking: null, volgorde: 0, created_at: '' },
        ],
      }),
    ])
    expect(groep.punten).toBe(3)
    expect(groep.puntenKlaar).toBe(2)
  })

  it('pakt de vroegste start en de laatste einddatum', () => {
    const [groep] = groepeerKlussen([
      bon({ opdrachtnummer: 'C515', geplande_start: '2026-08-10', geplande_eind: '2026-08-12' }),
      bon({ opdrachtnummer: 'C515', geplande_start: '2026-08-03', geplande_eind: '2026-08-20' }),
    ])
    expect(groep.van).toBe('2026-08-03')
    expect(groep.tot).toBe('2026-08-20')
  })

  it('sorteert op voortgang, niet op datum', () => {
    // Stond op begindatum, nieuwste eerst. Daardoor kwam een klus die
    // volgende maand begint bóven een klus die vandaag stilligt.
    const groepen = groepeerKlussen([
      bon({ id: 'later',  datum: '2026-09-01' }),
      bon({ id: 'stil',   datum: '2026-01-05', stilgelegd_op: '2026-01-06' }),
      bon({ id: 'loopt',  datum: '2026-02-01', taken: [{ voltooid: true }, { voltooid: false }] as any }),
    ])
    expect(groepen.map((g) => g.bonnen[0].id)).toEqual(['stil', 'loopt', 'later'])
  })

  it('zet binnen dezelfde stand de oudste bovenaan', () => {
    // Wat het langst wacht heeft de meeste haast.
    const groepen = groepeerKlussen([
      bon({ id: 'nieuw', datum: '2026-08-10' }),
      bon({ id: 'oud',   datum: '2026-01-05' }),
    ])
    expect(groepen.map((g) => g.bonnen[0].id)).toEqual(['oud', 'nieuw'])
  })
})

// De kolom `plaats` is bij alle dertig bonnen leeg; de parser vult hem
// niet. De plaats staat wél in het adres, in twee schrijfwijzen die
// allebei in de echte data voorkomen.
describe('plaatsUitAdres', () => {
  it('leest de plaats na " te "', () => {
    expect(plaatsUitAdres('Stuyvesantstraat 72 te Den Haag')).toBe('Den Haag')
    expect(plaatsUitAdres('Jan van Galenstraat 211HS te Amsterdam')).toBe('Amsterdam')
  })

  it('leest de plaats na een komma', () => {
    expect(plaatsUitAdres('Boerlagestraat 12, Zandvoort')).toBe('Zandvoort')
  })

  // "79 t/m 129" is geen " te ": de spaties eromheen houden dat buiten
  // de deur. Zonder dat zou de plaats "/m 129" worden.
  it('trapt niet in "t/m"', () => {
    expect(plaatsUitAdres('Rembrandstraat 79 t/m 129')).toBeNull()
  })

  it('geeft niets terug als er geen plaats in staat', () => {
    expect(plaatsUitAdres('Kerkstraat 1')).toBeNull()
    expect(plaatsUitAdres('')).toBeNull()
    expect(plaatsUitAdres(null)).toBeNull()
  })

  // De kolom is het antwoord zodra hij gevuld is; dit is een gok op
  // basis van twee schrijfwijzen en hoort te wijken.
  it('wijkt voor een gevulde plaats-kolom', () => {
    const [groep] = groepeerKlussen([
      bon({ adres: 'Kerkstraat 1 te Haarlem', plaats: 'Heemstede' }),
    ])
    expect(groep.plaatsen).toEqual(['Heemstede'])
  })

  it('vult de plaats aan als de kolom leeg is', () => {
    const [groep] = groepeerKlussen([
      bon({ adres: 'Kerkstraat 1 te Haarlem', plaats: null }),
    ])
    expect(groep.plaatsen).toEqual(['Haarlem'])
  })
})

describe('groepsstatus', () => {
  // Wat een telefoontje vraagt staat bovenaan: één stilgelegde bon
  // bepaalt de kleur van de hele kaart, ook als de rest loopt.
  it('laat stilgelegd voorgaan op alles', () => {
    expect(groepsstatus([
      bon({ status: 'bezig' }),
      bon({ stilgelegd_op: '2026-08-01' }),
    ])).toBe('stilgelegd')
  })

  it('is afgerond als alles af is', () => {
    expect(groepsstatus([
      bon({ status: 'voltooid' }),
      bon({ opgeleverd_op: '2026-08-01' }),
    ])).toBe('afgerond')
  })

  it('is bezig zodra er één bon af is en de rest nog niet', () => {
    // Een project half af "niet gestart" noemen klopt niet: er is aan
    // gewerkt. En "afgerond" ook niet, want er ligt nog werk.
    expect(groepsstatus([
      bon({ status: 'voltooid' }),
      bon({ status: 'open' }),
    ])).toBe('bezig')
  })

  it('gebruikt dezelfde standen als één losse klus', () => {
    // Hier stond een eigen lijstje met "actief" waar de rest van de app
    // "bezig" zegt. Eén woordenlijst, anders heet een status op de
    // projectenpagina anders dan op de werkbon ernaast.
    expect(groepsstatus([bon({ status: 'open', taken: [{ voltooid: true }, { voltooid: false }] as any })])).toBe('bezig')
    expect(groepsstatus([bon({ opgeleverd_op: '2026-08-01' })])).toBe('opgeleverd')
  })

  it('zet een groep waar alles is afgevinkt op "klaar om af te ronden"', () => {
    expect(groepsstatus([
      bon({ status: 'open', taken: [{ voltooid: true }, { voltooid: true }] as any }),
      bon({ status: 'voltooid' }),
    ])).toBe('af_te_ronden')
  })

  it('is niet gestart als er nog niets gebeurd is', () => {
    expect(groepsstatus([bon({}), bon({})])).toBe('niet_gestart')
  })
})

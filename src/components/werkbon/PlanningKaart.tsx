import { cn } from '@/lib/utils'
import { klusstand, looptUit, isAsbest, STANDEN, UITLOOP, ASBEST } from '@/lib/klusstand'
import type { PlanningItem } from '@/types'
import {
  IconUsers, IconListCheck, IconKey, IconPlayerPause,
  IconCircleCheck, IconArrowNarrowRight, IconArrowNarrowLeft,
  IconClockExclamation, IconBiohazard,
} from '@tabler/icons-react'

/**
 * De stand van een klus in de planning.
 *
 * De kleuren komen uit `lib/klusstand.ts` — dezelfde tabel als op de
 * werkbonnen, Mijn bonnen en het archief. Ze stonden hier ooit apart,
 * en dat was precies waarom een klus die liep hier blauw was en drie
 * schermen verderop geel.
 *
 * De stand wordt uit de punten afgeleid en niet uit `status`: die kolom
 * staat op elke bon op 'open', ook op de bon waar zeven punten zijn
 * afgevinkt. Zonder dat zou de hele kolom grijs blijven.
 */
function feitenVan(item: PlanningItem) {
  return {
    status: item.status === 'afgerond' ? 'voltooid' : 'open',
    stilgelegd_op: item.status === 'stilgelegd' ? 'ja' : null,
    puntenKlaar: item.puntenKlaar,
    punten: item.punten,
    // Geklokt telt als bezig, net als op het dashboard.
    looptNu: item.looptNu,
  }
}

interface PlanningKaartProps {
  item: PlanningItem
  onOpen: () => void
  /** Deze klus liep gisteren al. */
  loopIn?: boolean
  /** Deze klus loopt morgen door. */
  loopUit?: boolean
  /** Ruimer, voor de gestapelde weergave op een telefoon. */
  ruim?: boolean
}

/**
 * Eén klus in de weekplanning.
 *
 * De vorige kaart zette `projectnaam` vet bovenaan en het adres klein
 * en grijs eronder. Sinds elke klus een losse bon is, is die projectnaam
 * altijd leeg — er stond dus een lege vetgedrukte regel boven een grijs
 * adres. Dat is waarom de blokjes onleesbaar aanvoelden: het enige dat
 * ertoe doet stond in de kleinste letter.
 *
 * Nu staat het adres bovenaan, in de kleur van de status, met een
 * randje aan de linkerkant dat je van een afstand al leest. De pijltjes
 * geven aan of een klus uit de vorige dag doorloopt of morgen verder
 * gaat — bij ons duren klussen vaak een week en dan wil je zien of er
 * die dag iets begint of dat het gewoon doorloopt.
 */
export function PlanningKaart({ item, onOpen, loopIn, loopUit, ruim }: PlanningKaartProps) {
  const stand = klusstand(feitenVan(item))
  const k = STANDEN[stand]
  const voortgang = item.punten > 0 ? Math.round((item.puntenKlaar / item.punten) * 100) : 0

  // Uitloop ligt over de stand heen: de klus is nog steeds bezig of
  // ligt stil, maar de opleverdatum is voorbij. De rand links draagt
  // dat, want dat is wat je van een meter afstand leest — het vlak
  // blijft de stand tonen, anders raak je die kwijt.
  const laat = looptUit({ ...feitenVan(item), geplande_eind: item.eind, datum: item.datum })

  // Asbest gaat vóór uitloop: een asbestklus die ook over zijn datum
  // heen is, blijft in de eerste plaats een asbestklus. Daar hangt een
  // inventarisatie aan; de dagen tellen pas daarna.
  const asbest = isAsbest(item.stillegReden)
  const accent = asbest ? ASBEST : laat ? UITLOOP : null

  return (
    <button
      onClick={onOpen}
      className={cn(
        'group w-full text-left rounded-lg border border-l-[6px] shadow-sm',
        'hover:shadow-md hover:-translate-y-px active:translate-y-0',
        'transition-all duration-150 ease-brand',
        // Een verloop van links naar rechts in de kleur van de stand.
        //
        // Hiervoor stond hier de keuze tussen twee uitersten: het hele
        // vlak in een zachte tint (KLEURWAS), of een wit kaartje met
        // alleen een randje. Het eerste maakte van een week dertig
        // gekleurde blokken waarop je de adressen niet meer las; het
        // tweede zei van een meter afstand te weinig.
        //
        // Het verloop doet allebei. Links, waar de rand zit en waar het
        // oog toch al naar de kleur zoekt, draagt het vlak de stand; op
        // de helft is de kleur op, en daar staan de namen en de
        // aantallen op een rustige ondergrond. Een kaart kan bovendien
        // nog steeds meer dan één ding zeggen — de rand mag intussen de
        // uitloop of het asbest dragen.
        asbest ? ASBEST.verloop : laat ? UITLOOP.verloop : k.verloop,
        // Een neutrale rand: het verloop draagt de kleur nu, en een
        // gekleurde rand eromheen zou er een tweede keer hetzelfde
        // zeggen. `KLEURWAS` gaat over de zachte tint op de lijstkaarten
        // elders en raakt deze kaart niet meer.
        'border-gray-100 dark:border-white/10',
        accent ? accent.rand : k.rand,
        ruim ? 'p-3.5' : 'p-2.5',
      )}
    >
      <div className="flex items-start gap-1.5">
        {loopIn && (
          <IconArrowNarrowLeft
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-tekst-fijn dark:text-white/40"
            title="Loopt door van gisteren"
          />
        )}
        <span className={cn(
          // `break-words` breekt middenin een woord zodra het niet past.
          // Dat gebeurde voortdurend ("Meidoornstraa / t 4"), maar de
          // oorzaak was de kolombreedte en niet deze regel: de
          // dagkolommen hebben nu een ondergrens van 190 pixels (zie
          // Planning.tsx). `break-words` blijft staan als laatste
          // redmiddel voor een woord dat écht breder is dan de kaart —
          // dan is afbreken beter dan buiten het kader steken.
          // `hyphens-auto` is bewust géén oplossing: dat werkt alleen als
          // de browser een Nederlands afbreekwoordenboek heeft.
          'flex-1 min-w-0 font-bold leading-snug text-gray-900 dark:text-white break-words',
          ruim ? 'text-sm' : 'text-[13px]',
        )}>
          {item.adres || 'Zonder adres'}
        </span>
        {loopUit && (
          <IconArrowNarrowRight
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-tekst-fijn dark:text-white/40"
            title="Loopt morgen door"
          />
        )}
      </div>

      {/* Status als bolletje met woord: het bolletje leest van een
          afstand, het woord is er voor wie kleur niet onderscheidt. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', k.bol)} />
          {/* `tekstDiep` en niet `tekst`: dit woord staat op het verloop van
              zijn eigen kleur, en daar zakt de gewone tint onder de norm.
              Zie de toelichting in lib/klusstand.ts. */}
          <span className={cn('text-[11px] font-semibold truncate', k.tekstDiep)}>{k.kort}</span>
        </span>

        {item.punten > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-tekst-gedempt dark:text-white/55 tabular-nums">
            <IconListCheck className="w-3 h-3 flex-shrink-0" />
            {item.puntenKlaar}/{item.punten}
          </span>
        )}

        {item.kluiscode && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-white/50">
            <IconKey className="w-3 h-3 flex-shrink-0" />{item.kluiscode}
          </span>
        )}

        {/* Het woord erbij, net als bij de standen. Een gekleurde rand
            alleen is niet genoeg voor wie in de zon op een dak staat —
            en niet iedereen ziet kleurverschil. Bij asbest weegt dat
            het zwaarst: dat is het ene bericht dat niet mag afhangen
            van of iemand oranje van amber onderscheidt. */}
        {asbest && (
          <span className={cn('flex items-center gap-1 text-[11px] font-bold', ASBEST.tekstDiep)}>
            <IconBiohazard className="w-3 h-3 flex-shrink-0" /> asbest
          </span>
        )}

        {laat && (
          <span className={cn('flex items-center gap-1 text-[11px] font-bold', UITLOOP.tekstDiep)}>
            <IconClockExclamation className="w-3 h-3 flex-shrink-0" /> loopt uit
          </span>
        )}
      </div>

      {item.medewerkers.length > 0 && (
        <div className="flex items-start gap-1 mt-1.5 text-[11px] text-gray-500 dark:text-white/50 min-w-0">
          <IconUsers className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="leading-snug break-words">{item.medewerkers.join(', ')}</span>
        </div>
      )}

      {/* Een dunne balk onderin in plaats van een percentage in cijfers:
          in een kolom van vier klussen wil je scannen, niet rekenen. */}
      {voortgang > 0 && (
        <div className={cn('mt-2 h-1 rounded-full overflow-hidden', k.balkbed)}>
          <div
            className={cn('h-full rounded-full transition-all duration-300', k.bol)}
            style={{ width: `${voortgang}%` }}
          />
        </div>
      )}

      {stand === 'stilgelegd' && (
        <div className={cn('flex items-center gap-1 mt-2 text-[11px] font-semibold', STANDEN.stilgelegd.tekstDiep)}>
          <IconPlayerPause className="w-3 h-3 flex-shrink-0" /> wacht op een besluit
        </div>
      )}

      {stand === 'af_te_ronden' && (
        <div className={cn('flex items-center gap-1 mt-2 text-[11px] font-semibold', STANDEN.af_te_ronden.tekstDiep)}>
          <IconCircleCheck className="w-3 h-3 flex-shrink-0" /> wacht op afronden
        </div>
      )}

      {(stand === 'afgerond' || stand === 'opgeleverd') && (
        <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-green-700 dark:text-green-400">
          <IconCircleCheck className="w-3 h-3 flex-shrink-0" /> klaar
        </div>
      )}
    </button>
  )
}

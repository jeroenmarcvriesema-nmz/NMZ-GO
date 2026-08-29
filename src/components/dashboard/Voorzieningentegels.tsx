import { useNavigate } from 'react-router-dom'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { useVoorzieningen } from '@/hooks/useVoorzieningen'
import { bestelstand } from '@/lib/bestelstand'
import { IconAlertTriangle, IconPackage, IconTruck } from '@tabler/icons-react'

/**
 * Containers en dixi's op het dashboard, als drie tegels.
 *
 * Hier stond de hele lijst: drie stapels met alle regels, halverwege de
 * pagina, onder het projectoverzicht vandaan te scrollen. Twee dingen
 * gingen daar mis. Je zag het pas als je ernaartoe scrolde — terwijl
 * dit het enige blok op het dashboard is waar een dag uitstel direct
 * geld kost — en een lijst in een kaart die eigenlijk een overzicht is,
 * geeft geen enkele regel de ruimte om eruit te springen.
 *
 * Een dashboard beantwoordt "hoeveel en hoe erg". De lijst zelf staat
 * op `/voorzieningen`, waar elke regel zijn eigen streepje, chip en
 * knoppen heeft.
 *
 * Het bijschrift is bewust het scherpste geval en niet een samenvatting:
 * "langste 8 dagen over de datum" zegt of dit vandaag moet, "3 open"
 * niet. Een tegel op nul gaat nergens heen — zie KpiCard.
 */
export function Voorzieningentegels() {
  const { afmelden, bestellen, staatEr, loading, error } = useVoorzieningen()
  const navigate = useNavigate()

  // Bij een fout of tijdens het laden geen tegels met een nul erin.
  // Nul betekent hier "niets te doen", en dat is een ander bericht dan
  // "we weten het nog niet".
  if (loading || error) return null

  const naar = () => navigate('/voorzieningen')
  const ergste = afmelden[0]?.dagenNaEind ?? 0
  const eerste = bestellen[0]

  return (
    <>
      {/* Het kopje hoort bij de tegels en niet bij het dashboard: staat
          het daar, dan blijft er tijdens het laden een kopje boven niets
          staan. Een ander soort getal dan de standen erboven — die gaan
          over klussen, deze over spullen — dus het mag er staan. */}
      <h2 className="text-[10px] font-bold tracking-widest uppercase text-tekst-gedempt dark:text-white/55 mb-2.5">
        Containers &amp; dixi&apos;s
      </h2>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      <KpiCard
        label="Af te melden"
        value={afmelden.length}
        icon={<IconAlertTriangle />}
        variant={afmelden.length > 0 ? 'red' : 'neutral'}
        sub={afmelden.length === 0
          ? 'niets staat te lang'
          : ergste > 0
            ? `langste ${ergste} ${ergste === 1 ? 'dag' : 'dagen'} over de datum`
            : 'vandaag aan de beurt'}
        onClick={afmelden.length > 0 ? naar : undefined}
        actie={afmelden.length > 0 ? 'Laat ophalen' : undefined}
      />
      <KpiCard
        label="Te bestellen"
        value={bestellen.length}
        icon={<IconPackage />}
        variant={bestellen.length > 0 ? 'blue' : 'neutral'}
        sub={eerste ? `eerste: ${bestelstand(eerste, 'bestellen').tekst}` : 'alles is besteld'}
        onClick={bestellen.length > 0 ? naar : undefined}
        actie={bestellen.length > 0 ? 'Bestel nu' : undefined}
      />
      <KpiCard
        label="Staat er"
        value={staatEr.length}
        icon={<IconTruck />}
        variant="neutral"
        sub="besteld en nog niet afgemeld"
        onClick={staatEr.length > 0 ? naar : undefined}
        actie={staatEr.length > 0 ? 'Bekijk lijst' : undefined}
      />
      </div>
    </>
  )
}

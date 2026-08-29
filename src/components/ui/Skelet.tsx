import { cn } from '@/lib/utils'

/**
 * Een grijs vlak in de vorm van wat er zo komt te staan.
 *
 * `UI_GUIDELINES.md` beschrijft skeletons al als de norm voor content
 * die merkbare tijd nodig heeft — maar ze bestonden niet, en overal
 * draaide een spinner die de hele pagina leeghield. Het verschil is niet
 * de wachttijd maar wat je in die tijd ziet: een spinner zegt "wacht",
 * een skelet zegt "er komt een lijst, en hij is ongeveer zo lang". Op
 * een telefoon voor een deur op 4G scheelt dat in gevoelde snelheid meer
 * dan welke optimalisatie ook.
 *
 * Neutrale tinten, nooit merkkleur — geel dat pulseert leest als een
 * waarschuwing. De puls staat uit voor wie minder beweging heeft
 * gevraagd; dat regelt het blok in `index.css`.
 */
export function Skelet({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-sm bg-surface-2 dark:bg-white/10', className)}
    />
  )
}

/**
 * Een kaart zoals `WerkbonKaart` er een tekent: titel, twee regels
 * meta, een voortgangsbalk.
 */
export function SkeletKaart() {
  return (
    <div className="border border-gray-100 dark:border-white/10 rounded-lg bg-white dark:bg-surface-dark-2 p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skelet className="h-4 w-2/3" />
          <Skelet className="h-3 w-1/2" />
        </div>
        <Skelet className="h-6 w-20 rounded-sm" />
      </div>
      <div className="flex gap-3 mb-4">
        <Skelet className="h-3 w-24" />
        <Skelet className="h-3 w-16" />
      </div>
      <Skelet className="h-1.5 w-full rounded-full" />
    </div>
  )
}

/** Een rij kaarten, in het raster waarin ze straks ook staan. */
export function SkeletLijst({ aantal = 4 }: { aantal?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" role="status" aria-label="Bezig met laden">
      {Array.from({ length: aantal }, (_, i) => <SkeletKaart key={i} />)}
    </div>
  )
}

/**
 * De vorm van het dashboard: een rij tegels met daaronder twee
 * blokken naast elkaar.
 */
export function SkeletDashboard() {
  return (
    <div role="status" aria-label="Bezig met laden">
      <div className="mb-8 sm:mb-10 space-y-2">
        <Skelet className="h-8 w-64" />
        <Skelet className="h-4 w-44" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="border border-gray-100 dark:border-white/10 rounded-lg bg-white dark:bg-surface-dark-2 p-4 sm:p-6">
            <Skelet className="h-10 w-10 rounded-lg mb-3" />
            <Skelet className="h-8 w-12 mb-2" />
            <Skelet className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8">
        <div className="xl:col-span-2 border border-gray-100 dark:border-white/10 rounded-lg bg-white dark:bg-surface-dark-2 p-4 sm:p-6 space-y-3">
          <Skelet className="h-5 w-40 mb-4" />
          {Array.from({ length: 4 }, (_, i) => <Skelet key={i} className="h-12 w-full" />)}
        </div>
        <div className="border border-gray-100 dark:border-white/10 rounded-lg bg-white dark:bg-surface-dark-2 p-4 sm:p-6 space-y-3">
          <Skelet className="h-5 w-32 mb-4" />
          {Array.from({ length: 3 }, (_, i) => <Skelet key={i} className="h-10 w-full" />)}
        </div>
      </div>
    </div>
  )
}

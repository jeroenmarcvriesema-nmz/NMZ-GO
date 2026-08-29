import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { ProjectRegel } from '@/hooks/useDashboard'
import { STANDEN } from '@/lib/klusstand'
import { formatTijd, geefUren } from '@/hooks/useWerkdag'
import {
  IconPhoto, IconListCheck, IconChevronRight, IconMapPin, IconAlertTriangle, IconClock,
} from '@tabler/icons-react'

/**
 * De werkdag van vandaag op deze klus.
 *
 * De starttijd werd al berekend — hij bepaalt of een klus "achter op
 * schema" heet — maar kwam nergens op het scherm. Kantoor zag dus wél
 * dat een klus achterliep en niet sinds hoe laat er iemand aan het werk
 * was, terwijl dat precies het getal is waarmee je de vraag "hoe kan
 * dat" beantwoordt.
 *
 * Loopt er nog iemand, dan telt de tijd door en staat er een groen
 * stipje bij: dat onderscheidt "ze zijn nu bezig" van "ze zijn geweest".
 * Zonder dat verschil is 08:12 een getal zonder betekenis.
 */
function Werktijd({ regel }: { regel: ProjectRegel }) {
  if (!regel.gestartOp) return null

  const start = new Date(regel.gestartOp)
  const stop = regel.gestoptOp ? new Date(regel.gestoptOp) : null

  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/50 tabular-nums">
      {regel.looptNu
        ? <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
        : <IconClock className="w-3 h-3 flex-shrink-0" />}
      {regel.looptNu
        ? <>sinds {formatTijd(start)} · {geefUren(start, null)} u</>
        : <>{formatTijd(start)}–{formatTijd(stop)} · {geefUren(start, stop)} u</>}
    </span>
  )
}

/**
 * De stand van een klus, plus de vlag "achter op schema".
 *
 * Hier stond een eigen woordenlijst met eigen kleuren: "Gestart" in
 * plaats van "Bezig", en rood voor "Achter" terwijl rood elders in de
 * app "ligt stil" betekent. Nu komt het woord en de kleur uit
 * `lib/klusstand.ts`, net als op de werkbonnen, de planning en het
 * archief.
 *
 * "Achter" is geen stand maar een tempo-signaal en staat er daarom
 * náást — een klus kan tegelijk bezig én achter zijn, en dat is precies
 * de combinatie waar je iets mee moet.
 */
function StatusPil({ regel }: { regel: ProjectRegel }) {
  const k = STANDEN[regel.stand]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn(
        'inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-sm border',
        k.vlak, k.omlijsting, k.tekst,
      )}>
        {k.kort}
      </span>
      {regel.achter && (
        <span
          title="Al twee uur bezig en nog geen halve bon af"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-red dark:text-red-400"
        >
          <IconAlertTriangle className="w-3 h-3 flex-shrink-0" /> achter
        </span>
      )}
    </span>
  )
}

function VoortgangBalk({ value, stand }: { value: number; stand: ProjectRegel['stand'] }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={cn('flex-1 min-w-0 rounded-full h-1.5 overflow-hidden', STANDEN[stand].balkbed)}>
        <div className={cn('h-full rounded-full transition-all', STANDEN[stand].bol)} style={{ width: `${value}%` }} />
      </div>
      <span className="flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-white/50 w-9 text-right tabular-nums">
        {value}%
      </span>
    </div>
  )
}

function formatRelatief(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'Nu'
  if (diff < 60) return `${diff} min geleden`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h} uur geleden`
  return `${Math.floor(h / 24)} dagen geleden`
}

interface ProjectTabelProps {
  projecten: ProjectRegel[]
}

/**
 * Het overzicht van wat er vandaag loopt.
 *
 * Dit was één tabel, ook op een telefoon. Een tabel heeft een minimale
 * breedte die je niet kunt wegnemen zonder de kolommen onleesbaar te
 * maken, dus schoof het overzicht het scherm uit — dat is wat er buiten
 * de marges viel.
 *
 * Twee opbouwen dus: op een telefoon losse regels waarin alles onder
 * elkaar past en niets afgekapt hoeft te worden, vanaf een breed scherm
 * de tabel die daar juist prettig leest. Geen compromis waarin allebei
 * half werkt.
 */
export function ProjectTabel({ projecten }: ProjectTabelProps) {
  const navigate = useNavigate()

  return (
    <>
      {/* ── Telefoon: regels, geen tabel ── */}
      <div className="md:hidden divide-y divide-gray-50 dark:divide-white/5 -mx-1">
        {projecten.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/werkbonnen/${p.id}`)}
            className="flex items-start gap-2 w-full py-3 px-1 text-left rounded-lg hover:bg-brand-yellow-light/30 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {p.projectnaam}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-tekst-gedempt dark:text-white/55 mt-0.5 min-w-0">
                    <IconMapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{p.adres}</span>
                  </div>
                </div>
                <StatusPil regel={p} />
              </div>

              {p.team.length > 0 && (
                <div className="text-xs text-tekst-gedempt dark:text-white/55 mt-1 truncate">
                  {p.team.join(', ')}
                </div>
              )}

              <div className="mt-2">
                <VoortgangBalk value={p.voortgang} stand={p.stand} />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-tekst-gedempt dark:text-white/55">
                <span className="flex items-center gap-1">
                  <IconListCheck className="w-3 h-3 flex-shrink-0" />
                  {p.aantalTakenKlaar}/{p.aantalTaken}
                </span>
                <span className="flex items-center gap-1">
                  <IconPhoto className="w-3 h-3 flex-shrink-0" />
                  {p.aantalFotos}
                </span>
                <Werktijd regel={p} />
                <span className="truncate">{formatRelatief(p.laatsteUpdate)}</span>
              </div>
            </div>

            <IconChevronRight className="w-4 h-4 flex-shrink-0 mt-1 text-tekst-fijn dark:text-white/40" />
          </button>
        ))}
      </div>

      {/* ── Laptop: de tabel ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/10">
              <th className="text-left text-xs font-semibold text-tekst-gedempt dark:text-white/55 pb-3 pr-4">Project</th>
              <th className="text-left text-xs font-semibold text-tekst-gedempt dark:text-white/55 pb-3 pr-4">Team</th>
              <th className="text-left text-xs font-semibold text-tekst-gedempt dark:text-white/55 pb-3 pr-4">Status</th>
              <th className="text-left text-xs font-semibold text-tekst-gedempt dark:text-white/55 pb-3 pr-4 min-w-[130px]">Voortgang</th>
              <th className="text-right text-xs font-semibold text-tekst-gedempt dark:text-white/55 pb-3 hidden 2xl:table-cell">Laatste update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {projecten.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(`/werkbonnen/${p.id}`)}
                className="hover:bg-gray-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <td className="py-4 pr-4 max-w-[18rem]">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{p.projectnaam}</div>
                  <div className="text-xs text-tekst-gedempt dark:text-white/55 mt-0.5 truncate">{p.adres}</div>
                </td>
                <td className="py-4 pr-4 max-w-[12rem]">
                  <div className="flex flex-col gap-0.5">
                    {p.team.map((naam) => (
                      <span key={naam} className="text-xs text-gray-600 dark:text-white/60 truncate">{naam}</span>
                    ))}
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <StatusPil regel={p} />
                </td>
                <td className="py-4 pr-4">
                  <VoortgangBalk value={p.voortgang} stand={p.stand} />
                  <div className="hidden lg:flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-tekst-gedempt dark:text-white/55">
                      <IconListCheck className="w-3 h-3" />
                      {p.aantalTakenKlaar}/{p.aantalTaken} taken
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-tekst-gedempt dark:text-white/55">
                      <IconPhoto className="w-3 h-3" />
                      {p.aantalFotos} foto's
                    </span>
                    <Werktijd regel={p} />
                  </div>
                </td>
                <td className="py-4 text-right hidden 2xl:table-cell whitespace-nowrap">
                  <span className="text-xs text-tekst-gedempt dark:text-white/55">{formatRelatief(p.laatsteUpdate)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

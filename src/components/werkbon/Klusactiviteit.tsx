import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  IconPlayerPlay, IconPlayerStop, IconCheck, IconPhoto, IconPlayerPause,
  IconCalendarRepeat, IconUsers, IconPlus, IconTrash, IconTruck, IconCircleCheck,
  IconAlertTriangle, IconSpray,
} from '@tabler/icons-react'

/**
 * Wat er op deze klus is gebeurd, op volgorde van tijd.
 *
 * De bon zelf laat de tóéstand zien: welke punten af zijn, welke foto's
 * erbij staan. Wat hij niet laat zien is het verloop — wanneer er is
 * begonnen, in welke volgorde er is afgevinkt, en of er halverwege iets
 * is gewijzigd. Juist dat is wat je wilt weten als je 's middags kijkt
 * hoe een klus ervoor staat.
 *
 * Geen fotorapportage: de foto's zelf staan op de bon. Hier staat per
 * punt hoevéél er zijn en wanneer de laatste kwam, want dat is de
 * gebeurtenis. Twintig losse regels "foto toegevoegd" is geen
 * activiteitenfeed maar een logboek.
 *
 * Laadt pas als je een klus openklapt. Acht klussen tegelijk zou acht
 * keer vier ophaalronden betekenen voor iets wat je meestal niet
 * openslaat.
 */

interface Gebeurtenis {
  tijd: string
  soort: string
  tekst: string
  wie: string | null
}

/** Welk pictogram en welke kleur bij welke soort hoort. */
const STIJL: Record<string, { icoon: typeof IconCheck; kleur: string }> = {
  gestart:            { icoon: IconPlayerPlay,   kleur: 'text-green-600 dark:text-green-400' },
  gestopt:            { icoon: IconPlayerStop,   kleur: 'text-tekst-gedempt dark:text-white/55' },
  afgevinkt:          { icoon: IconCheck,        kleur: 'text-green-600 dark:text-green-400' },
  fotos:              { icoon: IconPhoto,        kleur: 'text-blue-600 dark:text-blue-400' },
  stilgelegd:         { icoon: IconPlayerPause,  kleur: 'text-brand-red dark:text-red-400' },
  hervat:             { icoon: IconPlayerPlay,   kleur: 'text-green-600 dark:text-green-400' },
  opgeleverd:         { icoon: IconCircleCheck,  kleur: 'text-green-600 dark:text-green-400' },
  planning_gewijzigd: { icoon: IconCalendarRepeat, kleur: 'text-tekst-gedempt dark:text-white/55' },
  ploeg_gewijzigd:    { icoon: IconUsers,        kleur: 'text-tekst-gedempt dark:text-white/55' },
  punt_toegevoegd:    { icoon: IconPlus,         kleur: 'text-tekst-gedempt dark:text-white/55' },
  punt_verwijderd:    { icoon: IconTrash,        kleur: 'text-tekst-gedempt dark:text-white/55' },
  voorziening:        { icoon: IconTruck,        kleur: 'text-tekst-gedempt dark:text-white/55' },
  // Vervolgwerk is geen stilstand (migratie 035), dus ook niet rood.
  // Blauw: er loopt nog iets, en het is bekend wát.
  vervolg_gemeld:     { icoon: IconSpray,        kleur: 'text-blue-600 dark:text-blue-400' },
  vervolg_afgerond:   { icoon: IconCheck,        kleur: 'text-green-600 dark:text-green-400' },
}

const WOORD: Record<string, string> = {
  stilgelegd: 'Stilgelegd',
  hervat: 'Hervat',
  opgeleverd: 'Opgeleverd',
  planning_gewijzigd: 'Planning gewijzigd',
  ploeg_gewijzigd: 'Ploeg gewijzigd',
  punt_toegevoegd: 'Punt toegevoegd',
  punt_verwijderd: 'Punt verwijderd',
  voorziening: 'Container/dixi',
  vervolg_gemeld: 'Vervolgwerk gemeld',
  vervolg_afgerond: 'Vervolgwerk afgerond',
}

function tijdstip(iso: string): string {
  const d = new Date(iso)
  const vandaag = new Date().toISOString().split('T')[0]
  const dag = iso.split('T')[0]
  const klok = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  if (dag === vandaag) return klok
  return `${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${klok}`
}

export function Klusactiviteit({ werkbonId }: { werkbonId: string }) {
  const [rijen, setRijen] = useState<Gebeurtenis[] | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    let levend = true

    const laden = async () => {
      const [gebRes, logRes, taakRes, fotoRes] = await Promise.all([
        supabase.from('werkbon_gebeurtenissen')
          .select('soort, reden, created_at, profiel:profiles!werkbon_gebeurtenissen_door_fkey ( naam )')
          .eq('werkbon_id', werkbonId),
        supabase.from('werkdag_logs')
          .select('start_tijd, stop_tijd, automatisch_afgesloten, medewerker:profiles ( naam )')
          .eq('werkbon_id', werkbonId),
        supabase.from('taken')
          .select('id, titel, voltooid_op')
          .eq('werkbon_id', werkbonId),
        supabase.from('fotos')
          .select('taak_id, created_at')
          .eq('werkbon_id', werkbonId),
      ])

      if (!levend) return

      const eersteFout = gebRes.error ?? logRes.error ?? taakRes.error ?? fotoRes.error
      if (eersteFout) { setFout(eersteFout.message); setRijen([]); return }

      const uit: Gebeurtenis[] = []

      for (const g of (gebRes.data ?? []) as any[]) {
        uit.push({
          tijd: g.created_at,
          soort: g.soort,
          tekst: [WOORD[g.soort] ?? g.soort, g.reden].filter(Boolean).join(' — '),
          wie: g.profiel?.naam ?? null,
        })
      }

      for (const l of (logRes.data ?? []) as any[]) {
        const naam = l.medewerker?.naam ?? 'Onbekend'
        uit.push({ tijd: l.start_tijd, soort: 'gestart', tekst: 'Werkdag gestart', wie: naam })
        if (l.stop_tijd) {
          uit.push({
            tijd: l.stop_tijd,
            soort: 'gestopt',
            tekst: l.automatisch_afgesloten
              ? 'Werkdag automatisch afgesloten'
              : 'Werkdag gestopt',
            wie: naam,
          })
        }
      }

      const taken = (taakRes.data ?? []) as any[]
      for (const t of taken) {
        // Alles van vóór migratie 034 heeft geen moment. Dat laten we
        // weg in plaats van er een tijd bij te verzinnen.
        if (t.voltooid_op) {
          uit.push({ tijd: t.voltooid_op, soort: 'afgevinkt', tekst: `Afgevinkt — ${t.titel}`, wie: null })
        }
      }

      // Foto's per punt samengevat. Twintig regels "foto toegevoegd" is
      // geen feed; "4 foto's bij Balk 12" is een gebeurtenis.
      const perTaak = new Map<string, { n: number; laatste: string }>()
      for (const f of (fotoRes.data ?? []) as any[]) {
        const huidig = perTaak.get(f.taak_id)
        perTaak.set(f.taak_id, {
          n: (huidig?.n ?? 0) + 1,
          laatste: !huidig || f.created_at > huidig.laatste ? f.created_at : huidig.laatste,
        })
      }
      for (const [taakId, info] of perTaak) {
        const titel = taken.find((t) => t.id === taakId)?.titel ?? 'een punt'
        uit.push({
          tijd: info.laatste,
          soort: 'fotos',
          tekst: `${info.n} ${info.n === 1 ? 'foto' : "foto's"} bij ${titel}`,
          wie: null,
        })
      }

      uit.sort((a, b) => b.tijd.localeCompare(a.tijd))
      setFout(null)
      setRijen(uit)
    }

    laden()
    return () => { levend = false }
  }, [werkbonId])

  if (rijen === null) {
    return <div className="flex justify-center py-4"><Spinner className="w-4 h-4" /></div>
  }

  if (fout) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-brand-red dark:text-red-400 py-2">
        <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        De activiteit kon niet worden opgehaald.
      </p>
    )
  }

  if (rijen.length === 0) {
    return (
      <p className="text-xs text-tekst-gedempt dark:text-white/55 py-2">
        Er is op deze klus nog niets gebeurd.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {rijen.slice(0, 30).map((r, n) => {
        const stijl = STIJL[r.soort] ?? { icoon: IconCheck, kleur: 'text-tekst-gedempt dark:text-white/55' }
        const Icoon = stijl.icoon
        return (
          <li key={n} className="flex items-start gap-2 text-xs min-w-0">
            <Icoon className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', stijl.kleur)} />
            <span className="min-w-0 flex-1 break-words text-gray-700 dark:text-white/70">
              {r.tekst}
              {r.wie && <span className="text-tekst-gedempt dark:text-white/55"> · {r.wie}</span>}
            </span>
            <span className="flex-shrink-0 text-tekst-gedempt dark:text-white/55 tabular-nums">
              {tijdstip(r.tijd)}
            </span>
          </li>
        )
      })}

      {rijen.length > 30 && (
        <li className="text-xs text-tekst-gedempt dark:text-white/55 pt-1">
          en {rijen.length - 30} eerder
        </li>
      )}
    </ul>
  )
}

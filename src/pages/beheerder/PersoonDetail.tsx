import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Dropdown } from '@/components/ui/Dropdown'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Weekkop } from '@/components/layout/Weekkop'
import { usePersoonDetail } from '@/hooks/usePersoonDetail'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { groepeerPerWeek } from '@/lib/planning'
import { formatDatum, rolLabel, ROL_LABEL, cn } from '@/lib/utils'
import { toast } from '@/store/toastStore'
import type { Rol } from '@/types'
import {
  IconArrowLeft, IconMapPin, IconChevronRight, IconListCheck, IconPhoto,
  IconClock, IconClipboardList, IconKey, IconMail, IconUserOff, IconUserCheck,
  IconAlertTriangle, IconBriefcase,
} from '@tabler/icons-react'

// De eigenaarsrol staat er bewust niet bij: die kan alleen een eigenaar
// toekennen, en de database weigert het van iedereen anders. Hem tonen
// zou een keuze suggereren die op een foutmelding uitloopt.
const ROL_OPTIES = (['beheerder', 'uitvoerder', 'werkvoorbereider', 'planner', 'medewerker'] as const)
  .map((r) => ({ waarde: r, label: ROL_LABEL[r] }))

/**
 * Het dossier van één man.
 *
 * De teampagina was een lijst met namen en een resetknop. Wie wilde
 * weten hoe iemand ervoor staat — hoeveel klussen lopen er, hoeveel is
 * er af, wanneer heeft hij voor het laatst gewerkt — moest dat uit de
 * werkbonnen bij elkaar zoeken.
 *
 * Wat hier staat zijn tellingen, geen scores. Wie weinig klussen heeft
 * staat niet slecht: die is net begonnen, of heeft vakantie gehad. Het
 * scherm spreekt daarom nergens een oordeel uit — dat is aan de
 * uitvoerder die de man kent.
 */
export default function PersoonDetail() {
  const { id } = useParams<{ id: string }>()
  const { dossier, loading, error, herlaad } = usePersoonDetail(id)
  const { profile, magGebruikersBeheren } = useAuth()
  const navigate = useNavigate()

  const [rolOpen, setRolOpen] = useState(false)
  const [nieuweRol, setNieuweRol] = useState<Rol>('medewerker')
  const [bezig, setBezig] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  if (loading) {
    return (
      <PageWrapper title="Medewerker">
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      </PageWrapper>
    )
  }

  if (error || !dossier) {
    return (
      <PageWrapper title="Medewerker">
        <Card>
          <ErrorState
            melding={error ?? 'Deze medewerker kon niet geladen worden.'}
            onOpnieuw={herlaad}
          />
        </Card>
      </PageWrapper>
    )
  }

  const { persoon, account, stats, bonnen } = dossier
  const zelf = account?.id === profile?.id

  const wijzigRol = async () => {
    if (!account) return
    setBezig(true)
    const { error } = await supabase
      .from('profiles').update({ rol: nieuweRol }).eq('id', account.id)
    setBezig(false)

    if (error) {
      toast.fout('Rol wijzigen mislukt: ' + error.message)
      return
    }
    setRolOpen(false)
    toast.goed(`${persoon.naam} is nu ${rolLabel(nieuweRol).toLowerCase()}.`)
    void herlaad()
  }

  const resetWachtwoord = async () => {
    if (!account?.email) return
    setBezig(true)
    const { error } = await supabase.auth.resetPasswordForEmail(account.email, {
      redirectTo: `${window.location.origin}/wachtwoord-herstellen`,
    })
    setBezig(false)

    if (error) {
      toast.fout('Herstelmail versturen mislukt: ' + error.message)
      return
    }
    setResetOpen(false)
    toast.goed(`Herstelmail verstuurd naar ${account.email}.`)
  }

  const zetActief = async (actief: boolean) => {
    setBezig(true)
    const { error } = await supabase
      .from('personen').update({ actief }).eq('id', persoon.id)
    setBezig(false)

    if (error) {
      toast.fout('Wijzigen mislukt: ' + error.message)
      return
    }
    toast.goed(actief ? `${persoon.naam} staat weer op actief.` : `${persoon.naam} staat op non-actief.`)
    void herlaad()
  }

  return (
    <PageWrapper
      title={persoon.naam}
      actions={
        <Button variant="ghost" onClick={() => navigate('/medewerkers')}>
          <IconArrowLeft className="w-4 h-4" /> Terug naar het team
        </Button>
      }
    >
      <div className="max-w-4xl space-y-6">
        {/* ── Wie is dit ── */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <Avatar naam={persoon.naam} size="lg" />

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white break-words">
                {persoon.naam}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {account
                  ? <Badge variant="green">{rolLabel(account.rol)}</Badge>
                  : <Badge variant="gray">Nog geen account</Badge>}
                {!persoon.actief && <Badge variant="red">Non-actief</Badge>}
                {persoon.clickup_label && (
                  <span className="text-xs text-tekst-gedempt dark:text-white/55">
                    ClickUp: {persoon.clickup_label}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1 text-sm text-gray-500 dark:text-white/50">
                {account?.email && (
                  <div className="flex items-center gap-2 min-w-0">
                    <IconMail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{account.email}</span>
                  </div>
                )}
                {account?.functie && (
                  <div className="flex items-center gap-2 min-w-0">
                    <IconBriefcase className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{account.functie}</span>
                  </div>
                )}
                {stats.laatsteAdres && (
                  <div className="flex items-center gap-2 min-w-0">
                    <IconMapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">
                      laatst: {stats.laatsteAdres} · {formatDatum(stats.laatsteKlusOp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!account && (
            <p className="mt-4 text-sm leading-relaxed text-tekst-gedempt dark:text-white/55">
              Deze naam staat wel in de planning maar heeft nog geen account. Klussen
              kunnen gewoon aan hem gekoppeld worden; hij ziet ze zodra hij is
              uitgenodigd via het teamoverzicht.
            </p>
          )}
        </Card>

        {/* ── Hoe staat hij ervoor ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Klussen totaal" value={stats.klussen} icon={<IconClipboardList />} />
          <KpiCard
            label="Loopt nu"
            value={stats.dezeWeek}
            icon={<IconMapPin />}
            variant={stats.dezeWeek > 0 ? 'yellow' : 'neutral'}
          />
          <KpiCard
            label="Punten afgevinkt"
            value={`${stats.puntenKlaar}/${stats.punten}`}
            icon={<IconListCheck />}
            variant="green"
          />
          <KpiCard
            label="Uren deze maand"
            value={account ? `${stats.urenDezeMaand}` : '—'}
            icon={<IconClock />}
            sub={account ? undefined : 'geen account'}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Afgerond" value={stats.afgerond} icon={<IconListCheck />} variant="green" />
          <KpiCard label="Nog open" value={stats.lopend} icon={<IconClipboardList />} />
          <KpiCard label="Foto's gemaakt" value={stats.fotos} icon={<IconPhoto />} />
          <KpiCard
            label="Voortgang"
            value={stats.punten > 0 ? `${Math.round((stats.puntenKlaar / stats.punten) * 100)}%` : '—'}
            icon={<IconListCheck />}
            variant="blue"
          />
        </div>

        {/* ── Wat kan ik met hem ── */}
        {magGebruikersBeheren && (
          <Card>
            <SectionHeading title="Beheer" />

            {zelf && (
              <div className="flex items-start gap-2 mb-4 p-3 rounded-sm bg-brand-yellow-light/50 dark:bg-brand-yellow/10 text-sm text-gray-700 dark:text-white/70">
                <IconAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-yellow-dark dark:text-brand-yellow" />
                <span className="leading-snug">
                  Dit ben jijzelf. Je eigen rol wijzigen kan niet — anders sluit je jezelf
                  buiten en is er niemand meer die het terug kan zetten.
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!account || zelf}
                onClick={() => { setNieuweRol(account?.rol ?? 'medewerker'); setRolOpen(true) }}
              >
                <IconUserCheck className="w-4 h-4" /> Rol wijzigen
              </Button>

              <Button
                variant="secondary"
                disabled={!account?.email}
                onClick={() => setResetOpen(true)}
              >
                <IconKey className="w-4 h-4" /> Wachtwoord resetten
              </Button>

              <Button
                variant="secondary"
                disabled={zelf || bezig}
                onClick={() => zetActief(!persoon.actief)}
              >
                {persoon.actief
                  ? <><IconUserOff className="w-4 h-4" /> Op non-actief</>
                  : <><IconUserCheck className="w-4 h-4" /> Weer activeren</>}
              </Button>
            </div>

            {!account && (
              <p className="mt-3 text-xs text-tekst-gedempt dark:text-white/55">
                Rol en wachtwoord kunnen pas zodra er een account is. Uitnodigen doe je
                op het teamoverzicht.
              </p>
            )}
            {!persoon.actief && (
              <p className="mt-3 text-xs text-tekst-gedempt dark:text-white/55">
                Op non-actief verdwijnt hij uit de keuzelijsten en uit de koppeling met
                ClickUp. Wat hij heeft gedaan blijft staan.
              </p>
            )}
          </Card>
        )}

        {/* ── Waar is hij geweest ── */}
        <Card>
          <SectionHeading title={`Klussen (${bonnen.length})`} />

          {bonnen.length === 0 ? (
            <EmptyState
              icon={<IconClipboardList />}
              titel="Nog geen klussen"
              uitleg="Zodra deze naam in ClickUp aan een taak hangt, verschijnen de klussen hier — ook zonder account."
            />
          ) : (
            <div className="space-y-5">
              {groepeerPerWeek(bonnen).map((blok) => (
                <div key={blok.maandag.toISOString()}>
                  <Weekkop maandag={blok.maandag} nummer={blok.nummer} aantal={blok.items.length} />
                  <div className="divide-y divide-gray-50 dark:divide-white/5 mt-1">
                    {blok.items.map(({ bon: b, begintHier }) => (
                      <button
                        key={b.id}
                        onClick={() => navigate(`/werkbonnen/${b.id}`)}
                        className="flex items-center gap-3 w-full py-3 text-left hover:bg-brand-yellow-light/30 dark:hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {b.adres}
                          </div>
                          <div className="text-xs text-tekst-gedempt dark:text-white/55 mt-0.5">
                            {!begintHier && <span className="font-semibold text-gray-500 dark:text-white/50">loopt door · </span>}
                            {formatDatum(b.geplande_start ?? b.datum)} · {b.puntenKlaar}/{b.punten} punten
                          </div>
                        </div>
                        <Badge variant={
                          b.opgeleverd_op ? 'green'
                          : b.stilgelegd_op ? 'red'
                          : b.status === 'voltooid' ? 'yellow' : 'gray'
                        }>
                          {b.opgeleverd_op ? 'Opgeleverd'
                            : b.stilgelegd_op ? 'Ligt stil'
                            : b.status === 'voltooid' ? 'Afgerond' : 'Loopt'}
                        </Badge>
                        <IconChevronRight className="w-4 h-4 flex-shrink-0 text-tekst-fijn dark:text-white/40" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Rol wijzigen ── */}
      <Modal open={rolOpen} onClose={() => setRolOpen(false)} title={`Rol van ${persoon.naam}`}>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-500 dark:text-white/50">
            De rol bepaalt wat hij ziet en mag. Dat wordt in de database afgedwongen,
            niet alleen in het scherm — een verkeerde rol geeft dus geen half werkende
            app maar een duidelijke weigering.
          </p>

          <Dropdown
            label="Nieuwe rol"
            waarde={nieuweRol}
            opties={ROL_OPTIES}
            onKies={(w) => setNieuweRol(w as Rol)}
          />

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button className="flex-1" onClick={wijzigRol} disabled={bezig || nieuweRol === account?.rol}>
              {bezig ? 'Bezig…' : 'Rol wijzigen'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setRolOpen(false)}>
              Annuleren
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Wachtwoord resetten ── */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Wachtwoord resetten">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-500 dark:text-white/50">
            Er gaat een herstelmail naar <strong className="text-gray-900 dark:text-white break-all">{account?.email}</strong>.
            Zijn huidige wachtwoord blijft werken tot hij de link gebruikt — hij wordt
            dus nergens buitengesloten.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button className="flex-1" onClick={resetWachtwoord} disabled={bezig}>
              {bezig ? 'Versturen…' : 'Verstuur herstelmail'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setResetOpen(false)}>
              Annuleren
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

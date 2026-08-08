import { useState, useEffect } from 'react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Persoon, Profile, Rol } from '@/types'

import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Dropdown } from '@/components/ui/Dropdown'
import { rolLabel, ROL_LABEL } from '@/lib/utils'
import { toast } from '@/store/toastStore'
import { IconLink, IconCopy, IconKey, IconCheck, IconUsers, IconUserPlus } from '@tabler/icons-react'

// De eigenaarsrol staat er bewust niet bij: die kan alleen een eigenaar
// toekennen, en de database weigert het van iedereen anders. Hem tonen
// zou een keuze suggereren die meestal op een foutmelding uitloopt.
const ROL_OPTIES = (['beheerder', 'uitvoerder', 'werkvoorbereider', 'medewerker'] as const)
  .map((r) => ({ waarde: r, label: ROL_LABEL[r] }))

export default function Medewerkers() {
  const { profile, magGebruikersBeheren } = useAuth()
  const [medewerkers, setMedewerkers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [uitnodigingLink, setUitnodigingLink] = useState<string | null>(null)
  const [linkModal, setLinkModal] = useState(false)
  const [gekopieerd, setGekopieerd] = useState(false)
  const [clickupLabels, setClickupLabels] = useState<string[]>([])
  // Wie staat er op het punt een reset-mail te krijgen? Zolang dit
  // gevuld is, staat de bevestiging open.
  const [resetKandidaat, setResetKandidaat] = useState<Profile | null>(null)
  const [resetBezig, setResetBezig] = useState(false)

  // De ploeg: iedereen uit het register, met of zonder account.
  const [ploeg, setPloeg] = useState<Persoon[]>([])
  const [kandidaat, setKandidaat] = useState<Persoon | null>(null)
  const [kandidaatRol, setKandidaatRol] = useState<Rol>('medewerker')
  const [uitnodigenBezig, setUitnodigenBezig] = useState(false)
  const [uitnodigingVoor, setUitnodigingVoor] = useState<Persoon | null>(null)

  useEffect(() => {
    supabase.from('profiles').select('*').order('naam')
      .then(({ data }) => { setMedewerkers((data as Profile[]) || []); setLoading(false) })

    // De namenlijst komt uit de instellingen, niet uit ClickUp zelf:
    // de browser heeft geen ClickUp-token en hoort dat ook niet te
    // krijgen. De synchronisatie ververst die lijst.
    supabase.from('clickup_instellingen').select('medewerker_labels').maybeSingle()
      .then(({ data }) => setClickupLabels(data?.medewerker_labels ?? []))

    supabase.from('personen').select('*').eq('actief', true).order('naam')
      .then(({ data }) => setPloeg((data as Persoon[]) || []))
  }, [])

  /**
   * Maakt een uitnodiging voor één persoon uit de ploeg.
   *
   * De naam en de rol zitten in de uitnodiging, niet in het
   * registratieformulier. Dat is geen gemak maar een grens: wat iemand
   * bij het aanmelden invult komt uit zijn eigen browser en is dus door
   * hemzelf te kiezen. De uitnodiging is aangemaakt door iemand die
   * gebruikers mág beheren, en dáár komt de rol vandaan.
   *
   * Gevolg voor de ontvanger: hij is meteen gekoppeld aan zijn naam en
   * ziet al het werk waar hij op stond, ook van vóór zijn account.
   */
  const nodigUit = async (persoon: Persoon, rol: Rol) => {
    setUitnodigenBezig(true)
    // crypto.randomUUID is niet te raden; Math.random wel — en dit token
    // geeft toegang tot je tenant.
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('uitnodigingen').insert({
      token,
      persoon_id: persoon.id,
      rol,
      aangemaakt_door: profile?.id,
      verloopt_op: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    setUitnodigenBezig(false)

    if (error) {
      toast.fout('De uitnodiging kon niet worden aangemaakt. Probeer het opnieuw.')
      return
    }
    setUitnodigingVoor(persoon)
    setUitnodigingLink(`${window.location.origin}/registreer?token=${token}`)
    setKandidaat(null)
    setLinkModal(true)
  }

  const kopieer = async () => {
    if (!uitnodigingLink) return
    await navigator.clipboard.writeText(uitnodigingLink)
    setGekopieerd(true)
    setTimeout(() => setGekopieerd(false), 2000)
  }

  const wijzigRol = async (id: string, rol: Rol) => {
    const vorige = medewerkers
    setMedewerkers((lijst) => lijst.map((m) => (m.id === id ? { ...m, rol } : m)))

    const { data, error } = await supabase
      .from('profiles').update({ rol }).eq('id', id).select('id')

    if (error || !data || data.length === 0) {
      setMedewerkers(vorige)
      toast.fout(error?.message ?? 'De rol kon niet worden gewijzigd.')
      return
    }
    toast.goed('Rol bijgewerkt')
  }

  /**
   * De ClickUp-naam hoort bij de persoon, niet bij het account.
   *
   * Hij stond eerst op het profiel, maar de synchronisatie koppelt op
   * personen.clickup_label — een naam moet immers op een klus kunnen
   * staan voordat er een account bij hoort. Op het profiel instellen
   * deed dus niets.
   */
  const zetClickUpNaam = async (persoonId: string, label: string) => {
    const waarde = label === '' ? null : label
    const vorige = ploeg
    setPloeg((lijst) => lijst.map((p) => (p.id === persoonId ? { ...p, clickup_label: waarde } : p)))

    const { data, error } = await supabase
      .from('personen').update({ clickup_label: waarde }).eq('id', persoonId).select('id')

    if (error || !data || data.length === 0) {
      setPloeg(vorige)
      toast.fout(error?.code === '23505'
        ? 'Die ClickUp-naam hangt al aan iemand anders in de ploeg.'
        : 'De ClickUp-naam kon niet worden opgeslagen.')
      return
    }
    toast.goed(waarde ? `Gekoppeld aan ClickUp-naam ${waarde}` : 'ClickUp-naam verwijderd')
  }

  // Een reset-mail gaat naar een echt mens en maakt zijn huidige
  // wachtwoord onbruikbaar zodra hij de link opent. Dat hoort niet te
  // gebeuren door één keer verkeerd te tikken, dus er zit een
  // bevestiging tussen — niet uit voorzichtigheid, maar omdat deze
  // actie het toestel van iemand anders raakt.
  const verstuurReset = async () => {
    const kandidaat = resetKandidaat
    if (!kandidaat?.email) return

    setResetBezig(true)
    // Zonder redirectTo landt de zwamsaneerder op de voorpagina in plaats van
    // op het scherm waar hij een nieuw wachtwoord kan kiezen.
    const { error } = await supabase.auth.resetPasswordForEmail(kandidaat.email, {
      redirectTo: `${window.location.origin}/wachtwoord-herstellen`,
    })
    setResetBezig(false)
    setResetKandidaat(null)

    if (error) toast.fout('De reset-mail kon niet worden verstuurd. Probeer het opnieuw.')
    else toast.goed(`Reset-mail verstuurd naar ${kandidaat.email}`)
  }

  return (
    <PageWrapper title="Medewerkers">
      <div className="max-w-2xl space-y-4">
        <Card>
          <SectionHeading
            title={`Accounts (${medewerkers.length})`}
            actions={<span className="text-xs text-gray-400 dark:text-white/40">Wie kan inloggen</span>}
          />
          {loading ? (
            <div className="text-center py-8 text-gray-400 dark:text-white/40">Laden…</div>
          ) : medewerkers.length === 0 ? (
            <EmptyState
              icon={<IconUsers />}
              titel="Nog geen accounts"
              uitleg="Nodig iemand uit de ploeg hieronder uit; hij is dan meteen aan zijn naam gekoppeld."
            />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {medewerkers.map((m) => (
                // Op een telefoon staan de onderdelen onder elkaar; pas
                // vanaf een breed scherm naast elkaar. De vaste
                // kolombreedtes hieronder liepen op een werktelefoon
                // gewoon uit beeld.
                <div key={m.id} className="py-4 px-2 -mx-2 rounded-lg transition-colors hover:bg-brand-yellow-light/40 dark:hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <Avatar naam={m.naam} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-gray-900 dark:text-white">{m.naam}</div>
                      <div className="text-xs text-gray-400 dark:text-white/40 truncate">
                        {m.functie || m.email || '—'}
                      </div>
                    </div>
                    <Badge variant={m.actief ? 'green' : 'red'}>{m.actief ? 'Actief' : 'Inactief'}</Badge>
                    {!(magGebruikersBeheren && m.id !== profile?.id) && (
                      <Badge variant={m.rol === 'medewerker' ? 'gray' : 'yellow'}>{rolLabel(m.rol)}</Badge>
                    )}
                  </div>

                  {magGebruikersBeheren && (
                    <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                      {m.id !== profile?.id && (
                        <Dropdown
                          ariaLabel={`Rol van ${m.naam}`}
                          className="w-full sm:w-52"
                          waarde={m.rol}
                          onKies={(v) => wijzigRol(m.id, v as Rol)}
                          opties={ROL_OPTIES}
                        />
                      )}

                      {/* Geen keuzelijst meer voor de ClickUp-naam.
                          Die zat op het profiel, maar sinds het
                          personenregister leest de synchronisatie dat
                          veld niet meer — hij koppelt op
                          personen.clickup_label. Hier iets kunnen
                          instellen wat nergens doorwerkt is erger dan
                          het weglaten: je denkt dat je iets regelt.
                          Koppelen gebeurt in De ploeg hieronder, of
                          automatisch via de uitnodiging. */}
                      <span className="text-xs text-gray-400 dark:text-white/40 self-center">
                        {(() => {
                          const persoon = ploeg.find((p) => p.profile_id === m.id)
                          if (!persoon) return 'Niet aan een naam uit de ploeg gekoppeld'
                          return persoon.clickup_label
                            ? `Ploeg: ${persoon.naam} · ClickUp "${persoon.clickup_label}"`
                            : `Ploeg: ${persoon.naam} · geen ClickUp-naam`
                        })()}
                      </span>

                      {/* Met tekst erbij en losgetrokken van de keuzelijsten:
                          een kaal grijs icoontje naast twee dropdowns is te
                          makkelijk per ongeluk te raken voor iets wat een
                          mail naar iemand anders stuurt. */}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full sm:w-auto sm:ml-auto"
                        onClick={() => setResetKandidaat(m)}
                        disabled={!m.email}
                        title={m.email ? undefined : 'Geen e-mailadres bekend'}
                      >
                        <IconKey className="w-4 h-4" /> Wachtwoord resetten
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* De ploeg staat los van de accounts, en dat verschil is de
            kern: van de tweeëndertig namen uit ClickUp heeft bijna
            niemand een account. Ze staan wél op werkbonnen. Wie je
            uitnodigt hoort dus uit deze lijst te komen, niet uit een
            leeg formulier — dan is hij meteen gekoppeld aan zijn naam
            en ziet hij al het werk waar hij op stond. */}
        <Card>
          <SectionHeading
            title={`De ploeg (${ploeg.length})`}
            actions={
              <span className="text-xs text-gray-400 dark:text-white/40">
                {ploeg.filter((p) => !p.profile_id).length} zonder account
              </span>
            }
          />
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {ploeg.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                <Avatar naam={p.naam} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate text-gray-900 dark:text-white">
                    {p.naam}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-white/40 truncate">
                    {p.koppelrol ? `${p.koppelrol}${p.pilot ? ' · pilot' : ''}` : 'ClickUp-naam'}
                  </div>
                </div>

                {magGebruikersBeheren && clickupLabels.length > 0 && (
                  <Dropdown
                    ariaLabel={`ClickUp-naam van ${p.naam}`}
                    className="w-52 flex-shrink-0"
                    waarde={p.clickup_label ?? ''}
                    onKies={(v) => zetClickUpNaam(p.id, v)}
                    opties={[
                      { waarde: '', label: 'Geen ClickUp-naam' },
                      ...clickupLabels.map((l) => ({ waarde: l, label: l })),
                    ]}
                  />
                )}

                {p.profile_id ? (
                  <Badge variant="green">Heeft account</Badge>
                ) : magGebruikersBeheren ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px] flex-shrink-0"
                    onClick={() => { setKandidaat(p); setKandidaatRol('medewerker') }}
                  >
                    <IconUserPlus className="w-4 h-4" /> Uitnodigen
                  </Button>
                ) : (
                  <Badge variant="gray">Geen account</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

      </div>

      <Modal
        open={kandidaat !== null}
        onClose={() => setKandidaat(null)}
        title={`${kandidaat?.naam} uitnodigen`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-white/60">
            {kandidaat?.naam} krijgt een link waarmee hij zelf een account aanmaakt.
            Zodra dat gelukt is, is hij gekoppeld aan zijn naam en ziet hij alle
            werkbonnen waar hij op staat — ook die van vóór zijn account.
          </p>

          <Dropdown
            label="Rol"
            waarde={kandidaatRol}
            onKies={(v) => setKandidaatRol(v as Rol)}
            opties={ROL_OPTIES}
          />
          <p className="text-xs text-gray-400 dark:text-white/40">
            De rol zit in de uitnodiging, niet in het formulier dat hij invult.
            Wat iemand bij het aanmelden intikt komt uit zijn eigen browser en
            zou hij dus zelf kunnen kiezen.
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="secondary" onClick={() => setKandidaat(null)}>Annuleren</Button>
            <Button
              variant="primary"
              loading={uitnodigenBezig}
              onClick={() => kandidaat && nodigUit(kandidaat, kandidaatRol)}
            >
              <IconLink className="w-4 h-4" /> Link aanmaken
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={resetKandidaat !== null}
        onClose={() => setResetKandidaat(null)}
        title="Wachtwoord resetten?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-white/60">
            {resetKandidaat?.naam} krijgt een mail met een link om een nieuw
            wachtwoord te kiezen. Zodra hij die link opent, werkt zijn huidige
            wachtwoord niet meer.
          </p>
          <p className="text-sm font-mono bg-surface-2 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-sm px-3 py-2 text-gray-700 dark:text-white/70 break-all">
            {resetKandidaat?.email}
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="secondary" onClick={() => setResetKandidaat(null)}>
              Annuleren
            </Button>
            <Button variant="primary" loading={resetBezig} onClick={verstuurReset}>
              Mail versturen
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={linkModal}
        onClose={() => setLinkModal(false)}
        title={uitnodigingVoor ? `Link voor ${uitnodigingVoor.naam}` : 'Uitnodigingslink'}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-sm p-3">
            <IconCheck className="w-4 h-4 flex-shrink-0" /> Link aangemaakt. Geldig 7 dagen.
          </div>
          <input readOnly value={uitnodigingLink || ''}
            className="w-full px-3 py-2.5 text-xs bg-surface-2 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-sm text-gray-600 dark:text-white/60 font-mono" />
          <Button variant="primary" fullWidth onClick={kopieer}>
            {gekopieerd ? <><IconCheck className="w-4 h-4" /> Gekopieerd!</> : <><IconCopy className="w-4 h-4" /> Kopiëren</>}
          </Button>
          <p className="text-xs text-gray-400 dark:text-white/40 text-center">
            Stuur via WhatsApp of e-mail. Deze link geldt alleen voor
            {uitnodigingVoor ? ` ${uitnodigingVoor.naam}` : ' deze persoon'} en werkt één keer.
          </p>
        </div>
      </Modal>
    </PageWrapper>
  )
}

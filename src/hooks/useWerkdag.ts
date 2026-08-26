import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/store/toastStore'
import { haalPositie, LOCATIE_AAN } from '@/lib/locatie'

// Tabel: werkdag_logs (migratie 006). Eén rij per monteur per
// werkbon per dag; start zet de rij, stop vult stop_tijd.
//
// Tot 006 leefde dit alleen in sessionStorage: het verdween bij het
// sluiten van het tabblad en de beheerder zag er niets van. Nu staat
// het in de database, en voedt het het dashboard.

export type WerkdagFase = 'voor_start' | 'actief' | 'gestopt'

export interface WerkdagState {
  fase: WerkdagFase
  startTijd: Date | null
  stopTijd: Date | null
  werkdagLogId: string | null
}

const LEEG: WerkdagState = { fase: 'voor_start', startTijd: null, stopTijd: null, werkdagLogId: null }

function vandaag(): string {
  return new Date().toISOString().split('T')[0]
}

function naarState(rij: { id: string; start_tijd: string; stop_tijd: string | null }): WerkdagState {
  return {
    fase: rij.stop_tijd ? 'gestopt' : 'actief',
    startTijd: new Date(rij.start_tijd),
    stopTijd: rij.stop_tijd ? new Date(rij.stop_tijd) : null,
    werkdagLogId: rij.id,
  }
}

export function useWerkdag(werkbonId: string | null) {
  const { profile } = useAuth()
  const [state, setState] = useState<WerkdagState>(LEEG)
  const [loading, setLoading] = useState(true)
  const [bezig, setBezig] = useState(false)

  // Herstellen bij het openen van het scherm. Dit is wat sessionStorage
  // deed, maar nu over apparaten heen: begint een monteur op zijn
  // telefoon, dan ziet hij dat ook terug na een herstart.
  useEffect(() => {
    let afgebroken = false

    const herstel = async () => {
      if (!profile || !werkbonId) { setState(LEEG); setLoading(false); return }
      setLoading(true)

      const { data, error } = await supabase
        .from('werkdag_logs')
        .select('id, start_tijd, stop_tijd')
        .eq('medewerker_id', profile.id)
        .eq('werkbon_id', werkbonId)
        .eq('datum', vandaag())
        .maybeSingle()

      if (afgebroken) return
      setState(error || !data ? LEEG : naarState(data))
      setLoading(false)
    }

    herstel()
    return () => { afgebroken = true }
  }, [profile?.id, werkbonId])

  /**
   * Vastleggen waar iemand stond bij het aanmelden.
   *
   * Losgekoppeld en zonder await: het aanmelden is op dat moment al
   * gelukt en mag nergens meer op wachten. Een telefoon die twintig
   * seconden over zijn positie doet, of er helemaal niet uitkomt, hoort
   * niemand tegen te houden — dat is de hele afspraak (migratie 040).
   *
   * Geen `.select()` achter de insert. De ploeg mag hier schrijven maar
   * niet lezen: de afstand is voor kantoor. Met een select erachter zou
   * de policy de hele insert afkeuren.
   */
  const legLocatieVast = (werkdagLogId: string) => {
    if (!LOCATIE_AAN) return
    if (!profile?.id || !profile?.tenant_id || !werkbonId) return

    void haalPositie().then(async (pos) => {
      if (!pos) return
      await supabase.from('werkdag_locaties').insert({
        tenant_id: profile.tenant_id,
        werkdag_log_id: werkdagLogId,
        werkbon_id: werkbonId,
        medewerker_id: profile.id,
        latitude: pos.lat,
        longitude: pos.lon,
        nauwkeurigheid_m: pos.nauwkeurigheid,
      })
    }).catch(() => {
      // Stil. Dit is een signaal voor kantoor, geen onderdeel van het
      // werk van de monteur; een foutmelding hierover zou hem alleen
      // laten denken dat zijn aanmelding niet is gelukt.
    })
  }

  const startWerkdag = async () => {
    if (!profile || !werkbonId || bezig) return
    setBezig(true)

    // Upsert op de unieke sleutel: twee keer op "start" drukken mag
    // nooit een tweede rij of een nieuwe starttijd opleveren.
    const { data, error } = await supabase
      .from('werkdag_logs')
      .upsert(
        { medewerker_id: profile.id, werkbon_id: werkbonId, datum: vandaag() },
        { onConflict: 'medewerker_id,werkbon_id,datum', ignoreDuplicates: true }
      )
      .select('id, start_tijd, stop_tijd')
      .maybeSingle()

    setBezig(false)

    if (error) {
      toast.fout('Starten lukte niet. Controleer je verbinding en probeer het opnieuw.')
      return
    }

    // ignoreDuplicates geeft niets terug als de rij er al was —
    // dan is de werkdag al gestart en halen we de bestaande op.
    if (data) {
      setState(naarState(data))
      legLocatieVast(data.id)
      return
    }

    const { data: bestaand } = await supabase
      .from('werkdag_logs')
      .select('id, start_tijd, stop_tijd')
      .eq('medewerker_id', profile.id)
      .eq('werkbon_id', werkbonId)
      .eq('datum', vandaag())
      .maybeSingle()

    if (bestaand) setState(naarState(bestaand))
  }

  const stopWerkdag = async () => {
    if (!state.werkdagLogId || bezig) return
    setBezig(true)

    const nu = new Date()
    // De vlag mee terugzetten: dit is een echte afmelding, ook als de
    // nachtronde de dag eerder al op 17:00 had dichtgezet (migratie
    // 031). Blijft hij staan, dan noemt de administratie later een
    // opgeschreven tijd een aanname.
    const { data, error } = await supabase
      .from('werkdag_logs')
      .update({ stop_tijd: nu.toISOString(), automatisch_afgesloten: false })
      .eq('id', state.werkdagLogId)
      .select('id')

    setBezig(false)

    if (error || !data || data.length === 0) {
      toast.fout('Stoppen lukte niet. Controleer je verbinding en probeer het opnieuw.')
      return
    }

    setState((s) => ({ ...s, fase: 'gestopt', stopTijd: nu }))
  }

  /**
   * Werkdag weer oppakken.
   *
   * Stoppen was eenrichtingsverkeer: wie te vroeg op stop drukte — en
   * dat gebeurt, met een telefoon in een werkhandschoen — kwam nergens
   * meer. Geen bon, geen punten, geen weg terug. De uren staan al vast
   * in de log, dus terugdraaien kost niets; wat telt is dat je verder
   * kunt.
   */
  const hervatWerkdag = async () => {
    if (!state.werkdagLogId || bezig) return
    setBezig(true)

    const { data, error } = await supabase
      .from('werkdag_logs')
      .update({ stop_tijd: null, automatisch_afgesloten: false })
      .eq('id', state.werkdagLogId)
      .select('id')

    setBezig(false)

    if (error || !data || data.length === 0) {
      toast.fout('Hervatten lukte niet. Controleer je verbinding en probeer het opnieuw.')
      return
    }

    setState((s) => ({ ...s, fase: 'actief', stopTijd: null }))
  }

  return { state, loading, bezig, startWerkdag, stopWerkdag, hervatWerkdag }
}

export function formatTijd(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export function geefUren(start: Date | null, stop: Date | null): string {
  if (!start) return '0:00'
  const eind = stop ?? new Date()
  const ms = eind.getTime() - start.getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}:${String(m).padStart(2, '0')}`
}

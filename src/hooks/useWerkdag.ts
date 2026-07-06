import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

// ── Werkdag state ──────────────────────────────────────────────
// Supabase koppeling (later):
//   - Tabel: werkdag_logs (id, medewerker_id, werkbon_id, start_tijd, stop_tijd, datum)
//   - START: INSERT INTO werkdag_logs (medewerker_id, werkbon_id, start_tijd, datum)
//   - STOP:  UPDATE werkdag_logs SET stop_tijd = now() WHERE id = ?
//   - Herstellen: SELECT * FROM werkdag_logs WHERE medewerker_id = ? AND datum = today

export type WerkdagFase = 'voor_start' | 'actief' | 'gestopt'

export interface WerkdagState {
  fase: WerkdagFase
  startTijd: Date | null
  stopTijd: Date | null
  werkdagLogId: string | null
}

const STORAGE_KEY = 'nmzgo_werkdag'

export function useWerkdag(werkbonId: string | null) {
  const { profile } = useAuth()

  const herstelState = (): WerkdagState => {
    try {
      const opgeslagen = sessionStorage.getItem(STORAGE_KEY)
      if (opgeslagen) {
        const parsed = JSON.parse(opgeslagen)
        if (parsed.werkbonId === werkbonId) {
          return {
            fase: parsed.fase,
            startTijd: parsed.startTijd ? new Date(parsed.startTijd) : null,
            stopTijd: parsed.stopTijd ? new Date(parsed.stopTijd) : null,
            werkdagLogId: parsed.werkdagLogId,
          }
        }
      }
    } catch {}
    return { fase: 'voor_start', startTijd: null, stopTijd: null, werkdagLogId: null }
  }

  const [state, setState] = useState<WerkdagState>(herstelState)

  const slaOp = (s: WerkdagState) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, werkbonId }))
    setState(s)
  }

  const startWerkdag = async () => {
    const nu = new Date()
    // TODO: INSERT INTO werkdag_logs via Supabase
    // const { data } = await supabase.from('werkdag_logs').insert({
    //   medewerker_id: profile?.id,
    //   werkbon_id: werkbonId,
    //   start_tijd: nu.toISOString(),
    //   datum: nu.toISOString().split('T')[0],
    // }).select().single()
    slaOp({ fase: 'actief', startTijd: nu, stopTijd: null, werkdagLogId: 'mock-id' })
  }

  const stopWerkdag = async () => {
    const nu = new Date()
    // TODO: UPDATE werkdag_logs SET stop_tijd = nu WHERE id = state.werkdagLogId
    // await supabase.from('werkdag_logs').update({ stop_tijd: nu.toISOString() })
    //   .eq('id', state.werkdagLogId)
    slaOp({ ...state, fase: 'gestopt', stopTijd: nu })
  }

  return { state, startWerkdag, stopWerkdag }
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

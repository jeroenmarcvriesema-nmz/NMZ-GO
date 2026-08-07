import { create } from 'zustand'

export type ToastSoort = 'goed' | 'fout' | 'info'

export interface Toast {
  id: number
  soort: ToastSoort
  tekst: string
}

interface ToastState {
  toasts: Toast[]
  toon: (tekst: string, soort?: ToastSoort) => void
  sluit: (id: number) => void
}

// Zelfde patroon als themeStore: één kleine store per zorg, geen
// nieuw state-systeem ernaast. Bewust niet gepersisteerd — een melding
// hoort bij het moment, niet bij de sessie.
let volgendeId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  toon: (tekst, soort = 'info') => {
    const id = volgendeId++
    set((s) => ({ toasts: [...s.toasts, { id, soort, tekst }] }))
    // Een fout blijft langer staan: die moet gelezen kunnen worden,
    // ook door iemand die net zijn telefoon uit zijn zak haalt.
    const duur = soort === 'fout' ? 7000 : 4000
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duur)
  },

  sluit: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Korte hand voor gebruik buiten componenten. */
export const toast = {
  goed: (tekst: string) => useToastStore.getState().toon(tekst, 'goed'),
  fout: (tekst: string) => useToastStore.getState().toon(tekst, 'fout'),
  info: (tekst: string) => useToastStore.getState().toon(tekst, 'info'),
}

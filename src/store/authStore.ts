import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  error: string | null
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  loading: true,
  error: null,

  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  /**
   * Het profiel ophalen — maar niet elke keer het scherm leegmaken.
   *
   * Dit zette `loading` altijd op waar, en `AuthGuard` vervangt de hele
   * app door een laadscherm zolang dat aan staat. Elke aanroep haalde
   * dus de complete boom weg en bouwde hem opnieuw op.
   *
   * Dat is precies wat er op een telefoon gebeurt bij het maken van een
   * foto. De camera brengt de browser naar de achtergrond; kom je terug,
   * dan controleert Supabase de sessie en vuurt `SIGNED_IN` af. App.tsx
   * roept dan `fetchProfile()` aan — en je hele scherm knippert weg,
   * inclusief de werkbon, je plek in de lijst en de zojuist opgehaalde
   * foto's. Dat zag eruit als een refresh omdat het er feitelijk een was.
   *
   * Kennen we de gebruiker al, dan is dit achtergrondwerk en hoort het
   * scherm te blijven staan.
   */
  fetchProfile: async (userId: string) => {
    const bestaand = get().profile
    const alBekend = bestaand?.id === userId
    if (!alBekend) set({ loading: true, error: null })

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Profiel bestaat niet — automatisch aanmaken
        if (error.code === 'PGRST116') {
          const { data: userData } = await supabase.auth.getUser()
          if (userData?.user) {
            const naam =
              userData.user.user_metadata?.naam ||
              userData.user.user_metadata?.name ||
              userData.user.email?.split('@')[0] ||
              'Gebruiker'

            const { data: nieuw, error: insertErr } = await supabase
              .from('profiles')
              .insert({ id: userId, naam, rol: 'medewerker' })
              .select()
              .single()

            if (!insertErr && nieuw) {
              set({ profile: nieuw as Profile, loading: false, error: null })
              return
            }
            console.error('[Auth] Profiel aanmaken mislukt:', insertErr?.message)
          }
        }

        // Ging het mis terwijl we de gebruiker al kenden, dan is dit een
        // hapering en geen afmelding. Het profiel weggooien zou iemand
        // midden op een klus uit de app zetten omdat het net even geen
        // bereik had.
        if (alBekend) { set({ loading: false }); return }

        set({
          profile: null,
          loading: false,
          error: 'Profiel laden mislukt. Probeer opnieuw in te loggen.',
        })
        return
      }

      if (!data) {
        if (alBekend) { set({ loading: false }); return }
        set({ profile: null, loading: false, error: 'Geen profiel gevonden.' })
        return
      }

      set({ profile: data as Profile, loading: false, error: null })
    } catch (err) {
      console.error('[Auth] Onverwachte fout:', err)
      if (alBekend) { set({ loading: false }); return }
      set({
        profile: null,
        loading: false,
        error: 'Verbindingsfout. Controleer je internetverbinding.',
      })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ profile: null, loading: false, error: null })
  },
}))

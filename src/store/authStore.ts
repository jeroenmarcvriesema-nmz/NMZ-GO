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

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  loading: true,
  error: null,

  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchProfile: async (userId: string) => {
    set({ loading: true, error: null })

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

        set({
          profile: null,
          loading: false,
          error: 'Profiel laden mislukt. Probeer opnieuw in te loggen.',
        })
        return
      }

      if (!data) {
        set({ profile: null, loading: false, error: 'Geen profiel gevonden.' })
        return
      }

      set({ profile: data as Profile, loading: false, error: null })
    } catch (err) {
      console.error('[Auth] Onverwachte fout:', err)
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

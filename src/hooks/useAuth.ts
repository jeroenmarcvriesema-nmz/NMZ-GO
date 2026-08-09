import { useAuthStore } from '@/store/authStore'
import { magWerkBeheren, magGebruikersBeheren } from '@/lib/rollen'

// Leest uitsluitend uit de global Zustand store.
// Auth initialisatie gebeurt eenmalig in <AuthInitializer> (App.tsx).
//
// De rollijsten zelf staan in lib/rollen.ts. Ze stonden hier én in
// App.tsx, en dat liep uit de pas: de mobiele balk toonde "Team" aan
// een uitvoerder terwijl die route dicht zat.

export function useAuth() {
  const { profile, loading, error, signOut } = useAuthStore()
  const rol = profile?.rol

  return {
    profile,
    loading,
    error,
    signOut,

    /** Wachtwoorden resetten, uitnodigen, rollen toekennen. */
    magGebruikersBeheren: magGebruikersBeheren(rol),

    /** Werkbonnen maken en wijzigen, alles inzien, zoeken, plannen. */
    magWerkBeheren: magWerkBeheren(rol),

    isEigenaar: rol === 'eigenaar',
  }
}

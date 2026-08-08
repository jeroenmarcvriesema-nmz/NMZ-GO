import { useAuthStore } from '@/store/authStore'
import type { Rol } from '@/types'

// Leest uitsluitend uit de global Zustand store.
// Auth initialisatie gebeurt eenmalig in <AuthInitializer> (App.tsx).

// Deze twee lijsten zijn de tegenhanger van mag_gebruikers_beheren() en
// mag_werk_beheren() in de database (migratie 008). Ze bepalen wat je
// te zíen krijgt; de database bepaalt wat je mág. Raken ze uit de pas,
// dan is het gevolg een knop die een foutmelding geeft — vervelend,
// maar niet onveilig. Andersom kan niet.
const GEBRUIKERSBEHEER: Rol[] = ['eigenaar', 'beheerder']
const WERKBEHEER: Rol[] = ['eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider']

export function useAuth() {
  const { profile, loading, error, signOut } = useAuthStore()
  const rol = profile?.rol

  return {
    profile,
    loading,
    error,
    signOut,

    /** Wachtwoorden resetten, uitnodigen, rollen toekennen. */
    magGebruikersBeheren: !!rol && GEBRUIKERSBEHEER.includes(rol),

    /** Werkbonnen maken en wijzigen, alles inzien, zoeken, plannen. */
    magWerkBeheren: !!rol && WERKBEHEER.includes(rol),

    isEigenaar: rol === 'eigenaar',
  }
}

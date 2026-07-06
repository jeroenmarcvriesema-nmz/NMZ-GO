import { useAuthStore } from '@/store/authStore'

// Leest uitsluitend uit de global Zustand store.
// Auth initialisatie gebeurt eenmalig in <AuthInitializer> (App.tsx).
export function useAuth() {
  const { profile, loading, error, signOut } = useAuthStore()
  return {
    profile,
    loading,
    error,
    signOut,
    isBeheerder: profile?.rol === 'beheerder',
  }
}

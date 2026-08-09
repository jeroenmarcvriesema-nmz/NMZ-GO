import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // De schermen worden al apart geladen (React.lazy in App.tsx).
        // Wat overblijft is de bibliotheekcode, en die zat in hetzelfde
        // brok als de app zelf — dan haalt de browser bij elke uitrol
        // alles opnieuw op, ook wat niet veranderd is. Uit elkaar
        // getrokken blijven deze drie in de cache staan zolang de
        // versie niet wijzigt, en dat is bijna altijd.
        //
        // De iconenbibliotheek staat er los bij omdat die het grootst
        // is en het minst verandert.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          iconen: ['@tabler/icons-react'],
        },
      },
    },
    // De drempel stond op 500 kB en werd overschreden; nu is er niets
    // meer dat daar in de buurt komt en hoort een waarschuwing weer een
    // waarschuwing te zijn.
    chunkSizeWarningLimit: 600,
  },
})

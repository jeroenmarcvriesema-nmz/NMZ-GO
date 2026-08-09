import { defineConfig } from 'vitest/config'
import path from 'path'

// Aparte configuratie zodat vite.config.ts blijft waar hij over gaat:
// het bouwen van de app. De tests draaien in Node — er zit bewust geen
// enkele test in die een browser nodig heeft. Wat hier getest wordt is
// pure logica: het ontleden van een werkopdracht en het rekenen met
// planningsdatums. Dat zijn de twee plekken waar aantoonbaar fouten
// zaten, en het zijn precies de plekken die zonder browser te toetsen
// zijn.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // De schermen praten met Supabase en zijn hier niet aan de beurt;
    // die staan in het handmatige testplan.
    exclude: ['node_modules', 'dist'],
  },
})

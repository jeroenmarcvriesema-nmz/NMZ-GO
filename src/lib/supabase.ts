import { createClient } from '@supabase/supabase-js'

// De URL en de sleutel gaan als HTTP-header mee bij elk verzoek.
// Headers accepteren alleen gewone ASCII-tekens. Sluipt er bij het
// kopiëren een onzichtbaar teken mee — een zero-width space, een
// gekruld aanhalingsteken, een hard spatie — dan weigert de browser
// het verzoek met "String contains non ISO-8859-1 code point", en
// lijkt het alsof inloggen kapot is.
//
// Dat is precies één keer gebeurd bij het instellen van de
// omgevingsvariabelen in Netlify. Daarom schonen we hier op in plaats
// van erop te vertrouwen dat het plakken goed gaat.
function schoon(waarde: string | undefined): string {
  if (!waarde) return ''
  // Alles buiten het bereik van leesbare ASCII eruit, plus spaties
  // aan de randen. Een URL en een JWT bestaan uitsluitend uit deze
  // tekens, dus er gaat nooit iets geldigs verloren.
  return waarde.replace(/[^\x20-\x7E]/g, '').trim()
}

const ruweUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ruweKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const supabaseUrl = schoon(ruweUrl)
const supabaseAnonKey = schoon(ruweKey)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY zijn vereist. ' +
    'Lokaal: zet ze in .env.local. In productie: in de omgevingsvariabelen van Netlify.'
  )
}

// Wel gevuld, maar er moest iets uit: dan klopt de waarde in de
// omgeving niet en is dat het eerste om te controleren.
if (ruweUrl !== supabaseUrl || ruweKey !== supabaseAnonKey) {
  console.warn(
    '[Supabase] Er stonden ongeldige tekens in VITE_SUPABASE_URL of ' +
    'VITE_SUPABASE_ANON_KEY; die zijn verwijderd. Controleer de waarde ' +
    'in Netlify — waarschijnlijk is er bij het plakken iets meegekomen.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

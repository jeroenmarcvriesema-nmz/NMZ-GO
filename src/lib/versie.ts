// ============================================================
// NMZ GO — een nieuwe versie mag niemand omvergooien
// ============================================================
// Elk scherm wordt apart ingeladen (zie de lazy-imports in App.tsx).
// Die bestanden dragen een hash in hun naam, en bij een nieuwe uitrol
// krijgen ze een nieuwe hash. Een telefoon die de app al uren
// openstaan heeft, vraagt dan om een bestand dat niet meer bestaat —
// en door de SPA-redirect in netlify.toml krijgt hij geen 404 terug
// maar `index.html`. De browser meldt dat als:
//
//   'text/html' is not a valid JavaScript MIME type
//   Failed to fetch dynamically imported module: .../assets/Planning-*.js
//
// Dat is precies wat er op 12 augustus acht keer gebeurde, bij twee
// gebruikers, op een dag met drie uitrollen. Voor kantoor is dat een
// vervelend moment; voor iemand op een dak met werkhandschoenen aan is
// het het einde van zijn werkdag.
//
// Het is geen crash maar een verouderde pagina. De oplossing is dus
// niet "melden en sorry zeggen" maar herladen — één keer, en met een
// slot erop, want een herlaadlus is erger dan de fout zelf.
// ============================================================

const PATRONEN = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /is not a valid javascript mime type/i,
  /chunkloaderror/i,
  /unable to preload css/i,
]

/** Is dit een verouderde pagina na een uitrol, en geen echte fout? */
export function isVersiefout(fout: unknown): boolean {
  const tekst =
    fout instanceof Error ? `${fout.name} ${fout.message}`
    : typeof fout === 'string' ? fout
    : ''
  if (!tekst) return false
  return PATRONEN.some((p) => p.test(tekst))
}

/**
 * Een scherm inladen, en een leeg antwoord herkennen als wat het is.
 *
 * `lazy(() => import(...))` gaat er vanuit dat de import een module
 * oplevert. Als het chunkbestand er niet meer is levert hij soms geen
 * afwijzing op maar `undefined`, en dan struikelt React er zelf over
 * bij het uitpakken van de lading:
 *
 *   Cannot read properties of undefined (reading 'default')
 *   undefined is not an object (evaluating 'e._result.default')
 *
 * Dat is dezelfde verouderde pagina als hierboven, maar met een
 * boodschap waar `isVersiefout` niets in herkent. Gevolg: geen
 * herlaadpoging maar het rode "dit scherm liep vast" — dertig keer in
 * veertien dagen, waarvan veertien op het Vandaag-scherm van de ploeg.
 * Een monteur in een kruipruimte krijgt dan een storingsmelding voor
 * iets wat één herlading is.
 *
 * Hier wordt het lege antwoord daarom omgezet in een boodschap die de
 * vanger hierboven wél herkent, zodat hij zijn gewone weg loopt:
 * eenmalig herladen, en anders het scherm met de knop.
 */
export function scherm<T extends { default: unknown }>(
  laad: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    const module = await laad()
    if (!module || typeof (module as { default?: unknown }).default === 'undefined') {
      throw new Error(
        'Failed to fetch dynamically imported module: het scherm kwam leeg binnen',
      )
    }
    return module
  }
}

// Eén sleutel in sessionStorage, want dit hoort bij dit tabblad en niet
// bij het toestel: een tweede tabblad heeft zijn eigen verhaal.
const SLEUTEL = 'nmzgo:versie-herladen'

/** Hoe lang na een poging we een tweede niet meer vertrouwen. */
const SLOT_MS = 60_000

/**
 * Herlaadt de pagina, maar hoogstens één keer per minuut.
 *
 * Zonder dat slot is een fout die na het herladen terugkomt — een
 * kapotte uitrol, een cache die blijft hangen — een oneindige lus die
 * de telefoon leegtrekt en waar de gebruiker niet meer uitkomt.
 *
 * Geeft terug of er daadwerkelijk herladen wordt. Zo niet, dan hoort de
 * gebruiker een scherm met een knop te krijgen: dan beslist hij zelf,
 * en dat is beter dan een pagina die uit zichzelf blijft springen.
 */
export function herlaadVoorNieuweVersie(): boolean {
  try {
    const vorige = Number(sessionStorage.getItem(SLEUTEL) ?? '0')
    if (Date.now() - vorige < SLOT_MS) return false
    sessionStorage.setItem(SLEUTEL, String(Date.now()))
  } catch {
    // Privémodus of geblokkeerde opslag: dan liever niet automatisch
    // herladen dan het risico op een lus.
    return false
  }

  window.location.reload()
  return true
}

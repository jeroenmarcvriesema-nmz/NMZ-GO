// ============================================================
// NMZ GO — waaróm een foto niet aankwam
// ============================================================
// Elke mislukte upload gaf dezelfde zin: "De foto kon niet worden
// opgeslagen. Probeer het opnieuw." Dat klopt zelden. Er zijn drie
// verschillende dingen aan de hand, met drie verschillende
// vervolgstappen:
//
//   - geen bereik in een kruipruimte → straks opnieuw proberen, en
//     vooral: de foto niet opnieuw hoeven maken;
//   - de sessie is verlopen omdat de telefoon een halve dag sliep →
//     opnieuw inloggen, anders blijft het mislukken hoe vaak je ook
//     drukt;
//   - er ging echt iets mis aan de serverkant → melden aan kantoor.
//
// Wie het verschil niet ziet, drukt tien keer op dezelfde knop en gaat
// naar huis met foto's die nergens staan.
//
// Pure functie zonder netwerk of Supabase, zodat een test alle takken
// kan aflopen — dit is precies het soort code dat je niet wilt
// uitproberen door een telefoon in een kruipruimte te houden.
// ============================================================

export type Uploadprobleem = 'offline' | 'sessie' | 'server'

export interface Uploadfout {
  soort: Uploadprobleem
  /** Wat er op het scherm komt. Eén zin over wat er is, één over wat je nu doet. */
  tekst: string
  /** Heeft opnieuw proberen zin zonder dat er eerst iets anders gebeurt? */
  opnieuw: boolean
}

// Een weggevallen verbinding komt in veel gedaanten terug, afhankelijk
// van de browser. Dit zijn de vormen die wij in het veld tegenkomen.
const VERBINDING = /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|aborted/i

// Alles wat erop wijst dat de app niet meer als ingelogde gebruiker
// praat. Row level security weigert dan; dat leest als een serverfout
// maar is het niet.
const SESSIE = /jwt|token|unauthorized|not authenticated|401|403|row-level security|violates row-level/i

/**
 * Duidt een mislukte upload.
 *
 * `online` en `heeftSessie` komen van de aanroeper (navigator.onLine en
 * de sessie van Supabase), zodat deze functie zelf niets hoeft te weten
 * van de buitenwereld.
 */
export function duidUploadfout(
  boodschap: string | null | undefined,
  online: boolean,
  heeftSessie: boolean,
): Uploadfout {
  if (!online) {
    return {
      soort: 'offline',
      tekst: 'Je hebt even geen verbinding. De foto is nog niet verstuurd — ' +
             'probeer het zodra je weer bereik hebt. Opnieuw fotograferen hoeft niet.',
      opnieuw: true,
    }
  }

  const tekst = boodschap ?? ''

  // De sessie eerst: zonder geldige sessie weigert de opslag, en dat
  // levert een boodschap op die ook op een netwerkfout kan lijken.
  if (!heeftSessie || SESSIE.test(tekst)) {
    return {
      soort: 'sessie',
      tekst: 'Je bent tussendoor uitgelogd — dat gebeurt als de app lang op de ' +
             'achtergrond staat. Laad de app opnieuw en log in; daarna kun je de ' +
             'foto alsnog versturen.',
      opnieuw: false,
    }
  }

  if (VERBINDING.test(tekst)) {
    return {
      soort: 'offline',
      tekst: 'De verbinding viel weg tijdens het versturen. De foto staat nog klaar — ' +
             'probeer het opnieuw.',
      opnieuw: true,
    }
  }

  return {
    soort: 'server',
    tekst: 'De foto kon niet worden opgeslagen. Probeer het opnieuw; blijft het ' +
           'misgaan, geef het dan door aan kantoor.',
    opnieuw: true,
  }
}

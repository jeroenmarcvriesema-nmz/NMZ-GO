// ============================================================
// NMZ GO — Edge Function: opdracht-lezen
// ============================================================
// Eén werkopdracht-PDF in, de punten eruit.
//
// Waarom dit een edge function is en geen code in de browser: het
// lezen van een PDF vraagt een leeslaag van een megabyte, en die
// bestaat hier al. De ClickUp-route haalt dezelfde opdrachten al jaren
// door `werkopdracht.ts` en `ontleden.ts` heen. Kantoor dat een bon met
// de hand aanmaakt hoort exact dezelfde punten te krijgen als dezelfde
// opdracht via ClickUp binnengekomen zou zijn — dus dezelfde parser,
// niet een tweede die er ongeveer op lijkt.
//
// Deze functie schrijft niets weg. Hij leest een PDF en geeft terug wat
// erin staat; wat daarmee gebeurt beslist het scherm. Dat scheelt een
// halve werkbon in de database als iemand halverwege van gedachten
// verandert.
//
// Geen service-role: de functie werkt met het token van de gebruiker
// die hem aanroept, dus RLS geldt onverkort. Wie geen werk mag beheren
// komt hier niet voorbij de deur.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { leesPdf, ontleed } from '../verwerker/werkopdracht.ts'

// Tegenhanger van WERKBEHEER in src/lib/rollen.ts en van
// mag_werk_beheren() in de database (migratie 008). Drie plekken, maar
// de database is en blijft degene die het écht tegenhoudt: de query op
// clickup_instellingen hieronder valt zonder die rol vanzelf leeg.
const WERKBEHEER = ['eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner']

// Gelijk aan de limiet van de bucket werkbon-documenten (migratie 012).
const MAX_BYTES = 25 * 1024 * 1024

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ fout: 'Alleen POST.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return json({ fout: 'SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt' }, 500)

  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization) return json({ fout: 'Niet ingelogd.' }, 401)

  // Het token van de aanroeper, niet de service-role-sleutel. Alles wat
  // deze client leest, leest hij als die gebruiker.
  const db = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const { data: gebruiker } = await db.auth.getUser()
  if (!gebruiker?.user) return json({ fout: 'Niet ingelogd.' }, 401)

  const { data: profiel } = await db
    .from('profiles')
    .select('rol')
    .eq('id', gebruiker.user.id)
    .maybeSingle()

  if (!profiel || !WERKBEHEER.includes(profiel.rol)) {
    return json({ fout: 'Je mag geen werkbonnen aanmaken.' }, 403)
  }

  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.length === 0) return json({ fout: 'Er kwam geen bestand mee.' }, 400)
  if (bytes.length > MAX_BYTES) {
    return json({ fout: 'Het bestand is groter dan 25 MB.' }, 413)
  }

  let tekst: string
  try {
    tekst = await leesPdf(bytes)
  } catch (e) {
    // Een foto van een opdracht, een beveiligde PDF, een scan zonder
    // tekstlaag: allemaal geldige bestanden waar geen letter uit komt.
    // Dat is geen storing, dus het scherm hoort er iets zinnigs over te
    // kunnen zeggen.
    return json({
      fout: 'Deze PDF is niet te lezen. Staat er alleen een scan of foto in, ' +
            'dan zit er geen tekst in het bestand en moeten de punten met de hand.',
      details: e instanceof Error ? e.message : String(e),
    }, 422)
  }

  const regels = tekst.split('\n').map((r) => r.trim()).filter(Boolean)
  if (regels.length === 0) {
    return json({
      fout: 'Deze PDF bevat geen tekst — waarschijnlijk een scan. De punten moeten met de hand.',
    }, 422)
  }

  // Dezelfde uitsluitingen als de ClickUp-route: parkeerkosten en
  // brandstoftoeslag zijn regels op een factuur, geen werk om af te
  // vinken. Geen instellingen gevonden? Dan sluiten we niets uit —
  // liever een punt te veel op het scherm dan er stilletjes een weg.
  const { data: instellingen } = await db
    .from('clickup_instellingen')
    .select('uitgesloten_punten')
    .maybeSingle()
  const uitgesloten: string[] = instellingen?.uitgesloten_punten ?? []

  try {
    const w = ontleed(tekst, uitgesloten)
    return json({
      sjabloon: true,
      punten: w.punten,
      weggelaten: w.weggelaten,
      werkvoorbereiding: w.werkvoorbereiding,
      opdrachtnummer: w.opdrachtnummer,
      adres: w.adres,
      inspecteur: w.inspecteur,
      inspecteurTelefoon: w.inspecteurTelefoon,
      kluiscode: w.kluiscode,
    }, 200)
  } catch (e) {
    // Geen NMZ-werkopdracht, of een die van het sjabloon afwijkt. De
    // ruwe regels gaan mee terug: het scherm probeert er dan zelf
    // opsommingstekens uit te halen, net als bij geplakte tekst. Dat is
    // de terugval, niet het antwoord — vandaar `sjabloon: false`.
    return json({
      sjabloon: false,
      reden: e instanceof Error ? e.message : String(e),
      regels,
    }, 200)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ============================================================
// NMZ GO — Edge Function: ploeg-bijwerken
// ============================================================
// De namenlijst uit ClickUp ophalen en het personenregister aanvullen.
//
// Waarom dit een eigen ingang heeft en niet alleen in de
// synchronisatieronde zit: die ronde draait elke vijf minuten en pikt
// de keuzelijst op van een taak die hij toch al ophaalt (zie
// register.ts). Prima voor het gewone geval — maar niet als er iemand
// naast je staat die vanmiddag ingepland moet worden, en niet in een
// week zonder klussen, want dan komt er geen taak langs om de lijst
// van af te lezen. Deze functie vraagt de veldenlijst rechtstreeks op.
//
// Over de rechten: de service-role wordt hier voor precies één ding
// gebruikt, het ClickUp-token uit Vault — dat is de enige weg erheen en
// hij is niet voor gewone gebruikers. Alles wat daarna gelezen en
// geschreven wordt gaat door de client van de aanroeper zelf, dus RLS
// bepaalt wat mag: kantoor mag de ploeg beheren, een zwamsaneerder niet.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { haalOpties, werkRegisterBij } from '../verwerker/register.ts'

// Tegenhanger van GEBRUIKERSBEHEER in src/lib/rollen.ts. De labellijst
// in clickup_instellingen mag alleen door gebruikersbeheer bijgewerkt
// worden (migratie 010) — een rol lager loopt hier dus vast op RLS, en
// dan is een nette melding beter dan een onbegrijpelijke fout.
const GEBRUIKERSBEHEER = ['eigenaar', 'beheerder']

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
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) {
    return json({ fout: 'SUPABASE_URL, SUPABASE_ANON_KEY of SUPABASE_SERVICE_ROLE_KEY ontbreekt' }, 500)
  }

  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization) return json({ fout: 'Niet ingelogd.' }, 401)

  const db = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const { data: gebruiker } = await db.auth.getUser()
  if (!gebruiker?.user) return json({ fout: 'Niet ingelogd.' }, 401)

  const { data: profiel } = await db
    .from('profiles')
    .select('rol, tenant_id')
    .eq('id', gebruiker.user.id)
    .maybeSingle()

  if (!profiel || !GEBRUIKERSBEHEER.includes(profiel.rol)) {
    return json({ fout: 'Alleen een beheerder kan de ploeg bijwerken.' }, 403)
  }

  const { data: inst, error: instFout } = await db
    .from('clickup_instellingen')
    .select('lijst_ids, veld_medewerkers, medewerker_labels')
    .eq('tenant_id', profiel.tenant_id)
    .maybeSingle()

  if (instFout) return json({ fout: `Instellingen lezen mislukt: ${instFout.message}` }, 500)
  if (!inst) return json({ fout: 'Er zijn geen ClickUp-instellingen voor dit bedrijf.' }, 400)
  if (!inst.veld_medewerkers) {
    return json({ fout: 'Er is geen ClickUp-veld voor medewerkers ingesteld.' }, 400)
  }

  try {
    const dienst = createClient(url, service, { auth: { persistSession: false } })
    const { data: token, error: tokenFout } = await dienst.rpc('geef_clickup_token')
    if (tokenFout) throw new Error(`ClickUp-token lezen mislukt: ${tokenFout.message}`)
    if (!token) throw new Error('Er staat geen clickup_token in Vault.')

    const opties = await haalOpties(inst.lijst_ids ?? [], inst.veld_medewerkers, token as string)
    if (opties.length === 0) {
      return json({
        fout: 'ClickUp gaf geen namen terug voor het medewerkersveld. ' +
              'Controleer of het juiste veld is ingesteld.',
      }, 422)
    }

    const uitkomst = await werkRegisterBij(
      db, profiel.tenant_id, opties, inst.medewerker_labels ?? [],
    )
    return json(uitkomst, 200)
  } catch (e) {
    return json({ fout: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

-- 025 — Opleverrapportages
--
-- Een opleverrapport gaat naar de opdrachtgever. Het is het enige
-- document dat NMZ GO naar buiten stuurt, en daarmee het enige waar een
-- fout niet intern blijft.
--
-- Twee regels bepalen wie er een mag maken en wanneer. Allebei staan ze
-- hier en niet in het scherm:
--
--   1. Uitvoerder of hoger. Een zwamsaneerder maakt geen rapport — dat
--      wordt pas opgemaakt als kantoor heeft vastgesteld dát het goed
--      is, en dat oordeel is niet aan degene die het werk deed.
--
--   2. Minstens één foto. Het document bestáát grotendeels uit de
--      fotorapportage; zonder foto's is het een lege huls met een
--      briefhoofd. Een rapport dat suggereert dat er bewijs is terwijl
--      dat er niet is, is erger dan geen rapport.
--
-- Een knop verbergen is geen regel. Wie het REST-eindpunt kent komt om
-- het scherm heen, en juist bij een document dat de deur uit gaat wil je
-- dat de database nee zegt.

-- ── De tabel ────────────────────────────────────────────────
create table if not exists public.rapportages (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete restrict,
  werkbon_id          uuid not null references public.werkbonnen(id) on delete cascade,

  -- 'wachtend' zolang de Edge Function hem nog moet bouwen, daarna
  -- 'klaar' of 'mislukt'. Geen enum: een status erbij hoort geen
  -- migratie te vereisen op het moment dat het misgaat.
  status              text not null default 'wachtend',
  bestandspad         text,
  fout                text,

  aangevraagd_op      timestamptz not null default now(),
  aangevraagd_door    uuid references public.profiles(id) on delete set null,
  gegenereerd_op      timestamptz,

  -- Wanneer hij naar ClickUp is gegaan. Gevuld betekent: niet opnieuw
  -- sturen. Dat is de hele duplicaatpreventie — een stempel is
  -- betrouwbaarder dan onthouden of je het al gedaan hebt.
  clickup_geupload_op timestamptz
);

comment on table public.rapportages is
  'Opleverrapporten per werkbon. Alleen aan te maken door uitvoerder of hoger, en alleen als er minstens een foto is.';

create index if not exists rapportages_werkbon_idx on public.rapportages (werkbon_id, aangevraagd_op desc);
create index if not exists rapportages_tenant_idx  on public.rapportages (tenant_id, aangevraagd_op desc);

alter table public.rapportages enable row level security;

-- Lezen mag iedereen die bij de werkbon mag. Een zwamsaneerder mag het
-- rapport van zijn eigen klus dus wél zien — hij mag het alleen niet
-- laten maken.
drop policy if exists rapportages_select on public.rapportages;
create policy rapportages_select on public.rapportages
  for select to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_bij_werkbon(werkbon_id));

-- Aanmaken gaat uitsluitend via rapportage_aanvragen(). Geen
-- insert-policy: dan kan niemand de twee regels omzeilen door
-- rechtstreeks een rij te schrijven.
drop policy if exists rapportages_update_kantoor on public.rapportages;
create policy rapportages_update_kantoor on public.rapportages
  for update to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren())
  with check (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren());

drop policy if exists rapportages_delete_kantoor on public.rapportages;
create policy rapportages_delete_kantoor on public.rapportages
  for delete to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren());


-- ── De drie tekstvelden ─────────────────────────────────────
-- Het sjabloon heeft ruimte voor opmerkingen, bijzonderheden en extra
-- uitgevoerde werkzaamheden. Migratie 002 legde er vier aan plus een
-- veld voor opmerkingen van bewoners; die blijven staan maar worden
-- niet gebruikt. Ze weggooien zou gegevens vernietigen voor een
-- opruiming die niets oplevert.
comment on column public.werkbonnen.opmerkingen_bewoners is
  'Opmerkingen vanuit de bewoners over voorbereiding en uitvoering. Komt op het opleverrapport.';
comment on column public.werkbonnen.extra_werkzaamheden is
  'Werk dat afweek van de opdracht. Komt op het opleverrapport.';
comment on column public.werkbonnen.bijzonderheden is
  'Vrije opmerkingen bij de oplevering. Komt op het opleverrapport.';

-- Het projectnummer op het rapport (bijv. "C515") is een naam die
-- kantoor met de hand invult bij een groot project. Bij een losse klus
-- blijft hij leeg en staat alleen het adres op het rapport.
comment on column public.werkbonnen.opdrachtnummer is
  'Projectnummer van de opdrachtgever, met de hand ingevuld bij grote projecten. Leeg bij losse klussen.';


-- ── De poortwachter ─────────────────────────────────────────
create or replace function public.rapportage_aanvragen(p_werkbon uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_tenant  uuid := public.get_mijn_tenant();
  v_fotos   integer;
  v_bestaat uuid;
  v_id      uuid;
begin
  -- Regel 1: uitvoerder of hoger.
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan een opleverrapport maken'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.werkbonnen
     where id = p_werkbon and tenant_id = v_tenant
  ) then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  -- Regel 2: minstens één foto.
  select count(*) into v_fotos
    from public.fotos
   where werkbon_id = p_werkbon and tenant_id = v_tenant;

  if v_fotos = 0 then
    raise exception 'Er staat nog geen foto bij deze klus; zonder fotorapportage is het rapport leeg'
      using errcode = '23514';
  end if;

  -- Loopt er al een aanvraag, dan geven we die terug in plaats van een
  -- tweede te maken. Twee keer drukken hoort geen twee rapporten op te
  -- leveren die allebei naar ClickUp gaan.
  select id into v_bestaat
    from public.rapportages
   where werkbon_id = p_werkbon and status in ('wachtend', 'klaar')
   order by aangevraagd_op desc
   limit 1;

  if v_bestaat is not null then
    return jsonb_build_object('rapportage_id', v_bestaat, 'nieuw', false);
  end if;

  insert into public.rapportages (tenant_id, werkbon_id, aangevraagd_door)
  values (v_tenant, p_werkbon, auth.uid())
  returning id into v_id;

  -- Via de wachtrij, net als de ClickUp-terugkoppeling: het bouwen van
  -- een PDF met foto's duurt te lang om iemand op te laten wachten, en
  -- een storing hoort de aanvraag niet weg te gooien.
  perform public.taak_aanmaken(
    'rapportage.genereren',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'rapportage_id', v_id)
  );

  return jsonb_build_object('rapportage_id', v_id, 'nieuw', true, 'fotos', v_fotos);
end;
$fn$;

revoke execute on function public.rapportage_aanvragen(uuid) from public, anon;
grant  execute on function public.rapportage_aanvragen(uuid) to authenticated;

comment on function public.rapportage_aanvragen(uuid) is
  'Vraagt een opleverrapport aan. Weigert zonder bevoegdheid (42501) en zonder foto (23514). Idempotent: een lopende aanvraag wordt teruggegeven.';

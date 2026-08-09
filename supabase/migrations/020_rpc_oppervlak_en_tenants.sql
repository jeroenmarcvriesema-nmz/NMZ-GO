-- 020 — Het RPC-oppervlak opschonen en tenants een expliciete policy geven
--
-- Uit de audit kwamen drie dingen die geen van alle uit te buiten waren,
-- maar wel op stilzwijgende aannames leunden. Een aanname die je niet
-- opschrijft, breekt een keer zonder dat iemand het merkt.
--
--   1. Elke functie in `public` is standaard aanroepbaar door PUBLIC, en
--      dus door `anon`. Dat gold ook voor triggerfuncties en voor de drie
--      werkbon-acties. Postgres weigert een triggerfunctie buiten een
--      trigger en de werkbon-acties toetsen intern op bevoegdheid, dus er
--      was geen gat — maar "er is geen gat omdat Postgres toevallig nee
--      zegt" is geen beveiliging. Wat niet bereikbaar hoeft te zijn, gaat
--      dicht.
--
--   2. `public.tenants` had RLS aan zonder één policy. Dat is effectief
--      dicht voor iedereen, wat nu werkt omdat alles via SECURITY DEFINER
--      loopt. Zodra iemand ooit rechtstreeks een tenant uitleest, krijgt
--      hij een lege lijst in plaats van een fout, en dan zoek je lang.
--      Een expliciete policy zegt wat de bedoeling is.
--
--   3. `taak_opnieuw()` toetste nog op de rolnáám 'beheerder'. Dat is
--      dezelfde fout die eerder in `mag_bij_werkbon()` zat: de eigenaar
--      viel erbuiten. Alles hoort op bevoegdheid te toetsen.
--
-- Bewust níet dichtgezet: `get_mijn_rol()`, `get_mijn_tenant()` en
-- `uitnodiging_controleren()` blijven voor `anon` bereikbaar. De eerste
-- twee worden aangeroepen vanuit RLS-policies, die draaien in de rol van
-- de aanroeper; ze intrekken laat een uitgelogde bezoeker een fout zien
-- in plaats van een lege lijst. De derde is de kern van het
-- uitnodigingsscherm, dat per definitie niet ingelogd bezocht wordt.

-- ── 1. Triggerfuncties zijn geen endpoints ──
--
-- Deze functies worden aangeroepen door een trigger, nooit door een
-- gebruiker. Postgres toetst EXECUTE op een triggerfunctie bij CREATE
-- TRIGGER, niet bij elke keer dat hij afgaat, dus dit intrekken raakt de
-- werking niet.

revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()        from public, anon, authenticated;
revoke execute on function public.sync_profiel_email()     from public, anon, authenticated;
revoke execute on function public.guard_persoon_kolommen() from public, anon, authenticated;
revoke execute on function public.update_updated_at()      from public, anon, authenticated;

-- ── 2. De werkbon-acties zijn voor ingelogde mensen ──
--
-- Ze weigeren een anonieme aanroep al met 42501, want `mag_werk_beheren()`
-- is dan onwaar. Maar een uitgelogde bezoeker hoort er niet eens tegenaan
-- te kunnen praten.

revoke execute on function public.werkbon_stilleggen(uuid, text) from public, anon;
revoke execute on function public.werkbon_hervatten(uuid)        from public, anon;
revoke execute on function public.werkbon_opleveren(uuid)        from public, anon;
grant  execute on function public.werkbon_stilleggen(uuid, text) to authenticated;
grant  execute on function public.werkbon_hervatten(uuid)        to authenticated;
grant  execute on function public.werkbon_opleveren(uuid)        to authenticated;

-- Twee hulpfuncties die over jóuw eigen koppeling gaan. Ze lekken niets,
-- maar voor `anon` is het antwoord altijd leeg — dan hoeft de deur niet
-- open te staan.
revoke execute on function public.ben_ik_toegewezen(uuid) from public, anon;
revoke execute on function public.mijn_persoon_id()       from public, anon;
grant  execute on function public.ben_ik_toegewezen(uuid) to authenticated;
grant  execute on function public.mijn_persoon_id()       to authenticated;

-- ── 3. tenants krijgt een expliciete policy ──
--
-- Lezen mag, en alleen je eigen tenant. Schrijven doet niemand vanuit de
-- app: een tenant aanmaken is een beheerhandeling die via de
-- service-sleutel loopt. Geen insert-, update- of delete-policy is dus
-- geen omissie maar het antwoord.

drop policy if exists tenants_select_eigen on public.tenants;
create policy tenants_select_eigen on public.tenants
  for select to authenticated
  using (id = public.get_mijn_tenant());

comment on table public.tenants is
  'Eén rij per bedrijf. Alleen leesbaar voor wie erbij hoort; aanmaken loopt buiten de app om.';

-- ── 4. taak_opnieuw() toetst op bevoegdheid in plaats van rolnaam ──

create or replace function public.taak_opnieuw(taak_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  -- Was: get_mijn_rol() <> 'beheerder'. Daarmee kon de eigenaar — de
  -- enige die er in de praktijk naar kijkt — een vastgelopen taak niet
  -- opnieuw aanbieden.
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger mag een taak opnieuw aanbieden'
      using errcode = '42501';
  end if;

  update public.verwerkingstaken
     set status = 'wachtend', pogingen = 0, fout = null,
         beschikbaar_vanaf = now(), geclaimd_op = null, afgerond_op = null
   where id = taak_id
     and tenant_id = public.get_mijn_tenant()
     and status in ('mislukt', 'onverwerkbaar');
end;
$fn$;

revoke execute on function public.taak_opnieuw(uuid) from public, anon;
grant  execute on function public.taak_opnieuw(uuid) to authenticated;

-- ── 5. clickup_hartslag() krijgt dezelfde poortwachter als taak_aanmaken ──
--
-- Hij stond open voor élke ingelogde gebruiker, ook een zwamsaneerder,
-- en toetste zelf niets. De schade bleef beperkt doordat er nooit twee
-- ronden tegelijk klaarstaan, maar het hoort dicht. Tegelijk moet
-- kantoor hem juist wél kunnen aanroepen — daar komt de handmatige
-- syncknop op uit — en pg_cron draait zonder ingelogde gebruiker.
-- Vandaar dezelfde vorm als `taak_aanmaken`: geen `auth.uid()` betekent
-- achtergrondwerk en mag door, een ingelogde gebruiker moet bevoegd zijn.

create or replace function public.clickup_hartslag()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_tenant record;
  v_aantal integer := 0;
begin
  if auth.uid() is not null and not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan een synchronisatie starten'
      using errcode = '42501';
  end if;

  for v_tenant in
    select tenant_id from public.clickup_instellingen where actief
  loop
    -- Ligt er al een ronde te wachten of loopt er een, dan slaan we
    -- deze over. Zonder dit stapelen de taken op zodra ClickUp traag is.
    if exists (
      select 1 from public.verwerkingstaken
      where soort = 'clickup.synchroniseren'
        and tenant_id = v_tenant.tenant_id
        and status not in ('geslaagd', 'mislukt', 'onverwerkbaar')
    ) then
      continue;
    end if;

    perform public.taak_aanmaken(
      'clickup.synchroniseren',
      jsonb_build_object('tenant_id', v_tenant.tenant_id)
    );
    v_aantal := v_aantal + 1;
  end loop;

  return v_aantal;
end;
$fn$;

comment on function public.clickup_hartslag() is
  'Zet per actieve tenant één synchronisatieronde klaar, tenzij er al een openstaat. Draait elke vijf minuten via pg_cron en is daarnaast met de hand te starten door kantoor.';

revoke execute on function public.clickup_hartslag() from public, anon;
grant  execute on function public.clickup_hartslag() to authenticated, service_role;

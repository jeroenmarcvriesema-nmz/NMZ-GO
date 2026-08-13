-- 033 — Bijhouden of een container of dixi besteld en afgemeld is
--
-- Het overzicht op het dashboard leest uit de werkopdracht wát er nodig
-- is. Wat er niet in staat is wat er al gedáán is: wie de container
-- heeft besteld, en wanneer hij is afgemeld. Zonder dat blijft het een
-- lijst die elke ochtend opnieuw doorgelopen moet worden, en dan belt
-- de een de verhuurder voor de tweede keer terwijl de ander denkt dat
-- het al geregeld was.
--
-- Een eigen tabeltje en geen vier kolommen op `werkbonnen`. Twee
-- redenen: een container en een dixi zijn twee losse bestellingen met
-- elk hun eigen moment, en er komt hoogstwaarschijnlijk ooit een derde
-- soort bij (steiger, kraan). Dat is dan een rij, geen migratie.
--
-- Afmelden mag altijd, ook vóór de opleverdatum. Een klus die op dag
-- twee van de vijf al leeg is hoeft de container niet nog drie dagen
-- te houden — dat is precies de huur die je wilt besparen.

create table if not exists public.werkbon_voorzieningen (
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  werkbon_id    uuid not null references public.werkbonnen(id) on delete cascade,
  -- 'container' of 'dixi'. Bewust tekst met een check en geen enum:
  -- een soort erbij is dan een regel in de check en niet een migratie
  -- op een type waar rijen aan hangen.
  soort         text not null check (soort in ('container', 'dixi')),

  besteld_op    timestamptz,
  besteld_door  uuid references auth.users(id) on delete set null,
  afgemeld_op   timestamptz,
  afgemeld_door uuid references auth.users(id) on delete set null,

  primary key (werkbon_id, soort)
);

create index if not exists werkbon_voorzieningen_tenant_idx
  on public.werkbon_voorzieningen (tenant_id);

alter table public.werkbon_voorzieningen enable row level security;

-- Alleen kantoor. Een zwamsaneerder bestelt geen containers en heeft
-- hier niets te zoeken; het overzicht staat op het kantoordashboard.
drop policy if exists werkbon_voorzieningen_select on public.werkbon_voorzieningen;
create policy werkbon_voorzieningen_select on public.werkbon_voorzieningen
  for select using (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren());

-- Schrijven gaat via de RPC hieronder, niet rechtstreeks: daar zit de
-- controle dat de werkbon bij je eigen tenant hoort.
drop policy if exists werkbon_voorzieningen_schrijf on public.werkbon_voorzieningen;

/**
 * Een stempel zetten of weghalen.
 *
 * `p_wat` is 'besteld' of 'afgemeld', `p_aan` zet hem of haalt hem weg.
 * Weghalen moet kunnen: iemand tikt de verkeerde regel aan, en dan is
 * een vinkje dat er niet meer af kan erger dan geen vinkje.
 *
 * Er zit bewust géén voorwaarde op dat afmelden pas ná bestellen mag.
 * Een container kan buiten de app om zijn geregeld, en dan is de
 * bestelling van iemand anders geweest — dat blokkeren zou betekenen
 * dat je een leugentje moet invullen om verder te komen.
 */
create or replace function public.voorziening_stempelen(
  p_werkbon uuid,
  p_soort   text,
  p_wat     text,
  p_aan     boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_nu     timestamptz := case when p_aan then now() else null end;
  v_wie    uuid := case when p_aan then auth.uid() else null end;
  v_rij    public.werkbon_voorzieningen%rowtype;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen kantoor houdt containers en dixi''s bij'
      using errcode = '42501';
  end if;

  if p_soort not in ('container', 'dixi') then
    raise exception 'Onbekende soort: %', p_soort using errcode = '22023';
  end if;

  if p_wat not in ('besteld', 'afgemeld') then
    raise exception 'Onbekend stempel: %', p_wat using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.werkbonnen
     where id = p_werkbon and tenant_id = v_tenant
  ) then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  insert into public.werkbon_voorzieningen (tenant_id, werkbon_id, soort)
  values (v_tenant, p_werkbon, p_soort)
  on conflict (werkbon_id, soort) do nothing;

  if p_wat = 'besteld' then
    update public.werkbon_voorzieningen
       set besteld_op = v_nu, besteld_door = v_wie
     where werkbon_id = p_werkbon and soort = p_soort;
  else
    update public.werkbon_voorzieningen
       set afgemeld_op = v_nu, afgemeld_door = v_wie
     where werkbon_id = p_werkbon and soort = p_soort;
  end if;

  select * into v_rij from public.werkbon_voorzieningen
   where werkbon_id = p_werkbon and soort = p_soort;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'voorziening',
          p_soort || ' ' || (case when p_aan then p_wat else 'niet meer ' || p_wat end),
          auth.uid());

  return jsonb_build_object(
    'soort', v_rij.soort,
    'besteld_op', v_rij.besteld_op,
    'afgemeld_op', v_rij.afgemeld_op);
end;
$$;

revoke all on function public.voorziening_stempelen(uuid, text, text, boolean) from public, anon;
grant execute on function public.voorziening_stempelen(uuid, text, text, boolean) to authenticated;

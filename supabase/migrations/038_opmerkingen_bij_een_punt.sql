-- 038 — Opmerkingen bij een uit te voeren punt
--
-- Tot nu toe is het verkeer in de app één kant op gegaan. Kantoor plant
-- en de ploeg voert uit; de ploeg vinkt af en zet er foto's bij, en
-- kantoor kijkt ernaar. Wie op zo'n foto iets ziet — goed of fout —
-- moest bellen of appen, en dat verdween vervolgens uit het dossier.
--
-- Dit is de terugweg. Een opmerking hangt aan één punt, want daar gaat
-- hij over: "deze balk zit er mooi in" of "hier mis ik nog een foto van
-- de kopse kant". Aan de bon hangen zou hem laten zweven boven twintig
-- punten waarvan er één bedoeld werd.
--
-- ── Twee richtingen, bewust ──
-- Ook de ploeg mag schrijven. De vraag was of kantoor iets kwijt kan bij
-- een punt, maar een opmerking waar niet op geantwoord kan worden is een
-- mededeling. "Kruipluik zat vast, vandaar de omweg" hoort in hetzelfde
-- draadje als de vraag die hem uitlokte.
--
-- ── Wie krijgt er bericht ──
-- Iedereen die op de klus staat, plús iedereen die eerder bij dit punt
-- iets heeft geschreven. Dat tweede is de reden dat kantoor het antwoord
-- ook hoort: wie een vraag stelt bij een punt staat zelf niet op de bon,
-- en zou anders nooit merken dat er iemand reageerde.
--
-- De schrijver zelf krijgt niets. Een melding over je eigen tekst is
-- ruis, en ruis is precies hoe een meldingenklok zijn gezag verliest.

create table if not exists public.punt_opmerkingen (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  taak_id     uuid not null references public.taken(id) on delete cascade,

  -- Ook op de opmerking, en niet alleen via de taak. De policies en het
  -- meldingenverkeer hebben de bon nodig, en die telkens via een join
  -- ophalen maakt elke regel duurder en elke policy langer.
  werkbon_id  uuid not null references public.werkbonnen(id) on delete cascade,

  auteur_id   uuid references public.profiles(id) on delete set null,
  tekst       text not null,
  created_at  timestamptz not null default now(),

  constraint punt_opmerkingen_tekst_check
    check (length(btrim(tekst)) between 1 and 2000)
);

comment on table public.punt_opmerkingen is
  'Opmerkingen bij een afvinkpunt. Twee richtingen: kantoor en ploeg schrijven in hetzelfde draadje.';

create index if not exists punt_opmerkingen_taak_idx
  on public.punt_opmerkingen (taak_id, created_at);
create index if not exists punt_opmerkingen_werkbon_idx
  on public.punt_opmerkingen (werkbon_id, created_at desc);

alter table public.punt_opmerkingen enable row level security;

-- Lezen en schrijven mag iedereen die bij de werkbon mag. Dat is
-- dezelfde grens als voor de foto's: wie de klus mag zien, mag het
-- gesprek erover zien.
drop policy if exists punt_opmerkingen_select on public.punt_opmerkingen;
create policy punt_opmerkingen_select on public.punt_opmerkingen
  for select to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_bij_werkbon(werkbon_id));

drop policy if exists punt_opmerkingen_insert on public.punt_opmerkingen;
create policy punt_opmerkingen_insert on public.punt_opmerkingen
  for insert to authenticated
  with check (
    tenant_id = public.get_mijn_tenant()
    and public.mag_bij_werkbon(werkbon_id)
    and auteur_id = auth.uid()
  );

-- Weghalen mag alleen je eigen tekst, of een beheerder. Er is bewust
-- geen wijzigen: een draadje waarin een zin achteraf iets anders is
-- gaan betekenen, is geen dossier meer. Fout getypt? Weghalen en
-- opnieuw.
drop policy if exists punt_opmerkingen_delete on public.punt_opmerkingen;
create policy punt_opmerkingen_delete on public.punt_opmerkingen
  for delete to authenticated
  using (
    tenant_id = public.get_mijn_tenant()
    and (auteur_id = auth.uid() or public.mag_gebruikers_beheren())
  );


-- ── De melding eromheen ─────────────────────────────────────
create or replace function public.meld_punt_opmerking()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_naam   text;
  v_adres  text;
  v_punt   text;
begin
  select naam into v_naam from public.profiles where id = new.auteur_id;
  select adres into v_adres from public.werkbonnen where id = new.werkbon_id;
  select titel into v_punt from public.taken where id = new.taak_id;

  insert into public.meldingen (tenant_id, voor_profile_id, soort, tekst, werkbon_id)
  select
    new.tenant_id,
    ontvanger,
    'punt_opmerking',
    coalesce(v_naam, 'Iemand') || ' schreef bij "' ||
      -- De punttitel is vaak een hele zin uit de werkopdracht. In een
      -- meldingenlijst hoort daar een herkenbaar begin van te staan en
      -- niet de hele alinea.
      left(coalesce(v_punt, 'een punt'), 60) ||
      case when length(coalesce(v_punt, '')) > 60 then '…' else '' end ||
      '" op ' || coalesce(v_adres, 'een klus') || ': ' ||
      left(new.tekst, 120) ||
      case when length(new.tekst) > 120 then '…' else '' end,
    new.werkbon_id
  from (
    -- Iedereen die op de klus staat.
    select pe.profile_id as ontvanger
      from public.werkbon_medewerkers wm
      join public.personen pe on pe.id = wm.persoon_id
     where wm.werkbon_id = new.werkbon_id
       and pe.profile_id is not null

    union

    -- En iedereen die eerder bij dit punt iets schreef.
    select o.auteur_id
      from public.punt_opmerkingen o
     where o.taak_id = new.taak_id
       and o.auteur_id is not null
  ) as iedereen
  where ontvanger is distinct from new.auteur_id;

  return new;
end;
$$;

drop trigger if exists meld_punt_opmerking on public.punt_opmerkingen;
create trigger meld_punt_opmerking
  after insert on public.punt_opmerkingen
  for each row execute function public.meld_punt_opmerking();

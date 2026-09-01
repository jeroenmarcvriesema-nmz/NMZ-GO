-- ============================================================
-- NMZ GO — Migratie 045: het veiligheidsblad als eerste punt
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Op elke klus hoort het rode gevarenblad op de voordeur en/of het
-- raam. Dat is geen punt uit de werkopdracht — het staat in geen
-- enkele ClickUp-taak — maar het moet wel op elke bon staan, en het
-- moet als eerste gebeuren. Wie binnen aan het werk is met middelen
-- die gevaar opleveren, hoort dat aan de buitenkant kenbaar te maken
-- vóórdat hij begint, niet als hij klaar is.
--
-- Vier dingen om dat waar te maken:
--
--   1. `taken.standaard` — dit punt is er door de app bij gezet en
--      niet door de opdracht. Op een vlag en niet op de titel
--      vergelijken: een tekst die ooit anders wordt geschreven maakt
--      elke regel eronder stil onwaar.
--   2. Een trigger op `werkbonnen`, zodat het op élke bon staat: uit
--      ClickUp, met de hand aangemaakt, of wat er later ook bij komt.
--      Op drie plekken dezelfde regel overtypen is precies hoe een
--      vierde plek hem niet krijgt.
--   3. `volgorde = -1`. De punten uit de opdracht beginnen bij 0 en
--      elk scherm sorteert oplopend, dus dit punt staat bovenaan
--      zonder dat er ergens een uitzondering in de sortering hoeft.
--   4. Een trigger op `taken` die weigert dat er een ánder punt wordt
--      afgevinkt zolang dit openstaat. In het scherm staat het ook,
--      met uitleg — maar afvinken gaat via een gewone update op de
--      tabel, dus daar hoort het slot te zitten.
--
-- Bewust géén nieuwe soort in `werkbon_gebeurtenissen`: dit punt
-- gedraagt zich verder als elk ander punt, en de check-constraint uit
-- 039 hoeft er niet voor te groeien.
--
-- Over het bijvullen achteraf: alleen bonnen die nog lopen. Een klus
-- die al is afgerond of opgeleverd krijgt er niets bij — een open punt
-- op een gesloten dossier zou de bon terugzetten naar "bezig", het
-- rapport tegenspreken en op de planning opnieuw als werk verschijnen.
-- Wat gedaan is, is gedaan.
-- ============================================================

begin;

-- ── A. WELK PUNT DIT IS ──────────────────────────────────────

alter table public.taken
  add column if not exists standaard boolean not null default false;

comment on column public.taken.standaard is
  'Door NMZ GO zelf toegevoegd en niet afkomstig uit de werkopdracht. Staat vooraan, is niet te verwijderen, en houdt de andere punten tegen tot het af is.';

create index if not exists taken_standaard_open_idx
  on public.taken (werkbon_id) where standaard and not voltooid;

-- De tekst op één plek. De trigger en het bijvullen hieronder lezen
-- allebei hier, zodat ze niet uit elkaar kunnen lopen.
create or replace function public.standaardpunt_titel()
  returns text language sql immutable
as $$ select 'Het plakken van het rode gevaren veiligheidsblad op de voordeur en/of raam'::text $$;


-- ── B. OP ELKE NIEUWE BON ────────────────────────────────────

create or replace function public.werkbon_standaardpunt()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.taken
    (tenant_id, werkbon_id, titel, omschrijving, volgorde, foto_vereist, standaard)
  values
    (new.tenant_id, new.id, public.standaardpunt_titel(),
     'Maak een foto van het blad zoals het hangt. Dit punt moet af voordat je aan de rest begint.',
     -1, true, true);
  return new;
end;
$$;

drop trigger if exists werkbonnen_standaardpunt on public.werkbonnen;
create trigger werkbonnen_standaardpunt
  after insert on public.werkbonnen
  for each row execute function public.werkbon_standaardpunt();


-- ── C. EERST DIT, DAN DE REST ────────────────────────────────
-- Afvinken is een gewone update op `taken`; er zit geen functie
-- tussen waar dit in kon. Vandaar een trigger, en die kijkt zo nauw
-- mogelijk: alleen naar het moment waarop een gewoon punt van niet-af
-- naar af gaat.
--
-- Wat er daardoor níet door geraakt wordt: uitvinken en heropenen door
-- kantoor, de fotoplicht wisselen, het standaardpunt zelf, en elke bon
-- die geen standaardpunt heeft — dat laatste is wat de afgeronde
-- klussen van vóór deze migratie met rust laat.

create or replace function public.taken_standaardpunt_eerst()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.standaard or old.voltooid or not new.voltooid then
    return new;
  end if;

  if exists (
    select 1 from public.taken t
     where t.werkbon_id = new.werkbon_id
       and t.standaard
       and not t.voltooid
  ) then
    raise exception 'Vink eerst het veiligheidsblad af: %', public.standaardpunt_titel()
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists taken_standaardpunt_eerst on public.taken;
create trigger taken_standaardpunt_eerst
  before update on public.taken
  for each row execute function public.taken_standaardpunt_eerst();


-- ── D. HET STANDAARDPUNT BLIJFT STAAN ────────────────────────
-- Zonder dit is de regel hierboven één knop van kantoor verwijderd van
-- niets: haal het punt weg en het slot is weg. Verder ongewijzigd ten
-- opzichte van migratie 032.

create or replace function public.werkbon_punt_verwijderen(
  p_taak uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_taak   public.taken%rowtype;
  v_bon    public.werkbonnen%rowtype;
  v_fotos  integer;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen kantoor kan een punt van een werkbon halen'
      using errcode = '42501';
  end if;

  select * into v_taak from public.taken
   where id = p_taak and tenant_id = v_tenant;
  if not found then
    raise exception 'Dit punt bestaat niet (meer)' using errcode = 'P0002';
  end if;

  if v_taak.standaard then
    raise exception 'Dit punt hoort op elke werkbon en kan er niet af'
      using errcode = '23514';
  end if;

  select * into v_bon from public.werkbonnen
   where id = v_taak.werkbon_id and tenant_id = v_tenant;
  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  if v_bon.opgeleverd_op is not null then
    raise exception 'Deze klus is opgeleverd; daar kan geen punt meer af'
      using errcode = '23514';
  end if;

  select count(*) into v_fotos from public.fotos where taak_id = p_taak;
  if v_fotos > 0 then
    raise exception
      'Aan dit punt hangen % foto(s). Haal die er eerst af — foto''s zijn het bewijs dat het werk gedaan is.',
      v_fotos
      using errcode = '23514';
  end if;

  delete from public.taken where id = p_taak;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, v_taak.werkbon_id, 'punt_verwijderd', v_taak.titel, auth.uid());

  return jsonb_build_object('verwijderd', true, 'titel', v_taak.titel);
end;
$$;

revoke all on function public.werkbon_punt_verwijderen(uuid) from public, anon;
grant execute on function public.werkbon_punt_verwijderen(uuid) to authenticated;


-- ── E. DE BONNEN DIE ER AL STAAN ─────────────────────────────
-- Alleen wat nog loopt. Zie de kop: een open punt op een afgeronde of
-- opgeleverde bon zou die bon terugzetten naar "bezig" en het rapport
-- tegenspreken.

insert into public.taken
  (tenant_id, werkbon_id, titel, omschrijving, volgorde, foto_vereist, standaard)
select w.tenant_id, w.id, public.standaardpunt_titel(),
       'Maak een foto van het blad zoals het hangt. Dit punt moet af voordat je aan de rest begint.',
       -1, true, true
  from public.werkbonnen w
 where w.opgeleverd_op is null
   and w.status <> 'voltooid'
   and not exists (
     select 1 from public.taken t where t.werkbon_id = w.id and t.standaard
   );

commit;

-- ── CONTROLE ─────────────────────────────────────────────────
-- Verwacht: op elke lopende bon precies één standaardpunt, en nul
-- lopende bonnen zonder.
select
  (select count(*) from public.werkbonnen w
    where w.opgeleverd_op is null and w.status <> 'voltooid'
      and not exists (select 1 from public.taken t
                       where t.werkbon_id = w.id and t.standaard)) as lopend_zonder_punt,
  (select count(*) from public.taken where standaard)              as standaardpunten;

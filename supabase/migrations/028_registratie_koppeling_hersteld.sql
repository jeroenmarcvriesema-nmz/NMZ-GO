-- ============================================================
-- NMZ GO — Migratie 028: registreren werkt weer
-- ============================================================
-- Niemand kon een account aanmaken. Elf pogingen in de auth-logboeken,
-- vanaf twee netwerken, allemaal met dezelfde uitkomst:
--
--   POST /signup -> 500
--   ERROR: Alleen een beheerder kan een persoon aan een account
--          koppelen (SQLSTATE 42501)
--
-- De keten: `handle_new_user()` draait bij het aanmaken van een
-- account, wisselt de uitnodiging in en koppelt de persoon aan het
-- verse profiel met
--
--   update public.personen set profile_id = new.id ...
--
-- Die update raakt de trigger `guard_persoon_kolommen`, en die eist
-- `mag_gebruikers_beheren()`. Op dat moment is er nog geen ingelogde
-- gebruiker: `auth.uid()` is null, `get_mijn_rol()` valt terug op
-- 'medewerker', en de toets faalt. De uitzondering gooit de hele
-- registratie in de prullenbak — de nieuwe medewerker ziet alleen een
-- foutmelding en denkt dat zijn wachtwoord niet klopt.
--
-- De trigger zelf is goed en blijft staan. Wie ingelogd is mag een
-- persoon nog steeds alleen aan een account koppelen als hij beheerder
-- of eigenaar is. Er komt één uitzondering bij, en die is met opzet zo
-- smal mogelijk gehouden:
--
--   1. Alleen als de registratiecode zelf zegt dat dit de inwisseling
--      van een uitnodiging is. Dat gaat via een transactie-lokale vlag
--      die alleen binnen de database gezet kan worden — een browser
--      kan `set_config` niet aanroepen, en de vlag overleeft de
--      transactie niet.
--   2. Alleen als de persoon nog nooit aan een account hing
--      (`old.profile_id is null`). Een bestaande koppeling verzetten
--      blijft voorbehouden aan een beheerder. Dat is de belangrijkste:
--      een koppeling verzetten betekent iemands werk aan een ander
--      account hangen.
--
-- Wat er níét verandert: de RLS op `personen` blijft zoals hij is
-- (anon mag helemaal niet updaten, authenticated alleen met
-- `mag_werk_beheren()`), en de uitnodiging moet nog steeds bestaan,
-- ongebruikt zijn en niet verlopen — dat staat al in `handle_new_user`
-- en is hier niet aangeraakt.
--
-- Voegt alleen toe en vervangt twee functies. Verwijdert geen tabellen,
-- kolommen of data. Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. DE POORT, MET ÉÉN DEUR ERBIJ ───────────────────────────

create or replace function public.guard_persoon_kolommen()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.profile_id is distinct from old.profile_id then

    -- De uitzondering: het inwisselen van een uitnodiging, door
    -- handle_new_user(), op het moment dat er nog geen sessie is.
    --
    -- De vlag is transactie-lokaal (`set_config(..., true)`) en wordt
    -- vlak voor de update gezet en er meteen achter weer weg. Een
    -- gebruiker kan hem niet zetten: `set_config` staat in pg_catalog
    -- en is via PostgREST niet aan te roepen, en zelfs als dat kon
    -- draait elk verzoek in zijn eigen transactie.
    --
    -- De tweede voorwaarde is de echte: alleen een eerste koppeling.
    -- Een bestaande koppeling verzetten kan hierlangs nooit.
    if old.profile_id is null
       and coalesce(current_setting('nmzgo.koppelt_uitnodiging', true), '') = '1' then
      return new;
    end if;

    if not public.mag_gebruikers_beheren() then
      raise exception 'Alleen een beheerder kan een persoon aan een account koppelen'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_persoon_kolommen() is
  'Houdt tegen dat iemand anders dan een beheerder een persoon aan een account koppelt. Eén uitzondering: de eerste koppeling tijdens het inwisselen van een uitnodiging.';


-- ── B. DE REGISTRATIE ZET DE VLAG ─────────────────────────────
-- Verder ongewijzigd ten opzichte van wat er draaide: dezelfde
-- inwisseling van de uitnodiging, dezelfde eigenaar-bij-de-eerste-
-- gebruiker regel, dezelfde naamkeuze. Alleen de twee regels rond de
-- koppeling zijn nieuw.

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_token   text := new.raw_user_meta_data->>'uitnodiging_token';
  v_tenant  uuid;
  v_persoon uuid;
  v_rol     text := 'medewerker';
begin
  if v_token is not null then
    update public.uitnodigingen
       set gebruikt = true
     where token = v_token
       and not gebruikt
       and (verloopt_op is null or verloopt_op > now())
    returning tenant_id, persoon_id, rol
      into v_tenant, v_persoon, v_rol;
  end if;

  v_tenant := coalesce(v_tenant, public.get_mijn_tenant());
  v_rol    := coalesce(v_rol, 'medewerker');

  -- De allereerste gebruiker van een tenant wordt eigenaar; anders zou
  -- er niemand zijn die de rest kan uitnodigen.
  if not exists (
    select 1 from public.profiles
    where tenant_id = v_tenant and rol in ('beheerder', 'eigenaar')
  ) then
    v_rol := 'eigenaar';
  end if;

  insert into public.profiles (id, naam, email, rol, tenant_id)
  values (
    new.id,
    coalesce(
      (select naam from public.personen where id = v_persoon),
      new.raw_user_meta_data->>'naam',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    v_rol,
    v_tenant
  )
  on conflict (id) do nothing;

  if v_persoon is not null then
    -- De vlag staat precies om deze ene update heen. Zonder de
    -- uitnodiging komt de code hier niet: v_persoon blijft dan null.
    perform set_config('nmzgo.koppelt_uitnodiging', '1', true);

    update public.personen
       set profile_id = new.id
     where id = v_persoon and profile_id is null;

    perform set_config('nmzgo.koppelt_uitnodiging', '', true);
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Maakt bij een nieuw account het profiel aan, wisselt de uitnodiging in en koppelt de persoon. Draait als trigger op auth.users.';

commit;


-- ── C. VERIFICATIE ────────────────────────────────────────────

select 'de trigger staat er nog' as controle,
       (select count(*)::text from pg_trigger
         where not tgisinternal and tgname = 'guard_persoon_kolommen') as gevonden,
       '1' as verwacht
union all
select 'de uitzondering is er',
       (select case when prosrc like '%nmzgo.koppelt_uitnodiging%' then 'ja' else 'NEE' end
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'guard_persoon_kolommen'), 'ja'
union all
select 'de registratie zet de vlag',
       (select case when prosrc like '%nmzgo.koppelt_uitnodiging%' then 'ja' else 'NEE' end
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'handle_new_user'), 'ja'
union all
select 'anon mag nog steeds niets op personen',
       (select count(*)::text from pg_policies
         where schemaname = 'public' and tablename = 'personen'
           and cmd = 'UPDATE' and roles::text like '%anon%'), '0';

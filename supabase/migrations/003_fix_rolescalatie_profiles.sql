-- ============================================================
-- NMZ GO — Migratie 003: [CRITICAL FIX] rol-escalatie op profiles
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Dicht een privilege escalation die aangetoond is met de
-- rollentest die GIT_WORKFLOW.md voorschrijft na migratie 002.
--
-- HET LEK
-- De policy profiles_update_own stond in 001 en 002 als:
--
--   create policy "profiles_update_own"
--     on public.profiles for update
--     using ( auth.uid() = id );          -- geen with check!
--
-- Zonder `with check` valt Postgres voor de controle op de nieuwe
-- rij terug op de `using`-expressie. Die kijkt alleen naar `id`,
-- en `id` verandert niet bij een update. Elke kolom van de eigen
-- rij was daarmee vrij bewerkbaar — ook `rol` en `tenant_id`.
--
-- Aangetoond met één PostgREST-call als gewone medewerker:
--
--   PATCH /rest/v1/profiles?id=eq.<eigen-id>
--   { "rol": "beheerder", "tenant_id": "<andere-tenant>" }
--
--   voor : medewerker / eigen tenant  → ziet 1 werkbon
--   na   : beheerder  / andere tenant → ziet de werkbonnen van
--                                        een andere klant
--
-- Beide beveiligingslagen vielen dus tegelijk om: de rolscheiding
-- én de tenant-isolatie uit migratie 002.
--
-- DE FIX — twee lagen, bewust allebei
--   A. Een trigger die rol- en tenant_id-wijzigingen tegenhoudt.
--      Een trigger ziet OLD en NEW en kan daarom precies zien of
--      een kolom verandert; een RLS-policy kan dat niet.
--   B. `with check` op de update-policies, als tweede slot voor
--      het geval de trigger ooit sneuvelt bij een restore.
--
-- Voegt alleen toe en vervangt policies. Raakt geen data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. TRIGGER: rol en tenant_id afschermen ──────────────────
-- Draait als SECURITY DEFINER zodat get_mijn_rol() ook werkt
-- wanneer de aanroeper zelf niet in profiles mag lezen.
--
-- Wie mag wat:
--   * geen auth.uid()  → service_role / SQL Editor / Edge
--     Function met de service key. Mag alles; dit is de enige
--     weg waarlangs een tenant-verhuizing hoort te lopen.
--   * beheerder        → mag rol wijzigen binnen de eigen tenant,
--                        maar tenant_id niet.
--   * medewerker       → mag rol noch tenant_id wijzigen.

create or replace function public.guard_profiel_rol_tenant()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- Serverzijde (service_role, SQL Editor, Edge Function): geen JWT,
  -- dus geen eindgebruiker om tegen te beschermen.
  if auth.uid() is null then
    return new;
  end if;

  -- tenant_id ligt vast voor iedereen die via de app werkt.
  -- Een medewerker verhuizen naar een andere tenant is een
  -- beheerhandeling die bewust buiten de client om moet.
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Tenant van een profiel wijzigen mag niet via de app'
      using errcode = '42501';
  end if;

  -- Rol wijzigen mag alleen een beheerder. Dit is de kern van de fix:
  -- hiermee kan een medewerker zichzelf niet promoveren.
  if new.rol is distinct from old.rol
     and public.get_mijn_rol() <> 'beheerder' then
    raise exception 'Alleen een beheerder mag de rol van een profiel wijzigen'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profiel_rol_tenant() from public, anon, authenticated;

drop trigger if exists profiles_guard_rol_tenant on public.profiles;
create trigger profiles_guard_rol_tenant
  before update on public.profiles
  for each row execute function public.guard_profiel_rol_tenant();


-- ── B. WITH CHECK OP DE UPDATE-POLICIES ──────────────────────
-- Tweede slot. De `using`-expressies blijven exact zoals in 002,
-- zodat de rolscheiding ongewijzigd is; er komt uitsluitend een
-- `with check` bij die de nieuwe rij aan dezelfde eis onderwerpt.

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using      ( auth.uid() = id )
  with check ( auth.uid() = id and tenant_id = public.get_mijn_tenant() );

drop policy if exists "profiles_update_beheerder" on public.profiles;
create policy "profiles_update_beheerder"
  on public.profiles for update
  using      ( public.get_mijn_rol() = 'beheerder' and tenant_id = public.get_mijn_tenant() )
  with check ( public.get_mijn_rol() = 'beheerder' and tenant_id = public.get_mijn_tenant() );

-- profiles_insert_own kende hetzelfde gat: een nieuwe gebruiker kon
-- zichzelf bij de eerste schrijfactie meteen als beheerder aanmelden.
-- De trigger dekt dit niet af, want die kijkt alleen naar updates.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check ( auth.uid() = id and rol = 'medewerker' );


-- ── C. RESTANT: SEARCH_PATH OP update_updated_at ──────────────
-- Door de Supabase-linter gemeld (function_search_path_mutable).
-- Zonder vaste search_path kan de functie in een andere sessie
-- naar een ander schema wijzen. Enige wijziging is de set-regel.

create or replace function public.update_updated_at()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── D. VERIFICATIE ────────────────────────────────────────────
-- Draai dit na de migratie; beide queries horen te tonen dat de
-- twee sloten op hun plaats zitten.

-- 1. Alle update-policies op profiles hebben nu een with_check
select policyname, cmd,
       case when with_check is null then 'ONTBREEKT' else 'aanwezig' end as with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;

-- 2. De trigger staat aan
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal;

commit;

-- ============================================================
-- NMZ GO — Migratie 002: projecten, tenants en rapportvelden
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Fase 0 van Epic 4. Bevat drie onderdelen:
--   A. tenants + tenant_id op alle tabellen (multi-tenancy)
--   B. projecten-tabel + koppeling vanaf werkbonnen
--   C. ontbrekende velden voor het opleverrapport
--
-- Voegt alleen toe. Verwijdert geen tabellen, kolommen of data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A1. TENANTS ───────────────────────────────────────────────
-- Eén rij per bedrijf. Vandaag alleen Nooitmeerzwam; deze tabel
-- bestaat nu al zodat white label later geen datamigratie vraagt.

create table if not exists public.tenants (
  id         uuid        primary key default gen_random_uuid(),
  naam       text        not null,
  actief     boolean     not null default true,
  created_at timestamptz not null default now()
);

insert into public.tenants (naam)
select 'Nooitmeerzwam'
where not exists (select 1 from public.tenants);


-- ── A2. TENANT_ID OP BESTAANDE TABELLEN ──────────────────────
-- Nog zonder standaardwaarde: die verwijst straks naar
-- get_mijn_tenant(), en die functie leest op haar beurt uit
-- profiles.tenant_id. De kolom moet er dus eerst zijn.

alter table public.profiles            add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.werkbonnen          add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.taken               add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.fotos               add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.werkbon_medewerkers add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.uitnodigingen       add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;

-- Bestaande rijen aan de standaard tenant hangen
update public.profiles            set tenant_id = (select id from public.tenants order by created_at limit 1) where tenant_id is null;
update public.werkbonnen          set tenant_id = (select id from public.tenants order by created_at limit 1) where tenant_id is null;
update public.taken               set tenant_id = (select id from public.tenants order by created_at limit 1) where tenant_id is null;
update public.fotos               set tenant_id = (select id from public.tenants order by created_at limit 1) where tenant_id is null;
update public.werkbon_medewerkers set tenant_id = (select id from public.tenants order by created_at limit 1) where tenant_id is null;
update public.uitnodigingen       set tenant_id = (select id from public.tenants order by created_at limit 1) where tenant_id is null;

-- Pas ná de backfill verplicht stellen
alter table public.profiles            alter column tenant_id set not null;
alter table public.werkbonnen          alter column tenant_id set not null;
alter table public.taken               alter column tenant_id set not null;
alter table public.fotos               alter column tenant_id set not null;
alter table public.werkbon_medewerkers alter column tenant_id set not null;
alter table public.uitnodigingen       alter column tenant_id set not null;


-- ── A3. SECURITY DEFINER FUNCTIE — TENANT ────────────────────
-- Zelfde constructie als get_mijn_rol(): draait als database-
-- eigenaar buiten de RLS-context, zodat een policy op profiles
-- deze functie kan aanroepen zonder 42P17 recursie.
-- Valt terug op de oudste tenant zolang een gebruiker er nog
-- geen heeft (bv. tijdens registratie, vóór het profiel bestaat).
-- Staat bewust ná A2: de functie leest profiles.tenant_id, en
-- Postgres controleert de body van een SQL-functie direct.

create or replace function public.get_mijn_tenant()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(
    (select tenant_id from public.profiles where id = auth.uid() limit 1),
    (select id from public.tenants order by created_at limit 1)
  );
$$;

revoke execute on function public.get_mijn_tenant() from public;
grant  execute on function public.get_mijn_tenant() to authenticated;


-- ── A4. STANDAARDWAARDEN ─────────────────────────────────────
-- Nieuwe rijen krijgen automatisch de tenant van de ingelogde
-- gebruiker, zodat de frontend niets hoeft mee te sturen en
-- bestaande code ongewijzigd blijft werken.

alter table public.profiles            alter column tenant_id set default public.get_mijn_tenant();
alter table public.werkbonnen          alter column tenant_id set default public.get_mijn_tenant();
alter table public.taken               alter column tenant_id set default public.get_mijn_tenant();
alter table public.fotos               alter column tenant_id set default public.get_mijn_tenant();
alter table public.werkbon_medewerkers alter column tenant_id set default public.get_mijn_tenant();
alter table public.uitnodigingen       alter column tenant_id set default public.get_mijn_tenant();


-- ── B1. PROJECTEN ─────────────────────────────────────────────
-- Vervangt de mock-implementatie in useProjecten.ts.
-- Statuswaarden gelijk aan ProjectStatus in src/types/index.ts.

create table if not exists public.projecten (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete restrict default public.get_mijn_tenant(),
  naam          text        not null default '',
  projectnummer text,
  opdrachtgever text,
  adres         text        not null default '',
  status        text        not null default 'niet_gestart'
                  check (status in ('actief','niet_gestart','op_schema','vertraging','afgerond')),
  startdatum    date,
  einddatum     date,
  opmerkingen   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists projecten_updated_at on public.projecten;
create trigger projecten_updated_at
  before update on public.projecten
  for each row execute function public.update_updated_at();


-- ── B2. WERKBON → PROJECT ────────────────────────────────────
-- Nullable: bestaande werkbonnen horen nog bij geen project, en
-- een verwijderd project mag een werkbon niet meeslepen.

alter table public.werkbonnen
  add column if not exists project_id uuid references public.projecten(id) on delete set null;


-- ── C. VELDEN VOOR HET OPLEVERRAPPORT ────────────────────────
-- Afgeleid uit het bestaande rapport (Sterrebosstraat 30 te Haarlem).
-- Zonder deze velden is dat rapport niet te reproduceren.

-- Adres opgesplitst. 'adres' blijft straat + huisnummer, zodat
-- bestaande schermen ongewijzigd blijven werken.
alter table public.werkbonnen add column if not exists postcode text;
alter table public.werkbonnen add column if not exists plaats   text;

-- Herkomst en afronding
alter table public.werkbonnen add column if not exists opdrachtnummer text;
alter table public.werkbonnen add column if not exists opleverdatum   date;

-- Vrije tekstblokken uit het rapport
alter table public.werkbonnen add column if not exists opmerkingen_bewoners           text;
alter table public.werkbonnen add column if not exists extra_werkzaamheden            text;
alter table public.werkbonnen add column if not exists niet_uitgevoerde_werkzaamheden text;
alter table public.werkbonnen add column if not exists buiten_garantie_werkzaamheden  text;
alter table public.werkbonnen add column if not exists bijzonderheden                 text;

-- Foto's van vóór, tijdens en ná. 'voor' komt van de inspecteur,
-- 'na' van de monteur — het rapport zet ze naast elkaar.
alter table public.fotos
  add column if not exists fase text not null default 'na'
    check (fase in ('voor','tijdens','na'));


-- ── D. INDEXEN ────────────────────────────────────────────────

create index if not exists idx_projecten_tenant            on public.projecten(tenant_id);
create index if not exists idx_projecten_status            on public.projecten(status);
create index if not exists idx_werkbonnen_project          on public.werkbonnen(project_id);
create index if not exists idx_werkbonnen_tenant           on public.werkbonnen(tenant_id);
create index if not exists idx_profiles_tenant             on public.profiles(tenant_id);
create index if not exists idx_taken_tenant                on public.taken(tenant_id);
create index if not exists idx_fotos_tenant                on public.fotos(tenant_id);
create index if not exists idx_fotos_fase                  on public.fotos(werkbon_id, fase);
create index if not exists idx_werkbon_medewerkers_tenant  on public.werkbon_medewerkers(tenant_id);


-- ── E. RLS — PROJECTEN ───────────────────────────────────────

alter table public.projecten enable row level security;

-- Alleen beheerders. Alle projectroutes in App.tsx staan achter
-- BeheerderGuard, dus een medewerker heeft hier niets te zoeken.
-- Bewust géén subquery via werkbonnen: dat zou geneste RLS-evaluatie
-- over drie tabellen opleveren voor een recht dat niemand gebruikt.
drop policy if exists "projecten_select" on public.projecten;
create policy "projecten_select"
  on public.projecten for select
  using (
    tenant_id = public.get_mijn_tenant()
    and public.get_mijn_rol() = 'beheerder'
  );

drop policy if exists "projecten_insert" on public.projecten;
create policy "projecten_insert"
  on public.projecten for insert
  with check (
    tenant_id = public.get_mijn_tenant()
    and public.get_mijn_rol() = 'beheerder'
  );

drop policy if exists "projecten_update" on public.projecten;
create policy "projecten_update"
  on public.projecten for update
  using (
    tenant_id = public.get_mijn_tenant()
    and public.get_mijn_rol() = 'beheerder'
  );

drop policy if exists "projecten_delete" on public.projecten;
create policy "projecten_delete"
  on public.projecten for delete
  using (
    tenant_id = public.get_mijn_tenant()
    and public.get_mijn_rol() = 'beheerder'
  );


-- ── F. BESTAANDE POLICIES UITGEBREID MET TENANT-CHECK ────────
-- De rolscheiding blijft exact zoals in 001; er komt uitsluitend
-- een tenant-voorwaarde bij. Geen subquery op de eigen tabel,
-- dus geen risico op 42P17 recursie.

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using ( auth.uid() = id );

drop policy if exists "profiles_select_beheerder" on public.profiles;
create policy "profiles_select_beheerder"
  on public.profiles for select
  using ( public.get_mijn_rol() = 'beheerder' and tenant_id = public.get_mijn_tenant() );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using ( auth.uid() = id );

drop policy if exists "profiles_update_beheerder" on public.profiles;
create policy "profiles_update_beheerder"
  on public.profiles for update
  using ( public.get_mijn_rol() = 'beheerder' and tenant_id = public.get_mijn_tenant() );

drop policy if exists "profiles_delete_beheerder" on public.profiles;
create policy "profiles_delete_beheerder"
  on public.profiles for delete
  using ( public.get_mijn_rol() = 'beheerder' and tenant_id = public.get_mijn_tenant() );

-- WERKBONNEN
drop policy if exists "werkbonnen_select" on public.werkbonnen;
create policy "werkbonnen_select"
  on public.werkbonnen for select
  using (
    tenant_id = public.get_mijn_tenant()
    and (
      public.get_mijn_rol() = 'beheerder'
      or auth.uid() in (
        select medewerker_id from public.werkbon_medewerkers
        where werkbon_id = werkbonnen.id
      )
    )
  );

drop policy if exists "werkbonnen_insert" on public.werkbonnen;
create policy "werkbonnen_insert"
  on public.werkbonnen for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

drop policy if exists "werkbonnen_update" on public.werkbonnen;
create policy "werkbonnen_update"
  on public.werkbonnen for update
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

drop policy if exists "werkbonnen_delete" on public.werkbonnen;
create policy "werkbonnen_delete"
  on public.werkbonnen for delete
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

-- WERKBON_MEDEWERKERS
drop policy if exists "werkbon_medewerkers_select" on public.werkbon_medewerkers;
create policy "werkbon_medewerkers_select"
  on public.werkbon_medewerkers for select
  using (
    tenant_id = public.get_mijn_tenant()
    and ( medewerker_id = auth.uid() or public.get_mijn_rol() = 'beheerder' )
  );

drop policy if exists "werkbon_medewerkers_insert" on public.werkbon_medewerkers;
create policy "werkbon_medewerkers_insert"
  on public.werkbon_medewerkers for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

drop policy if exists "werkbon_medewerkers_delete" on public.werkbon_medewerkers;
create policy "werkbon_medewerkers_delete"
  on public.werkbon_medewerkers for delete
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

-- TAKEN
drop policy if exists "taken_select" on public.taken;
create policy "taken_select"
  on public.taken for select
  using (
    tenant_id = public.get_mijn_tenant()
    and (
      public.get_mijn_rol() = 'beheerder'
      or exists (
        select 1 from public.werkbon_medewerkers
        where werkbon_id = taken.werkbon_id
          and medewerker_id = auth.uid()
      )
    )
  );

drop policy if exists "taken_insert" on public.taken;
create policy "taken_insert"
  on public.taken for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

drop policy if exists "taken_update" on public.taken;
create policy "taken_update"
  on public.taken for update
  using (
    tenant_id = public.get_mijn_tenant()
    and (
      public.get_mijn_rol() = 'beheerder'
      or exists (
        select 1 from public.werkbon_medewerkers
        where werkbon_id = taken.werkbon_id
          and medewerker_id = auth.uid()
      )
    )
  );

drop policy if exists "taken_delete" on public.taken;
create policy "taken_delete"
  on public.taken for delete
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

-- FOTOS
drop policy if exists "fotos_select" on public.fotos;
create policy "fotos_select"
  on public.fotos for select
  using (
    tenant_id = public.get_mijn_tenant()
    and (
      public.get_mijn_rol() = 'beheerder'
      or exists (
        select 1 from public.werkbon_medewerkers
        where werkbon_id = fotos.werkbon_id
          and medewerker_id = auth.uid()
      )
    )
  );

drop policy if exists "fotos_insert" on public.fotos;
create policy "fotos_insert"
  on public.fotos for insert
  with check ( tenant_id = public.get_mijn_tenant() and uploader_id = auth.uid() );

drop policy if exists "fotos_delete" on public.fotos;
create policy "fotos_delete"
  on public.fotos for delete
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

-- UITNODIGINGEN
-- LET OP: uitnodigingen_select blijft bewust 'using (true)'.
-- De registratiepagina bevraagt deze tabel vóór het inloggen; een
-- tenant-check zou registreren onmogelijk maken. Het token is het
-- geheim. Bij de overstap naar meerdere tenants moet deze policy
-- worden vervangen door een opzoekfunctie op token.
drop policy if exists "uitnodigingen_insert" on public.uitnodigingen;
create policy "uitnodigingen_insert"
  on public.uitnodigingen for insert
  with check ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

drop policy if exists "uitnodigingen_update" on public.uitnodigingen;
create policy "uitnodigingen_update"
  on public.uitnodigingen for update
  using (
    public.get_mijn_rol() = 'beheerder'
    or auth.uid() is not null
  );


-- ── G. VERIFICATIE ────────────────────────────────────────────

-- Tenant aangemaakt en overal gekoppeld?
select
  'tenants' as controle,
  (select count(*) from public.tenants)                                   as aantal_tenants,
  (select count(*) from public.profiles   where tenant_id is null)        as profielen_zonder_tenant,
  (select count(*) from public.werkbonnen where tenant_id is null)        as werkbonnen_zonder_tenant,
  case
    when (select count(*) from public.tenants) = 0 then '❌ Geen tenant'
    when (select count(*) from public.profiles where tenant_id is null) > 0 then '❌ Profiel zonder tenant'
    else '✅ Tenants in orde'
  end as status;

-- Nieuwe tabel en kolommen aanwezig?
select
  'schema' as controle,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'projecten')          as projecten_tabel,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'werkbonnen'
       and column_name = 'project_id')                                    as werkbon_project_id,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'fotos'
       and column_name = 'fase')                                          as foto_fase;

-- Beide SECURITY DEFINER functies aanwezig?
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('get_mijn_rol','get_mijn_tenant')
order by routine_name;

-- Policies overzicht
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

commit;

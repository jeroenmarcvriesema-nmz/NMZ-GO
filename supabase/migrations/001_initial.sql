-- ============================================================
-- NMZ GO — Definitieve database migratie v1.0
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Bevat: tabellen, triggers, RLS policies, SECURITY DEFINER
-- functie, indexen en beheerder instelling.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── 1. TABELLEN ───────────────────────────────────────────────

-- Verwijder bestaande tabellen (veilige volgorde vanwege FK's)
drop table if exists public.fotos              cascade;
drop table if exists public.taken              cascade;
drop table if exists public.werkbon_medewerkers cascade;
drop table if exists public.werkbonnen         cascade;
drop table if exists public.uitnodigingen      cascade;
drop table if exists public.profiles           cascade;

-- Verwijder bestaande functies
drop function if exists public.get_mijn_rol()       cascade;
drop function if exists public.handle_new_user()    cascade;
drop function if exists public.update_updated_at()  cascade;

-- profiles
create table public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  naam       text        not null default '',
  rol        text        not null default 'medewerker'
               check (rol in ('beheerder', 'medewerker')),
  actief     boolean     not null default true,
  created_at timestamptz not null default now()
);

-- werkbonnen
create table public.werkbonnen (
  id              uuid        primary key default gen_random_uuid(),
  bonnummer       text        unique not null,
  projectnaam     text        not null default '',
  adres           text        not null default '',
  opdrachtgever   text,
  datum           date        not null default current_date,
  status          text        not null default 'open'
                    check (status in ('open', 'bezig', 'voltooid')),
  aangemaakt_door uuid        references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- werkbon ↔ medewerker koppeling
create table public.werkbon_medewerkers (
  werkbon_id    uuid not null references public.werkbonnen(id) on delete cascade,
  medewerker_id uuid not null references public.profiles(id)   on delete cascade,
  primary key (werkbon_id, medewerker_id)
);

-- taken
create table public.taken (
  id           uuid        primary key default gen_random_uuid(),
  werkbon_id   uuid        not null references public.werkbonnen(id) on delete cascade,
  titel        text        not null default '',
  omschrijving text,
  voltooid     boolean     not null default false,
  opmerking    text,
  volgorde     integer     not null default 0,
  created_at   timestamptz not null default now()
);

-- fotos
create table public.fotos (
  id            uuid        primary key default gen_random_uuid(),
  werkbon_id    uuid        not null references public.werkbonnen(id) on delete cascade,
  taak_id       uuid        not null references public.taken(id)      on delete cascade,
  uploader_id   uuid        references public.profiles(id)            on delete set null,
  storage_path  text        not null,
  bestandsnaam  text        not null default '',
  created_at    timestamptz not null default now()
);

-- uitnodigingen
create table public.uitnodigingen (
  id               uuid        primary key default gen_random_uuid(),
  token            text        unique not null,
  aangemaakt_door  uuid        references public.profiles(id) on delete set null,
  gebruikt         boolean     not null default false,
  created_at       timestamptz not null default now(),
  verloopt_op      timestamptz
);


-- ── 2. INDEXEN ────────────────────────────────────────────────

create index idx_werkbonnen_status        on public.werkbonnen(status);
create index idx_werkbonnen_datum         on public.werkbonnen(datum);
create index idx_werkbon_medewerkers_mdw  on public.werkbon_medewerkers(medewerker_id);
create index idx_taken_werkbon            on public.taken(werkbon_id);
create index idx_taken_volgorde           on public.taken(werkbon_id, volgorde);
create index idx_fotos_taak               on public.fotos(taak_id);
create index idx_fotos_werkbon            on public.fotos(werkbon_id);
create index idx_uitnodigingen_token      on public.uitnodigingen(token);


-- ── 3. TRIGGERS ───────────────────────────────────────────────

-- updated_at automatisch bijhouden
create or replace function public.update_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger werkbonnen_updated_at
  before update on public.werkbonnen
  for each row execute function public.update_updated_at();

-- Automatisch profiel aanmaken bij nieuwe gebruiker
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, naam, rol)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'naam',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data->>'rol', 'medewerker')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 4. SECURITY DEFINER FUNCTIE ───────────────────────────────
-- Leest de rol van de huidige gebruiker BUITEN de RLS-context.
-- Draait als de database-eigenaar (postgres) waardoor de RLS
-- policies op profiles NIET worden geactiveerd bij het lezen.
-- Dit voorkomt de 42P17 infinite recursion fout definitief.
create or replace function public.get_mijn_rol()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(
    (select rol from public.profiles where id = auth.uid() limit 1),
    'medewerker'
  );
$$;

-- Alleen ingelogde gebruikers mogen de functie aanroepen
revoke execute on function public.get_mijn_rol() from public;
grant  execute on function public.get_mijn_rol() to authenticated;


-- ── 5. RLS INSCHAKELEN ────────────────────────────────────────

alter table public.profiles            enable row level security;
alter table public.werkbonnen          enable row level security;
alter table public.werkbon_medewerkers enable row level security;
alter table public.taken               enable row level security;
alter table public.fotos               enable row level security;
alter table public.uitnodigingen       enable row level security;


-- ── 6. RLS POLICIES — PROFILES ───────────────────────────────
-- GEEN subquery op profiles in deze policies → geen recursie.
-- Rolcheck via get_mijn_rol() (SECURITY DEFINER, buiten RLS).

create policy "profiles_select_own"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "profiles_select_beheerder"
  on public.profiles for select
  using ( public.get_mijn_rol() = 'beheerder' );

create policy "profiles_insert_own"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "profiles_update_own"
  on public.profiles for update
  using ( auth.uid() = id );

create policy "profiles_update_beheerder"
  on public.profiles for update
  using ( public.get_mijn_rol() = 'beheerder' );

create policy "profiles_delete_beheerder"
  on public.profiles for delete
  using ( public.get_mijn_rol() = 'beheerder' );


-- ── 7. RLS POLICIES — WERKBONNEN ─────────────────────────────

create policy "werkbonnen_select"
  on public.werkbonnen for select
  using (
    public.get_mijn_rol() = 'beheerder'
    or auth.uid() in (
      select medewerker_id from public.werkbon_medewerkers
      where werkbon_id = werkbonnen.id
    )
  );

create policy "werkbonnen_insert"
  on public.werkbonnen for insert
  with check ( public.get_mijn_rol() = 'beheerder' );

create policy "werkbonnen_update"
  on public.werkbonnen for update
  using ( public.get_mijn_rol() = 'beheerder' );

create policy "werkbonnen_delete"
  on public.werkbonnen for delete
  using ( public.get_mijn_rol() = 'beheerder' );


-- ── 8. RLS POLICIES — WERKBON_MEDEWERKERS ────────────────────

create policy "werkbon_medewerkers_select"
  on public.werkbon_medewerkers for select
  using (
    medewerker_id = auth.uid()
    or public.get_mijn_rol() = 'beheerder'
  );

create policy "werkbon_medewerkers_insert"
  on public.werkbon_medewerkers for insert
  with check ( public.get_mijn_rol() = 'beheerder' );

create policy "werkbon_medewerkers_delete"
  on public.werkbon_medewerkers for delete
  using ( public.get_mijn_rol() = 'beheerder' );


-- ── 9. RLS POLICIES — TAKEN ──────────────────────────────────

create policy "taken_select"
  on public.taken for select
  using (
    public.get_mijn_rol() = 'beheerder'
    or exists (
      select 1 from public.werkbon_medewerkers
      where werkbon_id = taken.werkbon_id
        and medewerker_id = auth.uid()
    )
  );

create policy "taken_insert"
  on public.taken for insert
  with check ( public.get_mijn_rol() = 'beheerder' );

create policy "taken_update"
  on public.taken for update
  using (
    public.get_mijn_rol() = 'beheerder'
    or exists (
      select 1 from public.werkbon_medewerkers
      where werkbon_id = taken.werkbon_id
        and medewerker_id = auth.uid()
    )
  );

create policy "taken_delete"
  on public.taken for delete
  using ( public.get_mijn_rol() = 'beheerder' );


-- ── 10. RLS POLICIES — FOTOS ─────────────────────────────────

create policy "fotos_select"
  on public.fotos for select
  using (
    public.get_mijn_rol() = 'beheerder'
    or exists (
      select 1 from public.werkbon_medewerkers
      where werkbon_id = fotos.werkbon_id
        and medewerker_id = auth.uid()
    )
  );

create policy "fotos_insert"
  on public.fotos for insert
  with check ( uploader_id = auth.uid() );

create policy "fotos_delete"
  on public.fotos for delete
  using ( public.get_mijn_rol() = 'beheerder' );


-- ── 11. RLS POLICIES — UITNODIGINGEN ─────────────────────────

-- Iedereen mag token opzoeken (registratiepagina)
create policy "uitnodigingen_select"
  on public.uitnodigingen for select
  using ( true );

create policy "uitnodigingen_insert"
  on public.uitnodigingen for insert
  with check ( public.get_mijn_rol() = 'beheerder' );

-- Beheerder of ingelogde gebruiker (token als gebruikt markeren)
create policy "uitnodigingen_update"
  on public.uitnodigingen for update
  using (
    public.get_mijn_rol() = 'beheerder'
    or auth.uid() is not null
  );


-- ── 12. BEHEERDER INSTELLEN ───────────────────────────────────
-- Pas het e-mailadres hieronder aan als dit niet klopt.
-- Na uitvoering toont de verificatie query of het gelukt is.

insert into public.profiles (id, naam, rol, actief)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'naam', split_part(u.email, '@', 1)),
  'medewerker',
  true
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Stel de beheerder in
update public.profiles
set rol = 'beheerder'
where id = (
  select id from auth.users
  where email = 'jeroenmarcvriesema@gmail.com'
  limit 1
);


-- ── 13. VERIFICATIE ───────────────────────────────────────────

-- Gebruikers en rollen
select
  u.email,
  p.naam,
  p.rol,
  p.actief,
  case
    when p.id is null        then '❌ Geen profiel'
    when p.rol = 'beheerder' then '✅ Beheerder'
    else                          '👤 Medewerker'
  end as status
from auth.users u
left join public.profiles p on p.id = u.id
order by p.rol desc nulls last, u.email;

-- SECURITY DEFINER functie aanwezig?
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'get_mijn_rol';

-- Policies overzicht
select tablename, policyname, cmd, permissive
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

commit;

-- ============================================================
-- NMZ GO — Migratie 006: werkdag_logs
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- De laatste tabel die het dashboard nog miste. Zonder deze
-- tabel kan niemand zien of een monteur vandaag daadwerkelijk
-- begonnen is: `useWerkdag` hield dat tot nu toe alleen in
-- sessionStorage bij, dus het verdween bij het sluiten van het
-- tabblad en de beheerder zag er sowieso niets van.
--
-- Eén rij per monteur per werkbon per dag. Start zet de rij,
-- stop vult `stop_tijd`. Dat is genoeg voor de vier dingen die
-- het dashboard wil weten: wie is begonnen, hoe laat, wie nog
-- niet, en hoe lang loopt het al.
--
-- Bewust géén urenregistratie in de boekhoudkundige zin — geen
-- pauzes, geen correcties, geen goedkeuring. Dat is een eigen
-- onderwerp; deze tabel is het ruwe signaal.
--
-- Voegt alleen toe. Veilig meerdere keren uitvoerbaar.
-- ============================================================

begin;

-- ── A. TABEL ──────────────────────────────────────────────────

create table if not exists public.werkdag_logs (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null default public.get_mijn_tenant()
                            references public.tenants(id) on delete restrict,
  medewerker_id uuid        not null references public.profiles(id)   on delete cascade,
  werkbon_id    uuid                 references public.werkbonnen(id) on delete cascade,
  datum         date        not null default current_date,
  start_tijd    timestamptz not null default now(),
  stop_tijd     timestamptz,
  created_at    timestamptz not null default now()
);

-- Eén log per monteur per werkbon per dag. Dubbel op "start"
-- drukken mag nooit een tweede rij opleveren; de client vangt dat
-- af met een upsert op deze sleutel.
create unique index if not exists werkdag_logs_uniek
  on public.werkdag_logs (medewerker_id, werkbon_id, datum);

-- Het dashboard vraagt altijd om "vandaag, deze tenant".
create index if not exists werkdag_logs_tenant_datum
  on public.werkdag_logs (tenant_id, datum);

-- Stoppen kan niet vóór starten.
alter table public.werkdag_logs drop constraint if exists werkdag_logs_stop_na_start;
alter table public.werkdag_logs add  constraint werkdag_logs_stop_na_start
  check (stop_tijd is null or stop_tijd >= start_tijd);


-- ── B. RLS ────────────────────────────────────────────────────
-- Zelfde vorm als de rest van het schema: alles binnen de eigen
-- tenant, een monteur ziet en schrijft alleen zijn eigen rijen,
-- een beheerder ziet de hele tenant.

alter table public.werkdag_logs enable row level security;

drop policy if exists "werkdag_logs_select" on public.werkdag_logs;
create policy "werkdag_logs_select"
  on public.werkdag_logs for select
  using (
    tenant_id = public.get_mijn_tenant()
    and (medewerker_id = auth.uid() or public.get_mijn_rol() = 'beheerder')
  );

drop policy if exists "werkdag_logs_insert" on public.werkdag_logs;
create policy "werkdag_logs_insert"
  on public.werkdag_logs for insert
  with check (
    tenant_id = public.get_mijn_tenant()
    and medewerker_id = auth.uid()
  );

drop policy if exists "werkdag_logs_update" on public.werkdag_logs;
create policy "werkdag_logs_update"
  on public.werkdag_logs for update
  using      ( tenant_id = public.get_mijn_tenant() and medewerker_id = auth.uid() )
  with check ( tenant_id = public.get_mijn_tenant() and medewerker_id = auth.uid() );

-- Corrigeren is beheerderswerk.
drop policy if exists "werkdag_logs_delete" on public.werkdag_logs;
create policy "werkdag_logs_delete"
  on public.werkdag_logs for delete
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );


-- ── C. KOLOMBEPERKING ─────────────────────────────────────────
-- Zelfde tweetrapsopzet als 003 en 005: een policy bepaalt wélke
-- rij je mag aanraken, een trigger wélke kolom. Een monteur mag
-- zijn eigen log stoppen, maar zijn starttijd niet terugzetten —
-- anders is het signaal waardeloos zodra iemand er belang bij heeft.

create or replace function public.guard_werkdag_kolommen()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.get_mijn_rol() = 'beheerder' then
    return new;
  end if;

  if (to_jsonb(new) - 'stop_tijd') is distinct from (to_jsonb(old) - 'stop_tijd') then
    raise exception 'Een medewerker mag alleen de stoptijd van een werkdag wijzigen'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_werkdag_kolommen() from public, anon, authenticated;

drop trigger if exists werkdag_logs_guard_kolommen on public.werkdag_logs;
create trigger werkdag_logs_guard_kolommen
  before update on public.werkdag_logs
  for each row execute function public.guard_werkdag_kolommen();


-- ── D. VERIFICATIE ────────────────────────────────────────────

select 'tabel bestaat' as controle,
       case when to_regclass('public.werkdag_logs') is not null then 'ja' else 'NEE' end as uitslag
union all
select 'RLS staat aan',
       case when relrowsecurity then 'ja' else 'NEE' end
from pg_class where oid = 'public.werkdag_logs'::regclass
union all
select 'aantal policies',
       (select count(*)::text from pg_policies
        where schemaname = 'public' and tablename = 'werkdag_logs')
union all
select 'trigger op kolommen',
       case when exists (select 1 from pg_trigger
                         where tgrelid = 'public.werkdag_logs'::regclass
                           and tgname = 'werkdag_logs_guard_kolommen')
            then 'ja' else 'NEE' end;

commit;

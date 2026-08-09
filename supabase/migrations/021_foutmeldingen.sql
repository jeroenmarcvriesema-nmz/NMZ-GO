-- 021 — Fouten die op een telefoon gebeuren zichtbaar maken
--
-- Tot nu toe was een crash bij een zwamsaneerder onzichtbaar. Hij ziet
-- een wit scherm, hij belt kantoor, kantoor kan niets terugvinden en de
-- fout gebeurt de week erna opnieuw. Dat is de slechtste soort bug: hij
-- kost tijd bij iemand die geen tijd heeft, en hij bereikt nooit degene
-- die hem kan oplossen.
--
-- Dit is geen Sentry en probeert dat ook niet te zijn. Eén tabel, één
-- regel per crash, zichtbaar voor kantoor. Wie er later een echte
-- monitoringdienst naast wil zetten kan dat; tot die tijd is dit het
-- verschil tussen "ergens ging iets mis" en "op 12 augustus om 07:14
-- klapte de werkbonpagina bij Jeffrey op deze regel".

create table if not exists public.fouten (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,
  boodschap    text not null,
  stack        text,
  pad          text,
  useragent    text,
  -- Waar de fout vandaan kwam: 'render' (een pagina klapte), 'belofte'
  -- (een afgevangen achtergrondfout) of 'venster' (een losse
  -- scriptfout). Geen check-constraint: een nieuwe bron hoort geen
  -- migratie te vereisen op het moment dat je hem het hardst nodig hebt.
  bron         text not null default 'render',
  created_at   timestamptz not null default now()
);

comment on table public.fouten is
  'Crashes uit de app, gemeld door de client zelf. Alleen voor kantoor leesbaar.';

create index if not exists fouten_tenant_tijd_idx
  on public.fouten (tenant_id, created_at desc);

alter table public.fouten enable row level security;

-- Melden mag iedereen die is ingelogd, en alleen over zichzelf en de
-- eigen tenant. Bewust niet voor `anon`: een schrijfbaar eindpunt
-- zonder inlog is een uitnodiging om volgeschreven te worden, en een
-- crash op het inlogscherm zelf halen we niet op. Die staat in de
-- console van het toestel en is met de hand op te vragen.
drop policy if exists fouten_insert_eigen on public.fouten;
create policy fouten_insert_eigen on public.fouten
  for insert to authenticated
  with check (
    tenant_id = public.get_mijn_tenant()
    and (profile_id is null or profile_id = auth.uid())
  );

-- Lezen is voor kantoor. Een zwamsaneerder heeft niets aan de stacktrace
-- van een collega en hoort die ook niet te zien.
drop policy if exists fouten_select_kantoor on public.fouten;
create policy fouten_select_kantoor on public.fouten
  for select to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren());

-- Opruimen mag alleen wie gebruikers beheert; verder ruimt niemand op.
drop policy if exists fouten_delete_beheer on public.fouten;
create policy fouten_delete_beheer on public.fouten
  for delete to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren());

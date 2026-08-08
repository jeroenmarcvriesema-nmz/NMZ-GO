-- ============================================================
-- NMZ GO — Migratie 012: werkbonvelden en documenten uit ClickUp
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Wat de synchronisatie moet kunnen wegschrijven, en waar de twee
-- PDF's blijven.
--
-- De documenten worden gekopieerd, niet gelinkt. De bijlage-URL's van
-- ClickUp zijn kortlevend en soms eenmalig: een link die vandaag werkt
-- is volgende week dood. Een zwamsaneerder die om half acht op een dak
-- zijn tekening opent, krijgt dan niets. Dus halen we ze binnen en
-- zetten we ze in eigen, besloten opslag — daarna is ClickUp niet meer
-- nodig om ze te bekijken.
-- ============================================================

begin;

-- ── A. HERKOMST EN PLANNING OP DE WERKBON ────────────────────

alter table public.werkbonnen
  add column if not exists clickup_taak_id     text,
  add column if not exists clickup_status      text,
  add column if not exists geplande_start      date,
  add column if not exists geplande_eind       date,
  add column if not exists uitloopdatum        date,
  add column if not exists kluiscode           text,
  add column if not exists inspecteur          text,
  add column if not exists inspecteur_telefoon text,
  -- Alles boven "Uit te voeren werkzaamheden" uit de opdracht:
  -- werkvoorbereiding, compartimenten, preparaten. Bewust als één
  -- blok — de kopjes verschillen per inspecteur, daar valt niets
  -- betrouwbaars uit te ontleden.
  add column if not exists werkvoorbereiding   text,
  add column if not exists opdracht_pad        text,
  add column if not exists tekening_pad        text,
  add column if not exists laatst_gesynct      timestamptz;

-- Eén ClickUp-taak wordt één werkbon. Dit maakt de synchronisatie
-- idempotent: een tweede ronde vindt de bestaande bon en werkt hem
-- bij in plaats van een dubbele aan te maken.
drop index if exists werkbonnen_clickup_uniek;
create unique index werkbonnen_clickup_uniek
  on public.werkbonnen (tenant_id, clickup_taak_id)
  where clickup_taak_id is not null;

comment on column public.werkbonnen.uitloopdatum is
  'Uit ClickUp. Samen met geplande_eind de basis voor uitloop-inzicht: '
  'staat hier een datum, dan is de klus uitgelopen.';


-- ── B. OPSLAG VOOR DE DOCUMENTEN ─────────────────────────────
-- Besloten, net als de foto's. Een werkopdracht bevat het adres, de
-- naam van de bewoner en soms de kluiscode van de woning.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('werkbon-documenten', 'werkbon-documenten', false, 26214400,   -- 25 MB
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Zelfde padopbouw en dezelfde regel als bij de foto's: wie bij de
-- werkbon mag, mag bij de documenten.
drop policy if exists "werkbon_documenten_select" on storage.objects;
create policy "werkbon_documenten_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'werkbon-documenten'
    and public.mag_bij_werkbon(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "werkbon_documenten_schrijven" on storage.objects;
create policy "werkbon_documenten_schrijven"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'werkbon-documenten'
    and public.mag_werk_beheren()
    and public.mag_bij_werkbon(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "werkbon_documenten_delete" on storage.objects;
create policy "werkbon_documenten_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'werkbon-documenten'
    and public.mag_werk_beheren()
    and public.mag_bij_werkbon(((storage.foldername(name))[1])::uuid)
  );


-- ── C. VERIFICATIE ────────────────────────────────────────────

select 'nieuwe kolommen op werkbonnen' as controle,
       (select count(*)::text from information_schema.columns
        where table_schema='public' and table_name='werkbonnen'
          and column_name in ('clickup_taak_id','geplande_start','geplande_eind','uitloopdatum',
                              'kluiscode','inspecteur','werkvoorbereiding','opdracht_pad','tekening_pad')) as gevonden,
       '9' as verwacht
union all
select 'bucket werkbon-documenten besloten',
       (select case when public then 'NEE — staat publiek' else 'ja' end
        from storage.buckets where id='werkbon-documenten'), 'ja'
union all
select 'policies op de documenten',
       (select count(*)::text from pg_policies
        where schemaname='storage' and tablename='objects'
          and policyname like 'werkbon_documenten%'), '3';

commit;

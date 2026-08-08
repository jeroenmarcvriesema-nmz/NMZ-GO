-- ============================================================
-- NMZ GO — Migratie 010: fundering voor de ClickUp-koppeling
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Twee dingen die de synchronisatie nodig heeft voordat er ook maar
-- één taak wordt opgehaald.
--
--   A. Een koppeling tussen een label in ClickUp en een profiel hier.
--      In ClickUp staan voornamen ("Mario", "Petev"); in NMZ GO staan
--      volledige namen. Automatisch matchen op naam is fragiel: één
--      andere spelling en de toewijzing valt stil weg, precies het
--      soort fout dat pas maandagochtend opvalt.
--
--   B. De instellingen zelf — space, lijsten, veld-id's, statussen.
--      Die horen niet in code. "Configuratie boven code" is een
--      leidend principe voor dit project, en bij white label heeft
--      elke klant zijn eigen ClickUp-inrichting.
--
-- Geverifieerd tegen de echte werkruimte (augustus 2026): de velden
-- hieronder bestaan met deze id's op zowel Diemen als Leek.
-- ============================================================

begin;

-- ── A. KOPPELING PROFIEL ↔ CLICKUP-LABEL ─────────────────────

alter table public.profiles add column if not exists clickup_label text;

-- Eén label hoort bij één persoon. Zonder deze regel kunnen twee
-- profielen "Mario" claimen en is de toewijzing een gok.
drop index if exists profiles_clickup_label_uniek;
create unique index profiles_clickup_label_uniek
  on public.profiles (tenant_id, clickup_label)
  where clickup_label is not null;


-- ── B. INSTELLINGEN ──────────────────────────────────────────

create table if not exists public.clickup_instellingen (
  tenant_id             uuid primary key references public.tenants(id) on delete cascade,

  space_id              text not null,
  -- Filteren op lijst en niet op space: in dezelfde space staat nog
  -- een losse lijst "Uitvoering" die niet mee hoort te doen.
  lijst_ids             text[] not null default '{}',

  -- `volgende week` betekent "klaar voor uitvoering". Het handmatig
  -- omzetten naar `deze week` in het weekend ís de vrijgavebeslissing.
  trigger_status        text not null default 'volgende week',
  status_opgeleverd     text not null default 'opgeleverd',
  status_wacht_op_fotos text not null default 'wacht op foto''s',

  veld_medewerkers      text,
  veld_startdatum       text,
  veld_opleverdatum     text,
  veld_uitloopdatum     text,
  veld_opdrachtnummer   text,
  veld_kluiscode        text,
  veld_werkopdracht     text,
  veld_werktekening     text,

  -- De namenlijst uit ClickUp, zodat het medewerkersscherm een keuze
  -- kan tonen zonder zelf ClickUp te bevragen — de browser heeft geen
  -- ClickUp-token en hoort dat ook niet te krijgen.
  medewerker_labels     text[] not null default '{}',

  -- Staat bewust uit. De eigenaar heeft vastgelegd dat de
  -- synchronisatie niet in productie mag vóór de terugkoppeling naar
  -- ClickUp werkt; anders overschrijft een ronde het werk van een
  -- zwamsaneerder.
  actief                boolean not null default false,

  bijgewerkt_op         timestamptz not null default now()
);

alter table public.clickup_instellingen enable row level security;

drop policy if exists "clickup_instellingen_select" on public.clickup_instellingen;
create policy "clickup_instellingen_select"
  on public.clickup_instellingen for select
  using ( tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren() );

drop policy if exists "clickup_instellingen_schrijven" on public.clickup_instellingen;
create policy "clickup_instellingen_schrijven"
  on public.clickup_instellingen for all
  using      ( tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren() )
  with check ( tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren() );


-- ── C. INVULLING VOOR NOOITMEERZWAM ──────────────────────────
-- Space "Werkvoorbereiding". Voorlopig alleen Diemen: Leek is nog niet
-- op orde en heeft geen prioriteit. De losse lijst "Uitvoering" doet
-- bewust niet mee — die lijkt een restant. Leek toevoegen is later één
-- id erbij in `lijst_ids`, geen codewijziging.

insert into public.clickup_instellingen (
  tenant_id, space_id, lijst_ids,
  veld_medewerkers, veld_startdatum, veld_opleverdatum, veld_uitloopdatum,
  veld_opdrachtnummer, veld_kluiscode, veld_werkopdracht, veld_werktekening,
  medewerker_labels
)
select
  t.id,
  '90152805075',
  array['901517814355'],                            -- alleen Diemen; Leek staat nog niet goed
  'ff7ef212-2c46-493d-82af-61fe92f691a1',           -- Medewerkers (32 namen)
  '5c4e4802-7d44-43d3-8f6c-c9bd69c3c5ef',           -- Start datum
  '796f74c4-da2b-464f-8282-7d761051b00c',           -- Opleverdatum
  '5dae7e37-1cd9-4f6f-8b7d-21dbb9decf33',           -- Uitloopdatum
  '11a5838c-57f6-4fcb-9498-a17d3c0b8fd2',           -- Opdrachtnummer (alleen Diemen)
  '3b5d5d1f-b943-44a7-b98b-c85b0e856106',           -- Kluiscode
  'bf710a74-8343-49ea-9505-01ed6cc439e1',           -- Werkopdracht (PDF)
  '31147ab4-0949-4f2b-bb53-7e5baf9a4d67',           -- Werktekening (PDF) — bestaat op beide lijsten
  array[
    'Sami','Abdel','Mario','Murat','Mohammed','Orlando','Lani','Danny','Martijn','Justin',
    'Rene','Raphael','George','Sam','Csaba','Petev','Ivaylo','Malcho','Jordy','Jeffrey',
    'Thimmothy','Bjorn','Brian','Thimmoty','Mohamed','Romeo','Sergio','Gregory','Jermain',
    'Muzzamil','Johan','Raymichel'
  ]
from public.tenants t
where t.naam = 'Nooitmeerzwam'
on conflict (tenant_id) do update
  set space_id          = excluded.space_id,
      lijst_ids         = excluded.lijst_ids,
      veld_medewerkers  = excluded.veld_medewerkers,
      medewerker_labels = excluded.medewerker_labels,
      bijgewerkt_op     = now();


-- ── D. VERIFICATIE ────────────────────────────────────────────

select 'instellingen aanwezig' as controle,
       (select count(*)::text from public.clickup_instellingen) as gevonden, '1' as verwacht
union all
select 'aantal lijsten',
       (select array_length(lijst_ids, 1)::text from public.clickup_instellingen limit 1), '1'
union all
select 'aantal namen uit ClickUp',
       (select array_length(medewerker_labels, 1)::text from public.clickup_instellingen limit 1), '32'
union all
select 'synchronisatie actief',
       (select case when actief then 'ja' else 'nee (bewust)' end from public.clickup_instellingen limit 1),
       'nee (bewust)';

commit;

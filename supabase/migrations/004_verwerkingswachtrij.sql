-- ============================================================
-- NMZ GO — Migratie 004: verwerkingswachtrij
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Fase 1 van Epic 4: de serverlaag en de verwerkingswachtrij.
-- Bewust nog zonder ClickUp — dit legt het patroon vast op iets
-- ongevaarlijks, zodat fase 2 er alleen nog taaksoorten bij hoeft
-- te zetten.
--
-- Bevat:
--   A. verwerkingstaken   — de wachtrij zelf
--   B. verwerkingsronden  — het rondelogboek
--   C. claim-functie      — met skip locked tegen dubbel werk
--   D. afrondfuncties     — geslaagd / mislukt / onverwerkbaar
--   E. RLS                — beheerder leest, alleen server schrijft
--   F. pg_cron + pg_net   — de periodieke starter
--
-- Voegt alleen toe. Verwijdert geen tabellen, kolommen of data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. VERWERKINGSTAKEN ───────────────────────────────────────
-- Eén rij per stuk werk. Het architectuurdocument vraagt om
-- "een taak met een status, een aantal pogingen en een resultaat" —
-- geen losse achtergrondbelofte.
--
-- Over de statussen:
--   wachtend      klaar om opgepakt te worden vanaf beschikbaar_vanaf
--   bezig         geclaimd door een verwerker
--   geslaagd      afgerond, resultaat gevuld
--   mislukt       tijdelijke fout; gaat terug naar wachtend zolang
--                 er pogingen over zijn
--   onverwerkbaar blijvende fout; wordt niet opnieuw geprobeerd en
--                 is zichtbaar op het beheerdersscherm
--
-- Het onderscheid mislukt/onverwerkbaar komt uit de foutafhandeling
-- in sectie 03 van het architectuurdocument: een netwerkfout hoort
-- opnieuw geprobeerd te worden, een verwijderd item niet.

create table if not exists public.verwerkingstaken (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null default public.get_mijn_tenant()
                      references public.tenants(id) on delete cascade,

  soort             text        not null,
  payload           jsonb       not null default '{}'::jsonb,

  status            text        not null default 'wachtend'
                      check (status in ('wachtend','bezig','geslaagd','mislukt','onverwerkbaar')),

  pogingen          integer     not null default 0,
  max_pogingen      integer     not null default 5,

  -- Zolang now() hier nog niet voorbij is, blijft de taak liggen.
  -- Dit is het enige mechanisme voor uitgestelde herhaling.
  beschikbaar_vanaf timestamptz not null default now(),

  prioriteit        integer     not null default 100,

  resultaat         jsonb,
  fout              text,

  -- Alles wat uit één gebeurtenis voortkomt draagt hetzelfde
  -- volgnummer. Nu nog nauwelijks nuttig, maar met terugwerkende
  -- kracht niet meer te vullen zodra fase 2 draait.
  volgnummer        uuid        not null default gen_random_uuid(),

  geclaimd_op       timestamptz,
  afgerond_op       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- De claim-query sorteert op prioriteit en beschikbaar_vanaf binnen
-- status 'wachtend'; deze index bedient precies dat pad.
create index if not exists idx_verwerkingstaken_klaarstaand
  on public.verwerkingstaken (status, beschikbaar_vanaf, prioriteit)
  where status = 'wachtend';

create index if not exists idx_verwerkingstaken_tenant_status
  on public.verwerkingstaken (tenant_id, status);

create index if not exists idx_verwerkingstaken_volgnummer
  on public.verwerkingstaken (volgnummer);

drop trigger if exists verwerkingstaken_updated_at on public.verwerkingstaken;
create trigger verwerkingstaken_updated_at
  before update on public.verwerkingstaken
  for each row execute function public.update_updated_at();


-- ── B. VERWERKINGSRONDEN ──────────────────────────────────────
-- Eén rij per aanroep van de verwerker. Sectie 03 schrijft dit voor:
-- wanneer gestart, welke tenant, hoeveel bekeken, hoeveel gewijzigd,
-- hoeveel mislukt, hoe lang het duurde.

create table if not exists public.verwerkingsronden (
  id           uuid        primary key default gen_random_uuid(),
  gestart_op   timestamptz not null default now(),
  geeindigd_op timestamptz,
  aanleiding   text        not null default 'cron'
                 check (aanleiding in ('cron','handmatig')),
  bekeken      integer     not null default 0,
  geslaagd     integer     not null default 0,
  mislukt      integer     not null default 0,
  duur_ms      integer,
  fout         text
);

create index if not exists idx_verwerkingsronden_gestart
  on public.verwerkingsronden (gestart_op desc);


-- ── C. CLAIM-FUNCTIE ──────────────────────────────────────────
-- `for update skip locked` zorgt dat twee gelijktijdige verwerkers
-- nooit dezelfde taak pakken: wie als tweede komt, slaat de al
-- vergrendelde rijen over in plaats van erop te wachten.
--
-- Draait als SECURITY DEFINER omdat de verwerker met service_role
-- werkt en RLS hier sowieso niet mag meespelen.

create or replace function public.claim_verwerkingstaken(aantal integer default 10)
  returns setof public.verwerkingstaken
  language sql
  volatile
  security definer
  set search_path = public
as $$
  update public.verwerkingstaken t
     set status      = 'bezig',
         pogingen    = t.pogingen + 1,
         geclaimd_op = now()
   where t.id in (
     select id from public.verwerkingstaken
      where status = 'wachtend'
        and beschikbaar_vanaf <= now()
      order by prioriteit, beschikbaar_vanaf
      limit greatest(aantal, 0)
      for update skip locked
   )
  returning t.*;
$$;

revoke execute on function public.claim_verwerkingstaken(integer) from public, anon, authenticated;


-- ── D. AFRONDEN ───────────────────────────────────────────────

create or replace function public.taak_geslaagd(taak_id uuid, uitkomst jsonb default '{}'::jsonb)
  returns void
  language sql
  volatile
  security definer
  set search_path = public
as $$
  update public.verwerkingstaken
     set status = 'geslaagd', resultaat = uitkomst, fout = null, afgerond_op = now()
   where id = taak_id;
$$;

-- Een tijdelijke fout gaat terug naar de wachtrij met een oplopende
-- wachttijd plus willekeurige spreiding. Die spreiding is geen
-- franje: bij de wekelijkse bulkomzetting in ClickUp (fase 2) zouden
-- tientallen taken anders in hetzelfde ritme opnieuw aankloppen en
-- samen de snelheidslimiet raken.
--
-- Zijn de pogingen op, dan is het alsnog onverwerkbaar — anders
-- blijft een taak eeuwig rondzingen.
create or replace function public.taak_mislukt(taak_id uuid, reden text)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  t public.verwerkingstaken;
  wacht interval;
begin
  select * into t from public.verwerkingstaken where id = taak_id;
  if not found then
    return;
  end if;

  if t.pogingen >= t.max_pogingen then
    update public.verwerkingstaken
       set status = 'onverwerkbaar',
           fout = reden || ' (na ' || t.pogingen || ' pogingen)',
           afgerond_op = now()
     where id = taak_id;
    return;
  end if;

  -- 2^pogingen seconden, plus 0-30% spreiding.
  wacht := make_interval(secs => power(2, least(t.pogingen, 10))::double precision
                                 * (1 + random() * 0.3));

  update public.verwerkingstaken
     set status = 'wachtend',
         fout = reden,
         beschikbaar_vanaf = now() + wacht,
         geclaimd_op = null
   where id = taak_id;
end;
$$;

-- Blijvende fout: niet opnieuw proberen, wel zichtbaar houden.
create or replace function public.taak_onverwerkbaar(taak_id uuid, reden text)
  returns void
  language sql
  volatile
  security definer
  set search_path = public
as $$
  update public.verwerkingstaken
     set status = 'onverwerkbaar', fout = reden, afgerond_op = now()
   where id = taak_id;
$$;

-- Opnieuw aanbieden vanaf het beheerdersscherm. Dit is de enige
-- schrijfactie die een beheerder op de wachtrij mag doen, en de
-- reden dat hij als aparte functie bestaat in plaats van als
-- update-policy: zo ligt precies vast wát er gewijzigd mag worden.
create or replace function public.taak_opnieuw(taak_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
begin
  if public.get_mijn_rol() <> 'beheerder' then
    raise exception 'Alleen een beheerder mag een taak opnieuw aanbieden'
      using errcode = '42501';
  end if;

  update public.verwerkingstaken
     set status = 'wachtend',
         pogingen = 0,
         fout = null,
         beschikbaar_vanaf = now(),
         geclaimd_op = null,
         afgerond_op = null
   where id = taak_id
     and tenant_id = public.get_mijn_tenant()
     and status in ('mislukt','onverwerkbaar');
end;
$$;

revoke execute on function public.taak_geslaagd(uuid, jsonb)     from public, anon, authenticated;
revoke execute on function public.taak_mislukt(uuid, text)       from public, anon, authenticated;
revoke execute on function public.taak_onverwerkbaar(uuid, text) from public, anon, authenticated;
revoke execute on function public.taak_opnieuw(uuid)             from public, anon;
grant  execute on function public.taak_opnieuw(uuid)             to authenticated;


-- ── E. RLS ────────────────────────────────────────────────────
-- Lezen: alleen een beheerder, alleen binnen de eigen tenant.
-- Schrijven: niemand via de API. De verwerker gebruikt service_role
-- en die gaat sowieso langs RLS heen; een beheerder schrijft via
-- taak_opnieuw(). Dit is het principe uit sectie 02: achtergrondwerk
-- schrijft via een smalle, expliciet benoemde set operaties.

alter table public.verwerkingstaken  enable row level security;
alter table public.verwerkingsronden enable row level security;

drop policy if exists "verwerkingstaken_select" on public.verwerkingstaken;
create policy "verwerkingstaken_select"
  on public.verwerkingstaken for select
  using ( tenant_id = public.get_mijn_tenant() and public.get_mijn_rol() = 'beheerder' );

-- Ronden zijn niet tenant-gebonden: één verwerker bedient alle
-- tenants. Er staat geen klantgegeven in — alleen aantallen.
drop policy if exists "verwerkingsronden_select" on public.verwerkingsronden;
create policy "verwerkingsronden_select"
  on public.verwerkingsronden for select
  using ( public.get_mijn_rol() = 'beheerder' );


-- ── F. TAAK AANMAKEN ──────────────────────────────────────────
-- Eén ingang om werk in de wachtrij te zetten, zodat fase 2 niet
-- overal losse inserts hoeft te strooien.

create or replace function public.taak_aanmaken(
  p_soort      text,
  p_payload    jsonb   default '{}'::jsonb,
  p_volgnummer uuid    default null,
  p_prioriteit integer default 100
)
  returns uuid
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare nieuw_id uuid;
begin
  if auth.uid() is not null and public.get_mijn_rol() <> 'beheerder' then
    raise exception 'Alleen een beheerder mag een verwerkingstaak aanmaken'
      using errcode = '42501';
  end if;

  insert into public.verwerkingstaken (soort, payload, volgnummer, prioriteit)
  values (p_soort, p_payload, coalesce(p_volgnummer, gen_random_uuid()), p_prioriteit)
  returning id into nieuw_id;

  return nieuw_id;
end;
$$;

revoke execute on function public.taak_aanmaken(text, jsonb, uuid, integer) from public, anon;
grant  execute on function public.taak_aanmaken(text, jsonb, uuid, integer) to authenticated;

commit;


-- ── G. PERIODIEKE STARTER ─────────────────────────────────────
-- Buiten de transactie hierboven: create extension op pg_cron/pg_net
-- hoort niet in een transactieblok met de rest.
--
-- De cron roept de Edge Function elke minuut aan. De service_role-
-- sleutel staat in Vault en niet in deze migratie — een sleutel
-- hoort niet in een bestand dat in git belandt.
--
-- Vóór het eerste gebruik eenmalig zetten:
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

create or replace function public.start_verwerker()
  returns bigint
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_url   text;
  v_key   text;
  v_req   bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is null or v_key is null then
    raise notice 'start_verwerker: project_url of service_role_key ontbreekt in Vault';
    return null;
  end if;

  select net.http_post(
    url     := v_url || '/functions/v1/verwerker',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object('aanleiding','cron'),
    timeout_milliseconds := 30000
  ) into v_req;

  return v_req;
end;
$$;

revoke execute on function public.start_verwerker() from public, anon, authenticated;

-- Idempotent: eerst weg, dan opnieuw.
select cron.unschedule('nmzgo-verwerker')
where exists (select 1 from cron.job where jobname = 'nmzgo-verwerker');

select cron.schedule('nmzgo-verwerker', '* * * * *', $$select public.start_verwerker();$$);


-- ── H. VERIFICATIE ────────────────────────────────────────────

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename like 'verwerkings%'
order by tablename, policyname;

select jobname, schedule, active from cron.job where jobname = 'nmzgo-verwerker';

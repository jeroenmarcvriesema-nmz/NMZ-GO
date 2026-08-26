-- 040 — Op welke afstand meldde iemand zich aan
--
-- De vraag was of een monteur pas kan aanmelden binnen honderd meter
-- van de klus. Dat is gebouwd als het tegenovergestelde van een slot:
-- aanmelden lukt altijd, en de afstand wordt vastgelegd. Wijkt hij af,
-- dan weet kantoor het en de ploeg niet.
--
-- Waarom niet blokkeren: een telefoon tussen hoge gevels meldt
-- routinematig twintig tot vijftig meter afwijking, en met een slecht
-- signaal meer dan honderd. Een harde grens houdt dan mannen tegen die
-- precies voor de goede deur staan. Bovendien zijn sommige adressen in
-- dit bestand geen punt maar een reeks — "Rembrandstraat 79 t/m 129" —
-- en die geocoderen naar het midden van een straat.
--
-- ── Waarom een eigen tabel ──
-- RLS werkt per rij en niet per kolom. Zetten we de positie op
-- `werkdag_logs`, dan mag de monteur zijn eigen rij lezen en dus ook
-- zijn eigen afstand — en juist dat wilden we niet. Hier schrijft hij
-- wél en leest hij niet: de insert-policy laat zijn eigen regel toe, de
-- select-policy alleen kantoor.
--
-- ── Waarom de afstand hier wordt uitgerekend ──
-- De telefoon stuurt alleen zijn positie. Zou hij de afstand meesturen,
-- dan is het een getal dat de gemeten partij zelf heeft ingevuld. De
-- database rekent hem uit tegen de coördinaten van de werkbon.

-- ── Coördinaten op de werkbon ───────────────────────────────
alter table public.werkbonnen
  add column if not exists latitude    double precision,
  add column if not exists longitude   double precision,
  add column if not exists geocode_op  timestamptz,
  add column if not exists geocode_bron text;

comment on column public.werkbonnen.latitude is
  'Coordinaat van het werkadres, opgezocht bij het importeren. Leeg als het adres niet te plaatsen was.';

create index if not exists werkbonnen_zonder_coordinaat_idx
  on public.werkbonnen (id) where latitude is null;


-- ── Hoe ver ligt dat uit elkaar ─────────────────────────────
create or replace function public.afstand_meters(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
  language sql immutable
as $$
  -- Haversine. Over de afstanden waar het hier om gaat — tientallen tot
  -- honderden meters — is de aardbol een prima bol.
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;


-- ── Waar iemand stond toen hij zich aanmeldde ───────────────
create table if not exists public.werkdag_locaties (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete restrict,
  werkdag_log_id    uuid not null references public.werkdag_logs(id) on delete cascade,
  werkbon_id        uuid not null references public.werkbonnen(id) on delete cascade,
  medewerker_id     uuid not null references public.profiles(id) on delete cascade,

  latitude          double precision not null,
  longitude         double precision not null,
  -- Wat de telefoon zelf zegt over zijn zekerheid. Zonder dit getal is
  -- een afstand van tachtig meter niet te onderscheiden van een
  -- telefoon die het even niet weet.
  nauwkeurigheid_m  double precision,

  -- Serverkant ingevuld. Blijft leeg als de werkbon geen coordinaat heeft.
  afstand_m         double precision,

  created_at        timestamptz not null default now(),

  constraint werkdag_locaties_uniek unique (werkdag_log_id)
);

comment on table public.werkdag_locaties is
  'Waar iemand stond bij het aanmelden. Alleen leesbaar voor kantoor: de ploeg schrijft hier wel, maar ziet het niet terug.';

create index if not exists werkdag_locaties_werkbon_idx
  on public.werkdag_locaties (werkbon_id, created_at desc);

alter table public.werkdag_locaties enable row level security;

-- Schrijven: je eigen aanmelding, in je eigen tenant.
drop policy if exists werkdag_locaties_insert on public.werkdag_locaties;
create policy werkdag_locaties_insert on public.werkdag_locaties
  for insert to authenticated
  with check (
    tenant_id = public.get_mijn_tenant()
    and medewerker_id = auth.uid()
  );

-- Lezen: alleen kantoor. Dit is de hele reden dat deze tabel apart
-- staat; zet je dit op werkdag_logs, dan leest de monteur zijn eigen
-- afstand mee.
drop policy if exists werkdag_locaties_select on public.werkdag_locaties;
create policy werkdag_locaties_select on public.werkdag_locaties
  for select to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren());


-- ── De afstand uitrekenen en zo nodig melden ────────────────
-- Honderd meter, met de onnauwkeurigheid van de telefoon eraf. Meldt de
-- telefoon "tweehonderd meter, plus of min honderdvijftig", dan is dat
-- geen afwijking maar een slecht signaal, en daar hoeft niemand een
-- bericht over te krijgen.
create or replace function public.meld_afstand_bij_aanmelden()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_lat   double precision;
  v_lon   double precision;
  v_adres text;
  v_naam  text;
  v_zeker double precision;
begin
  select latitude, longitude, adres into v_lat, v_lon, v_adres
    from public.werkbonnen where id = new.werkbon_id;

  if v_lat is null or v_lon is null then
    return new;  -- Geen coordinaat op de bon: niets om tegen te meten.
  end if;

  new.afstand_m := public.afstand_meters(v_lat, v_lon, new.latitude, new.longitude);

  v_zeker := new.afstand_m - coalesce(new.nauwkeurigheid_m, 0);
  if v_zeker <= 100 then
    return new;
  end if;

  select naam into v_naam from public.profiles where id = new.medewerker_id;

  insert into public.meldingen (tenant_id, voor_profile_id, soort, tekst, werkbon_id)
  select new.tenant_id, pr.id, 'aanmelding_ver_weg',
         coalesce(v_naam, 'Iemand') || ' meldde zich aan op ' ||
           round(new.afstand_m)::text || ' m van ' ||
           coalesce(v_adres, 'de klus') ||
           case when new.nauwkeurigheid_m is not null
                then ' (telefoon: ±' || round(new.nauwkeurigheid_m)::text || ' m)'
                else '' end,
         new.werkbon_id
    from public.profiles pr
   where pr.tenant_id = new.tenant_id
     and pr.rol in ('eigenaar', 'beheerder', 'uitvoerder', 'werkvoorbereider', 'planner');

  return new;
end;
$$;

drop trigger if exists meld_afstand_bij_aanmelden on public.werkdag_locaties;
create trigger meld_afstand_bij_aanmelden
  before insert on public.werkdag_locaties
  for each row execute function public.meld_afstand_bij_aanmelden();


-- ── De ronde inplannen ──────────────────────────────────────
-- Zelfde vorm als de andere hartslagen: zet een taak klaar zolang er
-- werk is, en niet nog een als er al één in de wachtrij staat.
--
-- Stopt vanzelf zodra elke werkbon een stempel heeft. Een adres dat
-- niet te vinden was krijgt dat stempel ook — anders zou dezelfde
-- onvindbare klus elke ronde de rest voor zich uit blijven schuiven.
create or replace function public.geocode_hartslag()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant record;
  v_aantal integer := 0;
begin
  for v_tenant in select id from public.tenants
  loop
    if not exists (
      select 1 from public.werkbonnen
       where tenant_id = v_tenant.id
         and latitude is null
         and geocode_op is null
    ) then
      continue;
    end if;

    if exists (
      select 1 from public.verwerkingstaken
       where soort = 'onderhoud.geocoderen'
         and tenant_id = v_tenant.id
         and status not in ('geslaagd', 'mislukt', 'onverwerkbaar')
    ) then
      continue;
    end if;

    perform public.taak_aanmaken(
      'onderhoud.geocoderen',
      jsonb_build_object('tenant_id', v_tenant.id, 'aantal', 10),
      null,
      200);
    v_aantal := v_aantal + 1;
  end loop;

  return v_aantal;
end;
$$;

select cron.schedule(
  'nmzgo-geocoderen',
  '*/10 * * * *',
  $cron$ select public.geocode_hartslag(); $cron$
);

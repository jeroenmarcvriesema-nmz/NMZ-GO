-- ============================================================
-- NMZ GO — Migratie 015: stilleggen, opleveren en meldingen
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Drie dingen die een klus kan overkomen nadat hij is ingepland, en
-- die alle drie in ClickUp terug moeten komen omdat de planning daar
-- leeft.
--
--   stilleggen  — geen compleet koppel, asbest aangetroffen, een klus
--                 met meer haast ertussen. Altijd mét reden: zonder
--                 reden weet niemand volgende week meer waarom, en dan
--                 is de melding waardeloos.
--   hervatten   — hij gaat weer door.
--   opleveren   — de zwamsaneerder is klaar, kantoor bevestigt.
--
-- Over de reden: geen keuzelijst. Wie een klus stillegt heeft haast en
-- moet kunnen opschrijven wat er is, niet zoeken in een menu dat toch
-- nooit compleet is. De ClickUp-status volgt uit wat er staat — noemt
-- iemand asbest, dan gaat de taak naar de asbeststatus. Verder is het
-- gewoon "on hold".
--
-- Over het opschuiven: alleen de bon die je stillegt schuift een dag
-- op. De klus erna schuift níet automatisch mee. Die overlap wordt
-- gesignaleerd en gemeld, zodat een mens beslist. Een hele keten
-- automatisch doorschuiven gaat goed tot de aanname niet klopt, en dan
-- staat er maandag een ploeg voor een deur waar niemand ze verwacht.
-- ============================================================

begin;

-- ── A. WAT ER MET DE BON GEBEURT ─────────────────────────────

alter table public.werkbonnen
  add column if not exists stilgelegd_op    timestamptz,
  add column if not exists stilleg_reden    text,
  add column if not exists stilgelegd_door  uuid references public.profiles(id) on delete set null,
  add column if not exists opgeleverd_op    timestamptz,
  add column if not exists opgeleverd_door  uuid references public.profiles(id) on delete set null;

comment on column public.werkbonnen.stilleg_reden is
  'Vrije tekst, verplicht. Bepaalt ook welke ClickUp-status de taak krijgt.';

-- De volledige geschiedenis, los van de huidige stand. Een bon die
-- drie keer is stilgelegd vertelt iets anders dan een bon die één keer
-- stillag, en dat verschil is precies wat je wilt zien als je achteraf
-- naar uitloop kijkt.
create table if not exists public.werkbon_gebeurtenissen (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete restrict,
  werkbon_id uuid not null references public.werkbonnen(id) on delete cascade,
  soort      text not null check (soort in ('stilgelegd', 'hervat', 'opgeleverd')),
  reden      text,
  door       uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists werkbon_gebeurtenissen_bon_idx
  on public.werkbon_gebeurtenissen (werkbon_id, created_at desc);

alter table public.werkbon_gebeurtenissen enable row level security;

-- Lezen mag wie bij de bon mag; schrijven gebeurt alleen via de
-- functies hieronder, nooit rechtstreeks.
drop policy if exists "gebeurtenissen_select" on public.werkbon_gebeurtenissen;
create policy "gebeurtenissen_select"
  on public.werkbon_gebeurtenissen for select
  to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_bij_werkbon(werkbon_id));


-- ── B. MELDINGEN ─────────────────────────────────────────────

create table if not exists public.meldingen (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete restrict,
  voor_profile_id   uuid not null references public.profiles(id) on delete cascade,
  soort             text not null,
  tekst             text not null,
  werkbon_id        uuid references public.werkbonnen(id) on delete cascade,
  gelezen_op        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists meldingen_voor_idx
  on public.meldingen (voor_profile_id, gelezen_op nulls first, created_at desc);

alter table public.meldingen enable row level security;

-- Je eigen meldingen, en niemand anders die van jou.
drop policy if exists "meldingen_select" on public.meldingen;
create policy "meldingen_select"
  on public.meldingen for select
  to authenticated
  using (voor_profile_id = auth.uid());

drop policy if exists "meldingen_update" on public.meldingen;
create policy "meldingen_update"
  on public.meldingen for update
  to authenticated
  using      (voor_profile_id = auth.uid())
  with check (voor_profile_id = auth.uid());

-- Wie krijgt planningsmeldingen? De eigenaar altijd, en verder wie
-- daarvoor aangezet is — bij ons is dat de planner.
alter table public.profiles
  add column if not exists planningsmeldingen boolean not null default false;

update public.profiles set planningsmeldingen = true where rol = 'eigenaar';


-- ── C. DE CLICKUP-STATUSSEN ──────────────────────────────────
-- De namen staan in de instellingen, niet in de code: dan kan een
-- statusnaam in ClickUp veranderen zonder dat er iets uitgerold hoeft
-- te worden.

alter table public.clickup_instellingen
  add column if not exists status_stilgelegd         text default 'on hold',
  add column if not exists status_asbest             text default 'onhold door asbest',
  add column if not exists status_opnieuw_inplannen  text default 'opnieuw inplannen/later';


-- ── D. STILLEGGEN ────────────────────────────────────────────

create or replace function public.werkbon_stilleggen(p_werkbon uuid, p_reden text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant   uuid := public.get_mijn_tenant();
  v_reden    text := btrim(coalesce(p_reden, ''));
  v_bon      public.werkbonnen%rowtype;
  v_overlap  jsonb := '[]'::jsonb;
  v_rij      record;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan een klus stilleggen'
      using errcode = '42501';
  end if;

  -- Dit is de kern van de afspraak: zonder reden gaat het commando niet
  -- door. Niet in het scherm afgevangen maar hier, zodat het ook geldt
  -- voor een aanroep die het scherm overslaat.
  if length(v_reden) < 3 then
    raise exception 'Geef een reden op waarom de klus wordt stilgelegd'
      using errcode = '23514';
  end if;

  select * into v_bon from public.werkbonnen
   where id = p_werkbon and tenant_id = v_tenant;

  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  if v_bon.opgeleverd_op is not null then
    raise exception 'Deze klus is al opgeleverd en kan niet stilgelegd worden'
      using errcode = '23514';
  end if;

  update public.werkbonnen
     set stilgelegd_op   = now(),
         stilleg_reden   = v_reden,
         stilgelegd_door = auth.uid(),
         -- Eén dag. De regel is dat ze de volgende dag terugkomen om
         -- op te leveren; uitzonderingen daargelaten, en die vang je
         -- op door nog een keer te drukken.
         geplande_eind   = coalesce(geplande_eind, datum) + 1
   where id = p_werkbon;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'stilgelegd', v_reden, auth.uid());

  -- Overlap: staat een van deze mensen in de nieuwe periode ook ergens
  -- anders? Dat is geen fout maar wel iets wat iemand moet zien.
  for v_rij in
    select distinct w2.id, w2.adres, w2.geplande_start, pe.naam
    from public.werkbon_medewerkers wm1
    join public.werkbon_medewerkers wm2 on wm2.persoon_id = wm1.persoon_id
    join public.personen  pe on pe.id = wm1.persoon_id
    join public.werkbonnen w2 on w2.id = wm2.werkbon_id
    where wm1.werkbon_id = p_werkbon
      and w2.id <> p_werkbon
      and w2.tenant_id = v_tenant
      and w2.opgeleverd_op is null
      and w2.stilgelegd_op is null
      and w2.geplande_start is not null
      and w2.geplande_start <= (coalesce(v_bon.geplande_eind, v_bon.datum) + 1)
      and coalesce(w2.geplande_eind, w2.geplande_start) >= coalesce(v_bon.geplande_start, v_bon.datum)
  loop
    v_overlap := v_overlap || jsonb_build_object(
      'werkbon_id', v_rij.id, 'adres', v_rij.adres,
      'medewerker', v_rij.naam, 'start', v_rij.geplande_start);

    insert into public.meldingen (tenant_id, voor_profile_id, soort, tekst, werkbon_id)
    select v_tenant, pr.id, 'overlap',
           format('%s is stilgelegd (%s). %s staat daardoor mogelijk in de knel: %s begint %s.',
                  v_bon.adres, v_reden, v_rij.naam, v_rij.adres,
                  to_char(v_rij.geplande_start, 'DD-MM')),
           p_werkbon
    from public.profiles pr
    where pr.tenant_id = v_tenant
      and (pr.rol = 'eigenaar' or pr.planningsmeldingen);
  end loop;

  -- De terugkoppeling naar ClickUp loopt via de wachtrij: als ClickUp
  -- er even uit ligt, blijft de taak staan en wordt hij opnieuw
  -- geprobeerd. Het stilleggen zelf mag daar nooit op wachten.
  perform public.taak_aanmaken(
    'clickup.status_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'stilgelegd'));

  return jsonb_build_object(
    'stilgelegd', true,
    'nieuwe_einddatum', (select geplande_eind from public.werkbonnen where id = p_werkbon),
    'overlap', v_overlap);
end;
$$;


-- ── E. HERVATTEN ─────────────────────────────────────────────
-- Zonder dit blijft een klus voor altijd stilliggen.
--
-- Let op: de einddatum gaat hiermee níet terug. Die dag is echt kwijt
-- — dat is de hele reden dat er stilgelegd werd. Terugdraaien zou de
-- planning laten liegen over wat er werkelijk gebeurd is.

create or replace function public.werkbon_hervatten(p_werkbon uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan een klus hervatten'
      using errcode = '42501';
  end if;

  update public.werkbonnen
     set stilgelegd_op = null, stilleg_reden = null, stilgelegd_door = null
   where id = p_werkbon and tenant_id = v_tenant and stilgelegd_op is not null;

  if not found then
    raise exception 'Werkbon niet gevonden of lag niet stil' using errcode = 'P0002';
  end if;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, door)
  values (v_tenant, p_werkbon, 'hervat', auth.uid());

  perform public.taak_aanmaken(
    'clickup.status_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'hervat'));

  return jsonb_build_object('hervat', true);
end;
$$;


-- ── F. OPLEVEREN ─────────────────────────────────────────────
-- De zwamsaneerder zet de bon op voltooid — dat kan alleen als elk
-- punt met fotoplicht een foto heeft (migratie 011). Kantoor bevestigt
-- daarna, en pas dán gaat ClickUp op opgeleverd.

create or replace function public.werkbon_opleveren(p_werkbon uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_status text;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan een klus opleveren'
      using errcode = '42501';
  end if;

  select status into v_status from public.werkbonnen
   where id = p_werkbon and tenant_id = v_tenant;

  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  if v_status <> 'voltooid' then
    raise exception 'Deze klus staat nog niet op voltooid; de zwamsaneerder moet hem eerst afronden'
      using errcode = '23514';
  end if;

  update public.werkbonnen
     set opgeleverd_op = now(), opgeleverd_door = auth.uid()
   where id = p_werkbon and opgeleverd_op is null;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, door)
  values (v_tenant, p_werkbon, 'opgeleverd', auth.uid());

  perform public.taak_aanmaken(
    'clickup.status_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'opgeleverd'));

  return jsonb_build_object('opgeleverd', true);
end;
$$;


-- ── G. VERIFICATIE ────────────────────────────────────────────

select 'stilleg-kolommen op de werkbon' as controle,
       (select count(*)::text from information_schema.columns
        where table_schema='public' and table_name='werkbonnen'
          and column_name in ('stilgelegd_op','stilleg_reden','stilgelegd_door',
                              'opgeleverd_op','opgeleverd_door')) as gevonden,
       '5' as verwacht
union all
select 'de drie functies bestaan',
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public'
          and p.proname in ('werkbon_stilleggen','werkbon_hervatten','werkbon_opleveren')), '3'
union all
select 'RLS staat aan op meldingen',
       (select case when relrowsecurity then 'ja' else 'NEE' end
        from pg_class where oid='public.meldingen'::regclass), 'ja'
union all
select 'RLS staat aan op gebeurtenissen',
       (select case when relrowsecurity then 'ja' else 'NEE' end
        from pg_class where oid='public.werkbon_gebeurtenissen'::regclass), 'ja'
union all
select 'eigenaar ontvangt planningsmeldingen',
       (select count(*)::text from public.profiles where planningsmeldingen), '1 of meer';

commit;

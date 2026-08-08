-- ============================================================
-- NMZ GO — Migratie 014: personenregister
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Een naam moet kunnen bestaan vóórdat er een account bij hoort.
--
-- Tot nu toe was "wie werkt er op deze klus" een verwijzing naar een
-- profiel, en een profiel bestaat alleen als er een account is. Daarmee
-- was er geen plek voor de zesendertig namen die in ClickUp op de
-- planning staan maar nog nooit hebben ingelogd. De synchronisatie zag
-- ze wel — "22 namen zonder account" — en gooide ze daarna weg.
--
-- Dat is precies verkeerd om. De planning in ClickUp is het uitgangspunt
-- en die kent alleen namen. Of daar een account bij hoort is een aparte
-- vraag, en bij een pilot met vier man is het antwoord voor de meesten
-- "nog niet".
--
-- Dus: een register van personen. De koppeling werkbon → persoon is
-- altijd volledig; de koppeling persoon → account is optioneel en kan
-- later. Zodra iemand zijn uitnodiging inwisselt, ziet hij zijn
-- volledige geschiedenis staan — er hoeft niets bijgewerkt te worden,
-- want de werkbonnen wezen al naar hem.
-- ============================================================

begin;

-- ── A. HET REGISTER ──────────────────────────────────────────

create table if not exists public.personen (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete restrict,
  naam          text not null,
  -- De naam zoals hij in het ClickUp-label staat. Dat is de sleutel
  -- waarop de synchronisatie koppelt; hij kan afwijken van de naam die
  -- iemand zelf bij zijn account opgeeft.
  clickup_label text,
  -- Leeg zolang er geen account is. Dat is de normale toestand.
  profile_id    uuid unique references public.profiles(id) on delete set null,
  actief        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists personen_label_uniek
  on public.personen (tenant_id, clickup_label)
  where clickup_label is not null;

create index if not exists personen_tenant_idx on public.personen (tenant_id);

comment on table public.personen is
  'De ploeg. Bestaat los van accounts: een naam staat hier zodra hij in '
  'ClickUp op de planning kan komen, een account volgt pas als iemand '
  'wordt uitgenodigd.';


-- ── B. DE NAMEN UIT CLICKUP ALVAST NEERZETTEN ────────────────
-- De labels staan al in de instellingen; die zijn de bron.

insert into public.personen (tenant_id, naam, clickup_label)
select i.tenant_id, l, l
from public.clickup_instellingen i,
     lateral unnest(i.medewerker_labels) l
on conflict do nothing;

-- Wie al een account heeft mét een label, wordt meteen gekoppeld.
update public.personen pe
   set profile_id = pr.id
  from public.profiles pr
 where pr.tenant_id = pe.tenant_id
   and pr.clickup_label is not null
   and pr.clickup_label = pe.clickup_label
   and pe.profile_id is null
   and not exists (select 1 from public.personen x where x.profile_id = pr.id);


-- ── C. TOEWIJZING GAAT VOORTAAN VIA DE PERSOON ───────────────
-- Zes policies leunen op de kolom die weg moet. Postgres laat hem
-- daarom niet los; ze gaan eerst weg en komen in blok E terug.

drop policy if exists "werkbonnen_select"            on public.werkbonnen;
drop policy if exists "werkbonnen_update_toegewezen" on public.werkbonnen;
drop policy if exists "taken_select"                 on public.taken;
drop policy if exists "taken_update"                 on public.taken;
drop policy if exists "fotos_select"                 on public.fotos;
drop policy if exists "werkbon_medewerkers_select"   on public.werkbon_medewerkers;

alter table public.werkbon_medewerkers
  add column if not exists persoon_id uuid references public.personen(id) on delete cascade;

-- Bestaande koppelingen liepen via een profiel. Voor elk profiel dat
-- ergens op een bon staat maar nog geen persoon is, maken we er één.
insert into public.personen (tenant_id, naam, clickup_label, profile_id)
select distinct pr.tenant_id, pr.naam, pr.clickup_label, pr.id
from public.profiles pr
join public.werkbon_medewerkers wm on wm.medewerker_id = pr.id
where not exists (select 1 from public.personen x where x.profile_id = pr.id)
on conflict do nothing;

update public.werkbon_medewerkers wm
   set persoon_id = pe.id
  from public.personen pe
 where pe.profile_id = wm.medewerker_id
   and wm.persoon_id is null;

-- Een koppeling zonder persoon is niet te herstellen en zou de
-- primaire sleutel blokkeren. In de praktijk is dit leeg.
delete from public.werkbon_medewerkers where persoon_id is null;

alter table public.werkbon_medewerkers drop constraint if exists werkbon_medewerkers_pkey;
alter table public.werkbon_medewerkers drop column if exists medewerker_id;
alter table public.werkbon_medewerkers alter column persoon_id set not null;
alter table public.werkbon_medewerkers add primary key (werkbon_id, persoon_id);

create index if not exists werkbon_medewerkers_persoon_idx
  on public.werkbon_medewerkers (persoon_id);


-- ── D. ÉÉN PLEK DIE WEET OF IK OP EEN BON STA ────────────────
-- Vijf policies stelden ieder afzonderlijk dezelfde vraag. Nu staat de
-- vraag één keer; een volgende wijziging is één functie in plaats van
-- vijf policies. Dezelfde reden waarom migratie 008 op bevoegdheden
-- ging toetsen in plaats van op rolnamen.

create or replace function public.mijn_persoon_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select id from public.personen where profile_id = auth.uid() limit 1;
$$;

comment on function public.mijn_persoon_id() is
  'Welke persoon ben ik? Leeg voor kantoor — die staan niet in de ploeg.';

create or replace function public.ben_ik_toegewezen(p_werkbon uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.werkbon_medewerkers wm
    join public.personen pe on pe.id = wm.persoon_id
    where wm.werkbon_id = p_werkbon
      and pe.profile_id = auth.uid()
  );
$$;

comment on function public.ben_ik_toegewezen(uuid) is
  'Sta ik als ingelogde gebruiker op deze werkbon? Via personen, zodat '
  'iemand zijn hele geschiedenis ziet zodra zijn account gekoppeld is.';


-- ── E. DE POLICIES OMZETTEN ──────────────────────────────────
-- Inhoudelijk verandert er niets aan wie wat mag; alleen de weg naar
-- het antwoord loopt nu via de persoon.

-- Zijn eigen toewijzingen, of alles als hij werk mag beheren. Via
-- mijn_persoon_id() zodat de policy niet zelf door de policies van
-- personen heen hoeft.
create policy "werkbon_medewerkers_select"
  on public.werkbon_medewerkers for select
  to authenticated
  using (
    tenant_id = public.get_mijn_tenant()
    and (persoon_id = public.mijn_persoon_id() or public.mag_werk_beheren())
  );

create policy "werkbonnen_select"
  on public.werkbonnen for select
  to authenticated
  using (
    tenant_id = public.get_mijn_tenant()
    and (public.mag_werk_beheren() or public.ben_ik_toegewezen(id))
  );

create policy "werkbonnen_update_toegewezen"
  on public.werkbonnen for update
  to authenticated
  using      (tenant_id = public.get_mijn_tenant() and public.ben_ik_toegewezen(id))
  with check (tenant_id = public.get_mijn_tenant() and public.ben_ik_toegewezen(id));

create policy "taken_select"
  on public.taken for select
  to authenticated
  using (
    tenant_id = public.get_mijn_tenant()
    and (public.mag_werk_beheren() or public.ben_ik_toegewezen(werkbon_id))
  );

-- Een zwamsaneerder vinkt af zolang de bon niet voltooid is; kantoor
-- mag altijd. Die grens blijft ongewijzigd.
create policy "taken_update"
  on public.taken for update
  to authenticated
  using (
    tenant_id = public.get_mijn_tenant()
    and (
      public.mag_werk_beheren()
      or (
        public.ben_ik_toegewezen(werkbon_id)
        and exists (
          select 1 from public.werkbonnen w
          where w.id = taken.werkbon_id and w.status <> 'voltooid'
        )
      )
    )
  );

create policy "fotos_select"
  on public.fotos for select
  to authenticated
  using (
    tenant_id = public.get_mijn_tenant()
    and (public.mag_werk_beheren() or public.ben_ik_toegewezen(werkbon_id))
  );


-- ── F. TWEE FUNCTIES DIE OOK OVER TOEWIJZING GINGEN ──────────

-- Deze toetste nog op de rolnaam 'beheerder' — blijven staan bij
-- migratie 008, toen alle policies naar bevoegdheden gingen. Gevolg:
-- een eigenaar, uitvoerder of werkvoorbereider kwam niet bij de foto's
-- en documenten van een bon waar hij zelf niet op stond. Dat is nooit
-- de bedoeling geweest.
create or replace function public.mag_bij_werkbon(p_werkbon uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.werkbonnen w
    where w.id = p_werkbon
      and w.tenant_id = public.get_mijn_tenant()
      and (public.mag_werk_beheren() or public.ben_ik_toegewezen(w.id))
  );
$$;

-- Geeft niet meer terug dan datum, adres en naam. Nu ook de namen van
-- collega's zonder account — juist bij een pilot is dat de helft van de
-- ploeg, en "wie werkt waar vandaag" zonder die namen is nutteloos.
create or replace function public.planning_overzicht(p_van date, p_tot date)
  returns table(datum date, adres text, plaats text, medewerker text)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select w.datum, w.adres, w.plaats, pe.naam
  from public.werkbonnen w
  join public.werkbon_medewerkers wm on wm.werkbon_id = w.id
  join public.personen pe on pe.id = wm.persoon_id
  where w.tenant_id = public.get_mijn_tenant()
    and w.datum between p_van and p_tot
  order by w.datum, pe.naam;
$$;


-- ── G. TOEGANG TOT HET REGISTER ──────────────────────────────
-- Iedereen binnen de tenant mag de namen lezen (ze staan al in het
-- planningsoverzicht); wijzigen is aan kantoor.

alter table public.personen enable row level security;

drop policy if exists "personen_select" on public.personen;
create policy "personen_select"
  on public.personen for select
  to authenticated
  using (tenant_id = public.get_mijn_tenant());

drop policy if exists "personen_schrijven" on public.personen;
create policy "personen_schrijven"
  on public.personen for insert
  to authenticated
  with check (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren());

drop policy if exists "personen_update" on public.personen;
create policy "personen_update"
  on public.personen for update
  to authenticated
  using      (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren())
  with check (tenant_id = public.get_mijn_tenant() and public.mag_werk_beheren());

drop policy if exists "personen_delete" on public.personen;
create policy "personen_delete"
  on public.personen for delete
  to authenticated
  using (tenant_id = public.get_mijn_tenant() and public.mag_gebruikers_beheren());

-- Wie een account heeft, mag niet zomaar losgekoppeld of weggegooid
-- worden door iemand die alleen werk mag beheren — dat is
-- gebruikersbeheer.
create or replace function public.guard_persoon_kolommen()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.profile_id is distinct from old.profile_id
     and not public.mag_gebruikers_beheren() then
    raise exception 'Alleen een beheerder kan een persoon aan een account koppelen'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_persoon_kolommen on public.personen;
create trigger guard_persoon_kolommen
  before update on public.personen
  for each row execute function public.guard_persoon_kolommen();


-- ── H. UITNODIGEN MET EEN NAAM EN EEN ROL ERBIJ ──────────────
-- Zonder dit moet iemand na het aanmaken van zijn account alsnog
-- handmatig aan een naam gekoppeld worden. Bij een pilot van vier man
-- is dat te doen; daarna niet meer, en juist dan gaat het mis.

alter table public.uitnodigingen
  add column if not exists persoon_id uuid references public.personen(id) on delete set null,
  add column if not exists rol text not null default 'medewerker';

alter table public.uitnodigingen drop constraint if exists uitnodigingen_rol_check;
alter table public.uitnodigingen add constraint uitnodigingen_rol_check
  check (rol in ('beheerder', 'uitvoerder', 'werkvoorbereider', 'medewerker'));

comment on column public.uitnodigingen.rol is
  'De rol die het nieuwe account krijgt. Bewust géén ''eigenaar'': die '
  'rol is niet uit te delen via een uitnodiging.';


-- ── I. DE KOPPELING BIJ HET AANMAKEN VAN EEN ACCOUNT ─────────

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_token   text := new.raw_user_meta_data->>'uitnodiging_token';
  v_tenant  uuid;
  v_persoon uuid;
  v_rol     text := 'medewerker';
begin
  -- Rol en persoon komen uit de uitnodiging, nooit uit de metadata van
  -- de aanmelding. Die metadata komt uit de browser en is dus door de
  -- aanmelder zelf te kiezen; de uitnodiging is aangemaakt door iemand
  -- die gebruikers mág beheren.
  if v_token is not null then
    update public.uitnodigingen
       set gebruikt = true
     where token = v_token
       and not gebruikt
       and (verloopt_op is null or verloopt_op > now())
    returning tenant_id, persoon_id, rol
      into v_tenant, v_persoon, v_rol;
  end if;

  v_tenant := coalesce(v_tenant, public.get_mijn_tenant());
  v_rol    := coalesce(v_rol, 'medewerker');

  -- De eerste gebruiker van een tenant wordt eigenaar, anders komt
  -- niemand er ooit meer in.
  if not exists (
    select 1 from public.profiles
    where tenant_id = v_tenant and rol in ('beheerder', 'eigenaar')
  ) then
    v_rol := 'eigenaar';
  end if;

  insert into public.profiles (id, naam, email, rol, tenant_id)
  values (
    new.id,
    coalesce(
      (select naam from public.personen where id = v_persoon),
      new.raw_user_meta_data->>'naam',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    v_rol,
    v_tenant
  )
  on conflict (id) do nothing;

  -- Hiermee ziet hij meteen alles waar hij op stond, ook het werk van
  -- vóór zijn account.
  if v_persoon is not null then
    update public.personen
       set profile_id = new.id
     where id = v_persoon and profile_id is null;
  end if;

  return new;
end;
$$;


-- ── J. VERIFICATIE ────────────────────────────────────────────

select 'personen uit ClickUp klaargezet' as controle,
       (select count(*)::text from public.personen) as gevonden,
       '32 of meer' as verwacht
union all
select 'geen toewijzing meer zonder persoon',
       (select case when count(*) = 0 then 'ja' else 'NEE — ' || count(*)::text end
        from public.werkbon_medewerkers where persoon_id is null), 'ja'
union all
select 'kolom medewerker_id is weg',
       (select case when count(*) = 0 then 'ja' else 'NEE' end
        from information_schema.columns
        where table_schema='public' and table_name='werkbon_medewerkers'
          and column_name='medewerker_id'), 'ja'
union all
select 'policies toetsen via ben_ik_toegewezen',
       (select count(*)::text from pg_policies
        where schemaname='public'
          and coalesce(qual,'')||coalesce(with_check,'') like '%ben_ik_toegewezen%'), '5'
union all
-- Alleen de toewijzing gaat via personen. werkdag_logs.medewerker_id
-- blijft een profiel: je moet ingelogd zijn om in te klokken, dus daar
-- ís altijd een account.
select 'geen policy toetst nog op werkbon_medewerkers.medewerker_id',
       (select case when count(*) = 0 then 'ja' else 'NEE' end from pg_policies
        where tablename in ('werkbonnen','taken','fotos','werkbon_medewerkers')
          and coalesce(qual,'')||coalesce(with_check,'') like '%medewerker_id%'), 'ja'
union all
select 'mag_bij_werkbon toetst op bevoegdheid, niet op rolnaam',
       (select case when pg_get_functiondef(p.oid) like '%mag_werk_beheren%'
                     and pg_get_functiondef(p.oid) not like '%= ''beheerder''%'
                    then 'ja' else 'NEE' end
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='mag_bij_werkbon'), 'ja'
union all
select 'uitnodiging kan geen eigenaar uitdelen',
       (select case when pg_get_constraintdef(oid) not like '%eigenaar%' then 'ja' else 'NEE' end
        from pg_constraint where conname='uitnodigingen_rol_check'), 'ja';

commit;

-- 041 — De locatiecontrole juridisch houdbaar maken
--
-- Migratie 040 legde de positie van de monteur vast bij het aanmelden.
-- Dat is een persoonsgegeven van een werknemer, en daar gelden regels
-- voor die strenger zijn dan voor de rest van dit systeem. Wat hier
-- verandert, verandert om die reden.
--
-- ── 1. Alleen de afstand, niet de plek ──
-- Het doel is te weten hóe ver iemand van de klus stond. Daar is de
-- afstand voor nodig en de coördinaat niet. Die coördinaat bewaren
-- levert een plaatsbepaling van een werknemer op — een gegeven waar we
-- niets mee doen, dat we niet nodig hebben, en dat bij een lek of een
-- vordering wél iets betekent.
--
-- De positie komt binnen, de database rekent de afstand uit, en gooit
-- de coördinaat in dezelfde beweging weg. Wat overblijft is "op 240 m,
-- telefoon zei ±15 m". Dat is precies genoeg voor het doel en geen
-- meter meer. Dataminimalisatie is geen formaliteit: het is het
-- verschil tussen een afstandsmeting en een volgsysteem.
--
-- ── 2. Een bewaartermijn ──
-- Zonder termijn bewaar je voor altijd, en "voor altijd" is bij
-- persoonsgegevens geen termijn maar het ontbreken ervan. Negentig
-- dagen: lang genoeg om een patroon te zien en een gesprek te voeren,
-- kort genoeg om niet jaren later nog te kunnen terugkijken op waar
-- iemand op een dinsdag was.
--
-- ── 3. Wat hier níet in staat, en wél moet gebeuren ──
-- Techniek dekt maar een deel. Zie `.ai/PRIVACY_LOCATIE.md` voor het
-- doel, de grondslag, de informatieplicht en het inzagerecht. Zonder
-- dat is deze tabel een risico in plaats van een hulpmiddel.

-- ── De coördinaat mag weg zodra de afstand er is ────────────
alter table public.werkdag_locaties
  alter column latitude  drop not null,
  alter column longitude drop not null;

comment on column public.werkdag_locaties.latitude is
  'Alleen aanwezig tussen ontvangst en berekening. De trigger wist hem in dezelfde insert.';
comment on column public.werkdag_locaties.afstand_m is
  'Afstand tot het werkadres in meters. Dit is het enige dat bewaard blijft.';

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

  if v_lat is not null and v_lon is not null then
    new.afstand_m := public.afstand_meters(v_lat, v_lon, new.latitude, new.longitude);
  end if;

  -- Weg met de plaatsbepaling. Vanaf hier weten we alleen nog hoe ver.
  -- Staat er geen coördinaat op de werkbon, dan is er niets te
  -- berekenen en verdwijnt de positie zonder dat er iets overblijft —
  -- ook dat is de bedoeling.
  new.latitude  := null;
  new.longitude := null;

  if new.afstand_m is null then
    return new;
  end if;

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


-- ── De bewaartermijn ────────────────────────────────────────
create or replace function public.locaties_opruimen(p_dagen integer default 90)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_aantal integer;
begin
  with weg as (
    delete from public.werkdag_locaties
     where created_at < now() - make_interval(days => greatest(p_dagen, 1))
    returning 1
  )
  select count(*) into v_aantal from weg;

  -- De meldingen erover gaan mee. Een bericht dat zegt "op 240 m van
  -- de Bonairestraat" is dezelfde plaatsbepaling, alleen in een zin.
  delete from public.meldingen
   where soort = 'aanmelding_ver_weg'
     and created_at < now() - make_interval(days => greatest(p_dagen, 1));

  return v_aantal;
end;
$$;

revoke execute on function public.locaties_opruimen(integer) from public, anon, authenticated;

comment on function public.locaties_opruimen(integer) is
  'Wist afstandsmetingen en de bijbehorende meldingen na de bewaartermijn. Draait dagelijks.';

-- 027 — Stilleggen schuift de planning niet meer op
--
-- `werkbon_stilleggen()` zette de opleverdatum één dag verder:
--
--     geplande_eind = coalesce(geplande_eind, datum) + 1
--
-- Dat was een gok, en een gok die de verkeerde kant op leunt. Een klus
-- ligt zelden precies één dag stil. Karolingenstraat 29 is stilgelegd
-- op "asbest verdacht materiaal aangetroffen" — daar komt een
-- inventarisatie achteraan, en mogelijk een gecertificeerde saneerder.
-- Dat duurt geen dag. Bij ziekte of een incompleet koppel kan het juist
-- een halve dag zijn.
--
-- Erger dan de onnauwkeurigheid is dat de datum niet terugkwam:
-- `werkbon_hervatten()` haalt de stilleg-velden weg maar zet de
-- einddatum niet terug. Elke keer stilleggen en hervatten schoof de
-- planning dus permanent een dag op, zonder dat iemand daarom vroeg en
-- zonder spoor van waar die dag vandaan kwam.
--
-- Wat blijft staan is het signaleren: wie op deze klus staat en
-- daardoor ergens anders in de knel komt, levert nog steeds een melding
-- op bij de eigenaar en bij iedereen met planningsmeldingen aan. Dat is
-- ook precies de goede verdeling — de app wijst aan wat er wringt, en
-- een mens beslist wat er verschuift.
--
-- De rest van de functie is ongewijzigd: de bevoegdheidstoets, de
-- verplichte reden, de gebeurtenis in het logboek en de
-- ClickUp-terugkoppeling blijven zoals ze waren.

create or replace function public.werkbon_stilleggen(p_werkbon uuid, p_reden text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant  uuid := public.get_mijn_tenant();
  v_reden   text := btrim(coalesce(p_reden, ''));
  v_bon     public.werkbonnen%rowtype;
  v_overlap jsonb := '[]'::jsonb;
  v_rij     record;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan een klus stilleggen'
      using errcode = '42501';
  end if;

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

  -- Geen `geplande_eind + 1` meer. De klus ligt stil; wanneer hij weer
  -- loopt weet niemand op dit moment, en de app hoort dat niet te doen
  -- alsof.
  update public.werkbonnen
     set stilgelegd_op   = now(),
         stilleg_reden   = v_reden,
         stilgelegd_door = auth.uid()
   where id = p_werkbon;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'stilgelegd', v_reden, auth.uid());

  -- Signaleren blijft. Het venster stond op "einddatum + 1" omdat die
  -- dag erbij kwam; nu de datum niet meer schuift, kijken we naar de
  -- geplande periode zoals hij is.
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
      and w2.geplande_start <= coalesce(v_bon.geplande_eind, v_bon.datum)
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

  perform public.taak_aanmaken(
    'clickup.status_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'stilgelegd'));

  -- `nieuwe_einddatum` is eruit: er ís geen nieuwe einddatum. Het
  -- scherm liet die waarde zien en dat suggereerde dat er iets was
  -- vastgelegd.
  return jsonb_build_object(
    'stilgelegd', true,
    'overlap', v_overlap);
end;
$function$;

comment on function public.werkbon_stilleggen(uuid, text) is
  'Legt een klus stil met verplichte reden. Verschuift de planning niet: '
  'hoelang een klus stilligt is niet te voorspellen. Signaleert wel welke '
  'andere klussen van dezelfde mensen in de knel komen.';

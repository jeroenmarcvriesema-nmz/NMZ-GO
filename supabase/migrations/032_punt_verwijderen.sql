-- 032 — Een punt van een werkbon verwijderen
--
-- De punten komen uit de werkopdracht-PDF en sinds migratie 030 kan
-- kantoor er zelf een bijzetten. Er weer één áf halen kon niet, en dat
-- is precies wat je nodig hebt als de parser een kopregel als punt
-- heeft gelezen, of als er meerwerk is opgeschreven dat toch niet
-- doorgaat. Zo'n punt blijft anders eeuwig openstaan en houdt het
-- afronden van de bon tegen.
--
-- Drie sloten, en ze zijn geen van drieën overbodig:
--
--   1. Alleen kantoor. Dezelfde rollen als de rest: beheerder,
--      uitvoerder, werkvoorbereider, planner en de eigenaar.
--   2. Niet op een opgeleverde bon. Dat dossier is dicht; wat de
--      opdrachtgever heeft gezien mag er niet achteraf uit.
--   3. Niet als er foto's aan hangen. Die foto's zijn het bewijs dat
--      het werk gedaan is, en dat gooien we niet weg als bijvangst van
--      een opruimactie. Wie het punt écht kwijt wil, haalt eerst de
--      foto weg — dan is dat een aparte, zichtbare handeling.

create or replace function public.werkbon_punt_verwijderen(
  p_taak uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.get_mijn_tenant();
  v_taak   public.taken%rowtype;
  v_bon    public.werkbonnen%rowtype;
  v_fotos  integer;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen kantoor kan een punt van een werkbon halen'
      using errcode = '42501';
  end if;

  select * into v_taak from public.taken
   where id = p_taak and tenant_id = v_tenant;
  if not found then
    raise exception 'Dit punt bestaat niet (meer)' using errcode = 'P0002';
  end if;

  select * into v_bon from public.werkbonnen
   where id = v_taak.werkbon_id and tenant_id = v_tenant;
  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  if v_bon.opgeleverd_op is not null then
    raise exception 'Deze klus is opgeleverd; daar kan geen punt meer af'
      using errcode = '23514';
  end if;

  select count(*) into v_fotos from public.fotos where taak_id = p_taak;
  if v_fotos > 0 then
    raise exception
      'Aan dit punt hangen % foto(s). Haal die er eerst af — foto''s zijn het bewijs dat het werk gedaan is.',
      v_fotos
      using errcode = '23514';
  end if;

  delete from public.taken where id = p_taak;

  -- In de gebeurtenissen, met de titel erbij. Een punt dat verdwijnt
  -- zonder spoor is een punt waarvan later niemand weet of het er ooit
  -- stond — en dat is juist de vraag bij een discussie over meerwerk.
  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, v_taak.werkbon_id, 'punt_verwijderd', v_taak.titel, auth.uid());

  return jsonb_build_object('verwijderd', true, 'titel', v_taak.titel);
end;
$$;

revoke all on function public.werkbon_punt_verwijderen(uuid) from public, anon;
grant execute on function public.werkbon_punt_verwijderen(uuid) to authenticated;

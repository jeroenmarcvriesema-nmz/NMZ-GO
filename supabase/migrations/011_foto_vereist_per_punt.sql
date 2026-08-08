-- ============================================================
-- NMZ GO — Migratie 011: fotoplicht per punt instelbaar
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Migratie 008 legde vast dat een werkbon pas afgerond mag worden als
-- élk punt is afgevinkt én van elk punt een foto bestaat. Dat is de
-- kern van het bewijs, maar het is te absoluut.
--
-- De punten op een werkbon komen uit de offerte. Daar staan regels
-- tussen waar geen foto van te maken is. De drie standaardgevallen
-- (parkeerkosten, brandstoftoeslag, klein materiaal) laat de
-- synchronisatie voortaan helemaal weg, maar er blijven uitzonderingen
-- die je pas ter plekke ziet.
--
-- Daarom: fotoplicht staat per punt aan, en een uitvoerder of hoger
-- kan hem uitzetten. Dat is een zichtbare, bewuste handeling — geen
-- stille uitzondering.
-- ============================================================

begin;

alter table public.taken add column if not exists foto_vereist boolean not null default true;

comment on column public.taken.foto_vereist is
  'Standaard aan. Alleen een uitvoerder of hoger kan hem uitzetten, '
  'voor punten waar geen foto van te maken is.';


-- ── De afrondcontrole telt nu alleen punten mét fotoplicht ───
-- De rest van de controle blijft ongewijzigd: élk punt moet nog
-- steeds afgevinkt zijn, ook een punt zonder foto.

create or replace function public.guard_werkbon_kolommen()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_open       int;
  v_zonderfoto int;
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.mag_werk_beheren() then
    return new;
  end if;

  if old.status = 'voltooid' then
    raise exception 'Deze werkbon is afgerond en kan niet meer worden gewijzigd'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Je mag alleen de status van een werkbon wijzigen'
      using errcode = '42501';
  end if;

  if new.status not in ('bezig', 'voltooid') then
    raise exception 'Je mag een werkbon alleen op bezig of voltooid zetten'
      using errcode = '42501';
  end if;

  if new.status = 'voltooid' then
    select count(*) into v_open
      from public.taken t where t.werkbon_id = new.id and not t.voltooid;

    if v_open > 0 then
      raise exception 'Er % nog % niet afgevinkt; afronden kan pas als alles klaar is',
        case when v_open = 1 then 'is' else 'zijn' end,
        case when v_open = 1 then '1 punt' else v_open || ' punten' end
        using errcode = '42501';
    end if;

    select count(*) into v_zonderfoto
      from public.taken t
      where t.werkbon_id = new.id
        and t.foto_vereist                                    -- nieuw
        and not exists (select 1 from public.fotos f where f.taak_id = t.id);

    if v_zonderfoto > 0 then
      raise exception 'Er % nog % zonder foto; elk punt heeft fotobewijs nodig',
        case when v_zonderfoto = 1 then 'is' else 'zijn' end,
        case when v_zonderfoto = 1 then '1 punt' else v_zonderfoto || ' punten' end
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


-- ── Alleen kantoor mag de fotoplicht omzetten ────────────────
-- De update-policy op `taken` laat een zwamsaneerder afvinken op een
-- lopende bon. Zonder deze trigger zou hij ook de fotoplicht van zijn
-- eigen punten kunnen uitzetten — en daarmee het hele bewijs omzeilen.

create or replace function public.guard_taak_kolommen()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.mag_werk_beheren() then
    return new;
  end if;

  if new.foto_vereist is distinct from old.foto_vereist then
    raise exception 'Alleen een uitvoerder of hoger kan de fotoplicht wijzigen'
      using errcode = '42501';
  end if;

  -- Een zwamsaneerder vinkt af en laat een opmerking achter; de tekst
  -- van het punt zelf komt uit de opdracht en ligt vast.
  if new.titel is distinct from old.titel
     or new.omschrijving is distinct from old.omschrijving
     or new.werkbon_id is distinct from old.werkbon_id
     or new.tenant_id is distinct from old.tenant_id then
    raise exception 'Je mag een punt afvinken en van een opmerking voorzien, niet herschrijven'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_taak_kolommen() from public, anon, authenticated;

drop trigger if exists taken_guard_kolommen on public.taken;
create trigger taken_guard_kolommen
  before update on public.taken
  for each row execute function public.guard_taak_kolommen();


-- ── Uitgesloten punten als instelling ────────────────────────
-- Deze drie horen nooit op een werkbon. Als instelling, zodat er later
-- iets bij kan zonder codewijziging.

alter table public.clickup_instellingen
  add column if not exists uitgesloten_punten text[] not null
      default array['parkeerkosten', 'brandstoftoeslag', 'klein materiaal'];

update public.clickup_instellingen
   set uitgesloten_punten = array['parkeerkosten', 'brandstoftoeslag', 'klein materiaal']
 where uitgesloten_punten = '{}';


-- ── Verificatie ──────────────────────────────────────────────

select 'kolom foto_vereist' as controle,
       case when exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='taken'
                           and column_name='foto_vereist')
            then 'aanwezig' else 'ONTBREEKT' end as uitslag
union all
select 'trigger op taken',
       case when exists (select 1 from pg_trigger
                         where tgrelid='public.taken'::regclass and tgname='taken_guard_kolommen')
            then 'aanwezig' else 'ONTBREEKT' end
union all
select 'uitgesloten punten',
       (select array_to_string(uitgesloten_punten, ', ') from public.clickup_instellingen limit 1);

commit;

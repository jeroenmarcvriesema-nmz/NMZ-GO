-- ============================================================
-- NMZ GO — Migratie 046: het standaardpunt ligt vast
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Migratie 045 zette het slot: zolang het veiligheidsblad openstaat
-- kan er geen ander punt af. Dat slot hing alleen aan één kolom, en
-- die kolom stond open.
--
-- `taken_update` is een policy per rij en niet per kolom — wie op de
-- bon staat mag elke kolom van zijn punten schrijven. Nagemeten op de
-- database: `update taken set standaard = false` op het veiligheidsblad
-- ging er gewoon doorheen, en daarna vinkte de rest vrolijk af. Ook het
-- omzetten van `foto_vereist` kon, en dan is "eerst een foto" weg.
--
-- Niemand doet dit via de app; er zit geen knop op. Maar het slot zit
-- in de database juist omdát het niet van het scherm mag afhangen, en
-- dan hoort het niet één veldnaam verwijderd te zijn van niets.
--
-- Wat er vastligt op het standaardpunt: de vlag zelf (beide kanten
-- op), de titel, de volgorde en de fotoplicht. Wat gewoon blijft
-- werken: afvinken, uitvinken, opmerkingen, en alles op elk ander
-- punt.
-- ============================================================

begin;

create or replace function public.taken_standaardpunt_eerst()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- De vlag ligt vast, beide kanten op. Uitzetten haalt het slot weg;
  -- aanzetten zou een punt uit de opdracht onverwijderbaar maken en de
  -- hele bon op slot zetten achter een punt dat niemand zo bedoeld
  -- heeft.
  if new.standaard is distinct from old.standaard then
    raise exception 'Of een punt het vaste veiligheidspunt is, ligt vast en is niet te wijzigen'
      using errcode = '42501';
  end if;

  -- En op dat punt liggen de tekst, de plek en de fotoplicht vast.
  -- Zonder dit blijft het punt bestaan maar kan het worden hernoemd,
  -- naar onderen geschoven of van zijn fotoplicht ontdaan — en dan
  -- staat er wel iets, maar niet meer wat het moest zijn.
  if old.standaard and (
       new.titel        is distinct from old.titel
    or new.volgorde     is distinct from old.volgorde
    or new.foto_vereist is distinct from old.foto_vereist
  ) then
    raise exception 'Het veiligheidspunt staat vast: tekst, volgorde en fotoplicht zijn niet te wijzigen'
      using errcode = '42501';
  end if;

  -- Hierna de volgorderegel uit migratie 045, ongewijzigd: alleen een
  -- gewoon punt dat van niet-af naar af gaat. Uitvinken, heropenen en
  -- het standaardpunt zelf blijven ongemoeid, en een bon zonder
  -- standaardpunt houdt niets tegen.
  if new.standaard or old.voltooid or not new.voltooid then
    return new;
  end if;

  if exists (
    select 1 from public.taken t
     where t.werkbon_id = new.werkbon_id
       and t.standaard
       and not t.voltooid
  ) then
    raise exception 'Vink eerst het veiligheidsblad af: %', public.standaardpunt_titel()
      using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;

-- ── CONTROLE ─────────────────────────────────────────────────
-- Verwacht: 'ja'
select case when exists (
         select 1 from pg_trigger
          where tgname = 'taken_standaardpunt_eerst' and not tgisinternal)
       then 'ja' else 'nee' end as trigger_staat;

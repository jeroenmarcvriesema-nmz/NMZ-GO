-- ============================================================
-- NMZ GO — Migratie 044: opleveren zonder bewijs (alleen de eigenaar)
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- De normale weg blijft de normale weg. `werkbon_opleveren()` weigert
-- een klus die niet op 'voltooid' staat, en dat is precies goed: het
-- garandeert dat elk punt met fotoplicht een foto heeft voordat er
-- iets naar de opdrachtgever gaat. Daar verandert deze migratie niets
-- aan.
--
-- Wat er wél bij komt is een uitzondering voor één persoon. De
-- eigenaar heeft klussen die administratief dicht moeten terwijl het
-- bewijs er nog niet is: een bon uit een oude ClickUp-lijst waar nooit
-- punten in zijn gezet, werk dat buiten de app om is afgehandeld, een
-- klus waarvan de foto's per WhatsApp binnenkwamen. Zonder deze knop
-- blijven die eeuwig openstaan en vervuilen ze elk overzicht dat
-- "lopend" telt.
--
-- Drie dingen die deze uitzondering eerlijk houden:
--
--   1. `is_eigenaar()` en niet `mag_werk_beheren()`. Een beheerder,
--      uitvoerder of werkvoorbereider komt er niet doorheen — dat is
--      de vraag zoals hij gesteld is, en het is ook de enige manier
--      waarop dit een uitzondering blijft in plaats van een sluiproute
--      om de fotoplicht heen.
--   2. Een verplichte reden. Achteraf moet leesbaar zijn waarom deze
--      bon dicht is zonder dat er iets is afgevinkt. Zonder reden is
--      dit een gat in de administratie in plaats van een besluit.
--   3. Op het bord in ClickUp gaat de taak **niet** naar "opgeleverd"
--      maar naar "wacht op foto's". Precies wat de eigenaar vroeg, en
--      om de goede reden: de status op het bord hoort niet te
--      suggereren dat er bewijs ligt terwijl dat er niet is. In NMZ GO
--      is de klus dicht, in ClickUp staat er wat er nog moet komen.
--
-- De kolom `opgeleverd_zonder_bewijs` is de drager daarvan. De
-- verwerker leest hem als hij de status zet; daarom een kolom op de
-- bon en geen extra soort in de wachtrij — dan blijft er één waarheid
-- staan, ook als de statustaak later nog eens opnieuw wordt aangeboden.
-- ============================================================

begin;

-- ── A. DE MARKERING OP DE BON ────────────────────────────────

alter table public.werkbonnen
  add column if not exists opgeleverd_zonder_bewijs boolean not null default false;

comment on column public.werkbonnen.opgeleverd_zonder_bewijs is
  'Door de eigenaar opgeleverd terwijl er niets was afgevinkt of gefotografeerd. De verwerker zet de ClickUp-taak dan op "wacht op foto''s" in plaats van "opgeleverd".';


-- ── B. DE UITZONDERING ───────────────────────────────────────

create or replace function public.werkbon_opleveren_zonder_bewijs(
    p_werkbon uuid,
    p_reden   text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant     uuid := public.get_mijn_tenant();
  v_reden      text := btrim(coalesce(p_reden, ''));
  v_bon        public.werkbonnen%rowtype;
  v_volgnummer uuid := gen_random_uuid();
  v_statustaak uuid;
  v_open       integer;
  v_fotos      integer;
begin
  -- Niet `mag_werk_beheren()`. Dit is de hele afspraak: één rol, en de
  -- eigenaar is bij ons één persoon.
  if not public.is_eigenaar() then
    raise exception 'Alleen de eigenaar kan een klus opleveren zonder bewijs'
      using errcode = '42501';
  end if;

  -- Net als bij stilleggen: het slot zit hier en niet in het scherm,
  -- zodat het ook geldt voor een aanroep die het scherm overslaat.
  if length(v_reden) < 3 then
    raise exception 'Geef een reden op waarom deze klus zonder bewijs wordt opgeleverd'
      using errcode = '23514';
  end if;

  select * into v_bon from public.werkbonnen
   where id = p_werkbon and tenant_id = v_tenant;

  if not found then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  if v_bon.opgeleverd_op is not null then
    raise exception 'Deze klus is al opgeleverd'
      using errcode = '23514';
  end if;

  -- Wat er ontbrak, vastgelegd op het moment dat het besluit viel.
  -- Achteraf tellen levert een ander getal op zodra iemand alsnog een
  -- foto toevoegt, en dan zegt de logregel niet meer wat er toen stond.
  select count(*) into v_open
    from public.taken
   where werkbon_id = p_werkbon and voltooid = false;

  select count(*) into v_fotos
    from public.fotos
   where werkbon_id = p_werkbon and tenant_id = v_tenant;

  -- `status` blijft met rust. De ploeg heeft deze bon niet afgerond en
  -- de administratie hoort niet te beweren van wel; `klusstand()` leest
  -- `opgeleverd_op` vóór `status`, dus de app toont hem overal gewoon
  -- als opgeleverd.
  update public.werkbonnen
     set opgeleverd_op            = now(),
         opgeleverd_door          = auth.uid(),
         opgeleverd_zonder_bewijs = true
   where id = p_werkbon;

  insert into public.werkbon_gebeurtenissen (tenant_id, werkbon_id, soort, reden, door)
  values (v_tenant, p_werkbon, 'opgeleverd',
          format('Zonder bewijs opgeleverd door de eigenaar (%s open %s, %s %s). %s',
                 v_open,
                 case when v_open = 1 then 'punt' else 'punten' end,
                 v_fotos,
                 case when v_fotos = 1 then 'foto' else 'foto''s' end,
                 v_reden),
          auth.uid());

  -- Dezelfde twee wachtrijtaken als de normale weg. Staan er wél
  -- foto's — bijvoorbeeld op de helft van de punten — dan horen die
  -- gewoon bij ClickUp te komen; alleen de status wordt straks een
  -- andere.
  perform public.taak_aanmaken(
    'clickup.fotos_uploaden',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon),
    v_volgnummer,
    50);

  v_statustaak := public.taak_aanmaken(
    'clickup.status_bijwerken',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon, 'soort', 'opgeleverd'),
    v_volgnummer,
    100);

  update public.verwerkingstaken set max_pogingen = 10 where id = v_statustaak;

  return jsonb_build_object(
    'opgeleverd', true,
    'zonder_bewijs', true,
    'open_punten', v_open,
    'fotos', v_fotos);
end;
$$;

comment on function public.werkbon_opleveren_zonder_bewijs(uuid, text) is
  'Uitzondering voor de eigenaar: levert een klus op zonder dat er iets is afgevinkt of gefotografeerd. Verplichte reden, en de ClickUp-taak gaat naar "wacht op foto''s" in plaats van "opgeleverd".';

revoke execute on function public.werkbon_opleveren_zonder_bewijs(uuid, text) from public, anon;
grant  execute on function public.werkbon_opleveren_zonder_bewijs(uuid, text) to authenticated;

commit;

-- ── CONTROLE ─────────────────────────────────────────────────
-- Verwacht: 'ja'
select case when exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'werkbon_opleveren_zonder_bewijs')
       then 'ja' else 'nee' end as functie_bestaat;

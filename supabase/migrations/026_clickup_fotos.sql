-- ============================================================
-- NMZ GO — Migratie 026: foto's naar ClickUp
-- ============================================================
-- De keten die de eigenaar wil, in deze volgorde:
--
--   foto's staan in NMZ GO
--     -> foto's gaan als bijlage naar de gekoppelde ClickUp-taak
--     -> klus wordt opgeleverd in NMZ GO
--     -> status in ClickUp gaat naar "opgeleverd"
--     -> pas daarna mag de bucket opgeruimd worden
--
-- Deze migratie legt de eerste twee stappen vast. Het opruimen (stap
-- drie) volgt apart, en pas nadat gebleken is dat het stempel klopt:
-- zonder dat stempel gooi je bewijs weg dat nergens anders staat.
--
-- Voegt alleen toe. Verwijdert geen tabellen, kolommen of data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. HET STEMPEL ────────────────────────────────────────────
-- Per foto bijhouden of hij bij ClickUp is aangekomen. Dezelfde
-- aanpak als `rapportages.clickup_geupload_op`: gevuld betekent niet
-- opnieuw sturen. Een stempel is betrouwbaarder dan onthouden of je
-- het al gedaan hebt — de verwerker mag elke taak twee keer draaien.

alter table public.fotos
  add column if not exists clickup_geupload_op   timestamptz,
  add column if not exists clickup_attachment_id text,
  add column if not exists opgeruimd_op          timestamptz;

comment on column public.fotos.clickup_geupload_op is
  'Wanneer deze foto als bijlage bij de ClickUp-taak is gezet. Gevuld betekent: niet opnieuw sturen.';
comment on column public.fotos.clickup_attachment_id is
  'Het bijlage-id dat ClickUp teruggaf. Alleen als bewijs — de koppeling loopt via het stempel hierboven.';
comment on column public.fotos.opgeruimd_op is
  'Wanneer het bestand uit de bucket is gehaald. De rij blijft staan; alleen het bestand is weg. Nooit gevuld zolang clickup_geupload_op leeg is.';

-- De uploadronde zoekt precies dit: foto's van één bon die nog geen
-- stempel hebben. Partieel, want de gestempelde foto's zijn na verloop
-- van tijd de grote meerderheid en die hoeven niet in de index.
create index if not exists idx_fotos_zonder_clickup
  on public.fotos (werkbon_id)
  where clickup_geupload_op is null;

-- Het opruimen zoekt het omgekeerde: wél gestempeld, nog niet
-- opgeruimd, en oud genoeg.
create index if not exists idx_fotos_op_te_ruimen
  on public.fotos (clickup_geupload_op)
  where clickup_geupload_op is not null and opgeruimd_op is null;


-- ── B. OPLEVEREN ZET DE FOTO'S ERVOOR ─────────────────────────
-- Ongewijzigd gebleven: de bevoegdheidstoets, de statuscontrole, het
-- stempel op de werkbon en de gebeurtenis. Nieuw is dat er nu twee
-- taken klaargezet worden in plaats van één, en in welke volgorde ze
-- opgepakt worden.
--
-- De volgorde loopt via `prioriteit`: claim_verwerkingstaken kiest op
-- prioriteit, en de verwerker sorteert de batch daar zelf nog eens op
-- voordat hij hem afdraait. De fotoupload staat op 50 en de
-- statuswijziging op de standaard 100, dus de bijlagen staan er op het
-- moment dat de status springt.
--
-- Dat is de gelukkige route. Gaat de upload mis, dan is prioriteit
-- niet genoeg — daarom kijkt de statushandler zélf ook of de foto's
-- binnen zijn en zet hij de taak anders op "wacht op foto's". Die
-- regel staat in de Edge Function, waar ClickUp bereikbaar is.
--
-- Beide taken krijgen hetzelfde volgnummer: ze komen uit één
-- gebeurtenis, en dat is precies waar dat veld voor bedoeld is.

create or replace function public.werkbon_opleveren(p_werkbon uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant     uuid := public.get_mijn_tenant();
  v_status     text;
  v_volgnummer uuid := gen_random_uuid();
  v_fotos      integer;
  v_statustaak uuid;
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

  -- Eerst de foto's. Staan er geen zonder stempel, dan is de taak
  -- meteen klaar en kost hij één query — geen reden om hem over te
  -- slaan en daarmee twee wegen te krijgen die uit elkaar kunnen lopen.
  select count(*) into v_fotos
    from public.fotos
   where werkbon_id = p_werkbon and tenant_id = v_tenant;

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

  -- Ruimer dan de standaard vijf pogingen. De statustaak stelt zichzelf
  -- uit zolang de fotoupload nog loopt, en dat uitstel telt als poging.
  -- Met vijf pogingen is de hele wachttijd nog geen minuut; dan zou een
  -- upload die één keer opnieuw moet, de statuswijziging meeslepen.
  update public.verwerkingstaken set max_pogingen = 10 where id = v_statustaak;

  return jsonb_build_object('opgeleverd', true, 'fotos', v_fotos);
end;
$$;

comment on function public.werkbon_opleveren(uuid) is
  'Levert een klus op: stempel op de werkbon, gebeurtenis, en twee wachtrijtaken — eerst de foto''s naar ClickUp (prioriteit 50), dan de statuswijziging (100).';


-- ── C. FOTO'S KLAARZETTEN ZONDER OPLEVERING ───────────────────
-- De foto's hoeven niet op de oplevering te wachten. Zodra ze er zijn
-- kunnen ze naar ClickUp; dan staat het bewijs er al op het moment dat
-- kantoor kijkt of de klus goed is. Deze functie is de ingang daarvoor
-- vanaf een scherm of met de hand.
--
-- Idempotent: is er al een openstaande uploadtaak voor deze bon, dan
-- geeft hij die terug in plaats van een tweede te maken. Twee keer
-- drukken hoort geen twee uploads op te leveren.

create or replace function public.fotos_naar_clickup(p_werkbon uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant  uuid := public.get_mijn_tenant();
  v_bestaat uuid;
  v_id      uuid;
  v_open    integer;
begin
  if not public.mag_werk_beheren() then
    raise exception 'Alleen een uitvoerder of hoger kan foto''s naar ClickUp sturen'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.werkbonnen
     where id = p_werkbon and tenant_id = v_tenant
  ) then
    raise exception 'Werkbon niet gevonden' using errcode = 'P0002';
  end if;

  select count(*) into v_open
    from public.fotos
   where werkbon_id = p_werkbon
     and tenant_id = v_tenant
     and clickup_geupload_op is null
     and opgeruimd_op is null;

  select id into v_bestaat
    from public.verwerkingstaken
   where soort = 'clickup.fotos_uploaden'
     and tenant_id = v_tenant
     and payload->>'werkbon_id' = p_werkbon::text
     and status in ('wachtend', 'bezig')
   order by created_at desc
   limit 1;

  if v_bestaat is not null then
    return jsonb_build_object('taak_id', v_bestaat, 'nieuw', false, 'nog_te_uploaden', v_open);
  end if;

  v_id := public.taak_aanmaken(
    'clickup.fotos_uploaden',
    jsonb_build_object('tenant_id', v_tenant, 'werkbon_id', p_werkbon),
    null,
    50);

  return jsonb_build_object('taak_id', v_id, 'nieuw', true, 'nog_te_uploaden', v_open);
end;
$$;

revoke execute on function public.fotos_naar_clickup(uuid) from public, anon;
grant  execute on function public.fotos_naar_clickup(uuid) to authenticated;

comment on function public.fotos_naar_clickup(uuid) is
  'Zet de foto''s van een werkbon in de wachtrij voor ClickUp. Uitvoerder of hoger. Idempotent: een lopende taak wordt teruggegeven.';

commit;


-- ── D. VERIFICATIE ────────────────────────────────────────────

select 'de drie kolommen op fotos' as controle,
       (select count(*)::text from information_schema.columns
         where table_schema = 'public' and table_name = 'fotos'
           and column_name in ('clickup_geupload_op','clickup_attachment_id','opgeruimd_op')) as gevonden,
       '3' as verwacht
union all
select 'de twee indexen',
       (select count(*)::text from pg_indexes
         where schemaname = 'public'
           and indexname in ('idx_fotos_zonder_clickup','idx_fotos_op_te_ruimen')), '2'
union all
select 'fotos_naar_clickup bestaat',
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'fotos_naar_clickup'), '1'
union all
select 'opleveren zet de fotoupload ervoor',
       (select case when pg_get_functiondef(p.oid) like '%clickup.fotos_uploaden%'
                    then 'ja' else 'NEE' end
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'werkbon_opleveren'), 'ja';

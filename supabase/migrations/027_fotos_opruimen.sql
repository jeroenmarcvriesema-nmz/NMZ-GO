-- ============================================================
-- NMZ GO — Migratie 027: de bucket opruimen
-- ============================================================
-- Derde stap van de fotoketen. Zodra ClickUp de foto's heeft, is
-- Supabase Storage nog maar een doorgeefluik en hoeven ze daar geen
-- maanden te blijven staan.
--
-- Het gevaarlijke woord in die zin is "zodra". Wissen zonder bewijs dat
-- het bestand ergens anders staat, is bewijs vernietigen dat nergens
-- anders staat. Daarom staan de voorwaarden hier en niet in de Edge
-- Function: vier stuks, en alle vier moeten ze waar zijn.
--
--   1. Het uploadstempel is gevuld. Geen stempel, geen ClickUp, geen
--      opruiming.
--   2. De klus is opgeleverd. Dat is het moment waarop het dossier
--      dichtgaat; daarvoor is de foto nog werkmateriaal.
--   3. Er zit minstens de wachttijd tussen (standaard veertien dagen).
--      Zowel sinds de upload als sinds de oplevering.
--   4. Er ligt geen opleverrapport te wachten. Dat rapport leest
--      dezelfde foto's; die eronder vandaan halen levert een rapport
--      op met lege plekken.
--
-- Wat er níét gebeurt: de rij in `fotos` blijft staan. Alleen het
-- bestand gaat weg, en `opgeruimd_op` vertelt dat het bewust is
-- gebeurd. Zo blijft zichtbaar dát er een foto was en waar hij nu is.
--
-- Voegt alleen toe. Verwijdert geen tabellen, kolommen of data.
-- Veilig meerdere keren uitvoerbaar (idempotent).
-- ============================================================

begin;

-- ── A. WAT MAG WEG ────────────────────────────────────────────
-- De vier voorwaarden in één query. De Edge Function vraagt deze lijst
-- op en wist precies wat eruit komt — hij bedenkt zelf niets.
--
-- Per tenant, net als alles hier. Een opruiming die de grens van de
-- klant niet kent, wist ooit de bestanden van de verkeerde.

-- Deze drie hebben tijdens het bouwen een ronde zonder tenant gehad.
-- Postgres houdt die als aparte overload in leven, en een handler die
-- per ongeluk de oude aanroept ruimt over alle tenants heen op.
drop function if exists public.fotos_op_te_ruimen(integer);
drop function if exists public.fotos_weesbestanden(integer);
drop function if exists public.fotos_opgeruimd_stempelen(uuid[], integer);

create or replace function public.fotos_op_te_ruimen(p_tenant uuid, p_dagen integer default 14)
  returns table (id uuid, storage_path text, werkbon_id uuid)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select f.id, f.storage_path, f.werkbon_id
    from public.fotos f
    join public.werkbonnen w on w.id = f.werkbon_id
   where f.tenant_id = p_tenant
     and f.clickup_geupload_op is not null                      -- 1
     and f.opgeruimd_op is null
     and w.opgeleverd_op is not null                            -- 2
     and f.clickup_geupload_op < now() - make_interval(days => greatest(p_dagen, 1))   -- 3
     and w.opgeleverd_op      < now() - make_interval(days => greatest(p_dagen, 1))
     and not exists (                                           -- 4
       select 1 from public.rapportages r
        where r.werkbon_id = f.werkbon_id
          and r.status = 'wachtend'
     )
   order by f.clickup_geupload_op;
$$;

comment on function public.fotos_op_te_ruimen(uuid, integer) is
  'De foto-bestanden die uit de bucket mogen: gestempeld naar ClickUp, klus opgeleverd, wachttijd voorbij, geen rapport in behandeling.';

revoke execute on function public.fotos_op_te_ruimen(uuid, integer) from public, anon, authenticated;


-- ── B. WEESBESTANDEN ──────────────────────────────────────────
-- Een foto verwijderen haalde tot nu toe de databaserij weg en liet
-- het bestand in Storage staan. Die bestanden zijn onvindbaar: er
-- verwijst niets meer naar, ze zijn in geen enkel scherm te zien, en ze
-- blijven staan tot iemand er met de hand in duikt.
--
-- Ze horen bij deze opruiming, niet bij een aparte: het is dezelfde
-- vraag — welk bestand doet er niet meer toe. De leeftijdsgrens is
-- geen franje maar noodzaak: tussen het aanmaken van het bestand en het
-- wegschrijven van de rij zit een moment, en in dat moment lijkt een
-- gloednieuwe foto op een wees.

create or replace function public.fotos_weesbestanden(p_tenant uuid, p_dagen integer default 14)
  returns table (pad text, aangemaakt timestamptz)
  language sql
  stable
  security definer
  set search_path = public
as $$
  -- Het pad begint met het werkbon-id; daar hangt de tenant aan. Een
  -- bestand waarvan de eerste map geen bestaande werkbon is, blijft
  -- staan: dan is niet vast te stellen van wie het is, en dat is geen
  -- reden om het weg te gooien maar om ernaar te kijken.
  select o.name, o.created_at
    from storage.objects o
    join public.werkbonnen w
      on w.id::text = split_part(o.name, '/', 1)
   where o.bucket_id = 'werkbon-fotos'
     and w.tenant_id = p_tenant
     and o.created_at < now() - make_interval(days => greatest(p_dagen, 1))
     and not exists (
       select 1 from public.fotos f where f.storage_path = o.name
     )
   order by o.created_at
   limit 500;
$$;

comment on function public.fotos_weesbestanden(uuid, integer) is
  'Bestanden in werkbon-fotos waar geen rij in fotos meer naar verwijst. Blijven anders eeuwig staan.';

revoke execute on function public.fotos_weesbestanden(uuid, integer) from public, anon, authenticated;


-- ── C. HET STEMPEL ZETTEN ─────────────────────────────────────
-- Na het wissen. Apart, omdat de Edge Function pas mag stempelen als
-- Storage het bestand daadwerkelijk kwijt is — andersom zou een rij
-- kunnen beweren dat hij is opgeruimd terwijl het bestand er nog staat.
--
-- Toetst de voorwaarden opnieuw. Niet uit wantrouwen tegen de eigen
-- Edge Function, maar omdat dit de enige plek is waar `opgeruimd_op`
-- gevuld wordt: wie hem ooit ergens anders vandaan aanroept, loopt
-- tegen dezelfde vier voorwaarden aan.

create or replace function public.fotos_opgeruimd_stempelen(p_tenant uuid, p_ids uuid[], p_dagen integer default 14)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_aantal integer;
begin
  update public.fotos f
     set opgeruimd_op = now()
   where f.id = any(p_ids)
     and f.id in (select o.id from public.fotos_op_te_ruimen(p_tenant, p_dagen) o);

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

comment on function public.fotos_opgeruimd_stempelen(uuid, uuid[], integer) is
  'Zet opgeruimd_op op de foto''s waarvan het bestand is gewist. Toetst dezelfde vier voorwaarden nog een keer.';

revoke execute on function public.fotos_opgeruimd_stempelen(uuid, uuid[], integer) from public, anon, authenticated;


-- ── D. HET RITME ──────────────────────────────────────────────
-- Eén keer per dag is ruim genoeg: de wachttijd is veertien dagen, dus
-- een dag vroeger of later verandert niets. Via de wachtrij en niet
-- rechtstreeks, zodat het opruimen in hetzelfde logboek terechtkomt als
-- al het andere achtergrondwerk.

create or replace function public.fotos_opruimen_hartslag()
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
    -- Ligt er al een opruiming te wachten, dan slaat deze over. Anders
    -- stapelen ze op zodra Storage een dag traag is.
    if exists (
      select 1 from public.verwerkingstaken
       where soort = 'onderhoud.fotos_opruimen'
         and tenant_id = v_tenant.id
         and status not in ('geslaagd', 'mislukt', 'onverwerkbaar')
    ) then
      continue;
    end if;

    perform public.taak_aanmaken(
      'onderhoud.fotos_opruimen',
      jsonb_build_object('tenant_id', v_tenant.id, 'wachttijd_dagen', 14),
      null,
      200);
    v_aantal := v_aantal + 1;
  end loop;

  return v_aantal;
end;
$$;

comment on function public.fotos_opruimen_hartslag() is
  'Zet een opruimronde in de wachtrij, een keer per dag. Slaat over als er al een wacht.';

revoke execute on function public.fotos_opruimen_hartslag() from public, anon, authenticated;

commit;


-- ── E. DE CRON ────────────────────────────────────────────────
-- 03:15 UTC: buiten het venster van de synchronisatiehartslag
-- (04:00–19:55), zodat de twee elkaar niet in de weg zitten.

select cron.unschedule('nmzgo-fotos-opruimen')
where exists (select 1 from cron.job where jobname = 'nmzgo-fotos-opruimen');

select cron.schedule(
  'nmzgo-fotos-opruimen',
  '15 3 * * *',
  $$select public.fotos_opruimen_hartslag();$$
);


-- ── F. VERIFICATIE ────────────────────────────────────────────

select 'de drie functies bestaan' as controle,
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('fotos_op_te_ruimen','fotos_weesbestanden',
                             'fotos_opgeruimd_stempelen','fotos_opruimen_hartslag')) as gevonden,
       '4' as verwacht
union all
select 'niemand met een account mag erbij',
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('fotos_op_te_ruimen','fotos_weesbestanden','fotos_opgeruimd_stempelen')
           and has_function_privilege('authenticated', p.oid, 'execute')), '0'
union all
select 'de opruiming staat ingepland',
       (select case when active then schedule else 'NEE — staat uit' end
          from cron.job where jobname = 'nmzgo-fotos-opruimen'), '15 3 * * *'
union all
select 'nu op te ruimen (0 zolang niets is opgeleverd)',
       (select count(*)::text from public.fotos_op_te_ruimen(
          (select id from public.tenants order by created_at limit 1), 14)), '0';

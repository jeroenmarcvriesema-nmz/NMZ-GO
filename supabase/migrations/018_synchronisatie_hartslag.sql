-- ============================================================
-- NMZ GO — Migratie 018: vaste hartslag voor de synchronisatie
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- De synchronisatie was aangezet maar had geen ritme. Er draait wel een
-- cron die de wachtrij leegwerkt, maar er zette nooit iemand een
-- synchronisatietaak ín die wachtrij. Gevolg: wat er in ClickUp
-- verandert komt pas binnen als iemand handmatig duwt.
--
-- Dat is precies het scenario waar dit systeem voor gebouwd is om te
-- voorkomen: maandagochtend staat er een ploeg voor een deur zonder
-- werkbon, en niemand weet waarom — want er is geen foutmelding, er is
-- gewoon niets gebeurd.
--
-- ── Waarom elke dertig minuten en niet elke minuut ───────────
-- Elke ronde haalt van alle taken de werkopdracht-PDF op en schrijft
-- die opnieuw weg. Bij tweeëntwintig klussen is dat tweeëntwintig
-- downloads per ronde. Elke minuut zou dat ruim dertigduizend keer per
-- dag doen voor documenten die nooit veranderen.
--
-- Een planning verandert niet per minuut. Een half uur is ruim genoeg
-- om een wijziging van kantoor bij de ploeg te krijgen, en scheelt een
-- factor dertig aan verspild verkeer. Wie sneller wil, duwt handmatig.
--
-- Het venster loopt van 04:00 tot 19:30 UTC — dat is 06:00 tot 21:30 in
-- Nederlandse zomertijd. Ruim rond de werkdag heen, en 's nachts stil.
-- ============================================================

begin;

-- ── A. DE HARTSLAG ───────────────────────────────────────────

create or replace function public.clickup_hartslag()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_tenant  record;
  v_aantal  integer := 0;
begin
  for v_tenant in
    select tenant_id from public.clickup_instellingen where actief
  loop
    -- Ligt er al een ronde te wachten of loopt er een, dan slaan we
    -- deze over. Zonder dit stapelen de taken op zodra ClickUp traag
    -- is of even uit de lucht, en dan draait de verwerker een uur
    -- later dezelfde ronde tien keer achter elkaar.
    if exists (
      select 1 from public.verwerkingstaken
      where soort = 'clickup.synchroniseren'
        and tenant_id = v_tenant.tenant_id
        and status not in ('geslaagd', 'mislukt', 'onverwerkbaar')
    ) then
      continue;
    end if;

    perform public.taak_aanmaken(
      'clickup.synchroniseren',
      jsonb_build_object('tenant_id', v_tenant.tenant_id)
    );
    v_aantal := v_aantal + 1;
  end loop;

  return v_aantal;
end;
$$;

comment on function public.clickup_hartslag() is
  'Zet een synchronisatieronde in de wachtrij voor elke tenant waar de '
  'koppeling aanstaat. Slaat over als er al een ronde wacht of loopt.';

revoke execute on function public.clickup_hartslag() from public, anon;
grant  execute on function public.clickup_hartslag() to service_role;


-- ── B. HET RITME ─────────────────────────────────────────────

select cron.unschedule('nmzgo-clickup-hartslag')
where exists (select 1 from cron.job where jobname = 'nmzgo-clickup-hartslag');

select cron.schedule(
  'nmzgo-clickup-hartslag',
  '0,30 4-19 * * *',
  $$select public.clickup_hartslag();$$
);


-- ── C. VERIFICATIE ────────────────────────────────────────────

select 'de hartslag staat ingepland' as controle,
       (select case when active then schedule else 'NEE — staat uit' end
        from cron.job where jobname = 'nmzgo-clickup-hartslag') as gevonden,
       '0,30 4-19 * * *' as verwacht
union all
select 'de verwerker draait nog steeds',
       (select case when active then schedule else 'NEE' end
        from cron.job where jobname = 'nmzgo-verwerker'), '* * * * *'
union all
select 'hartslag levert een ronde op',
       public.clickup_hartslag()::text, '1'
union all
select 'tweede aanroep slaat over (geen stapeling)',
       public.clickup_hartslag()::text, '0';

commit;

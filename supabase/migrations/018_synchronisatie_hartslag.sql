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
-- ── Waarom elke vijf minuten ─────────────────────────────────
-- Dit stond eerst op een half uur, omdat elke ronde van alle taken de
-- werkopdracht-PDF ophaalde en opnieuw wegschreef — tweeëntwintig
-- downloads per ronde voor documenten die nooit veranderen.
--
-- Sinds de sync bestaande werkbonnen overslaat kost een ronde drie
-- seconden en nul downloads. Daarmee vervalt die rem. Vijf minuten
-- betekent dat een wijziging in de planning bij de ploeg is voordat
-- iemand in de auto stapt.
--
-- Het venster loopt van 04:00 tot 19:55 UTC — dat is 06:00 tot 21:55 in
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
  '*/5 4-19 * * *',
  $$select public.clickup_hartslag();$$
);


-- ── C. VERIFICATIE ────────────────────────────────────────────

select 'de hartslag staat ingepland' as controle,
       (select case when active then schedule else 'NEE — staat uit' end
        from cron.job where jobname = 'nmzgo-clickup-hartslag') as gevonden,
       '*/5 4-19 * * *' as verwacht
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

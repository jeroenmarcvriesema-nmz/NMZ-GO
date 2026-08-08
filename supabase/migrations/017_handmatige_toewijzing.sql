-- ============================================================
-- NMZ GO — Migratie 017: handmatige toewijzing overleeft de sync
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- De synchronisatie wist per werkbon álle toewijzingen en zet ze
-- opnieuw uit ClickUp. Dat was bewust — ClickUp is leidend — maar het
-- gevolg was niet doordacht: wie iemand handmatig aan een klus hangt,
-- ziet dat bij de eerstvolgende ronde weer verdwijnen. Er staat geen
-- foutmelding bij en er is geen spoor van. Iemand denkt dat hij is
-- ingepland en staat er de volgende ochtend niet meer op.
--
-- Dat raakt precies wat er gevraagd was: handmatig een klus kunnen
-- toewijzen als er iemand uitvalt of als er werk tussendoor komt. Zoals
-- het stond, hield dat het geen dag vol.
--
-- De oplossing is een streep tussen twee soorten toewijzingen. ClickUp
-- beheert wat ClickUp heeft gemaakt en laat de rest met rust. Een mens
-- die iemand toevoegt overschrijft ClickUp bewust, en dat blijft staan
-- tot een mens hem er weer afhaalt.
-- ============================================================

begin;

alter table public.werkbon_medewerkers
  add column if not exists handmatig boolean not null default false;

comment on column public.werkbon_medewerkers.handmatig is
  'Door een mens toegevoegd in NMZ GO in plaats van door de ClickUp-'
  'synchronisatie. De sync laat deze rijen staan; alleen een mens haalt '
  'ze er weer af.';

-- Alles wat er nu staat komt uit de synchronisatie, dus dat blijft
-- false. Dat is geen aanname: er was tot nu toe geen scherm waarmee je
-- handmatig kon toewijzen zonder dat het meteen weer werd gewist.

-- ── Jeroen als ClickUp-naam ──────────────────────────────────
-- Zodat de synchronisatie hem herkent zodra hij in ClickUp op een taak
-- wordt gezet.

update public.personen
   set clickup_label = 'Jeroen'
 where naam = 'Jeroen' and clickup_label is null;


-- ── VERIFICATIE ───────────────────────────────────────────────

select 'kolom handmatig bestaat' as controle,
       (select case when count(*) = 1 then 'ja' else 'NEE' end
        from information_schema.columns
        where table_schema='public' and table_name='werkbon_medewerkers'
          and column_name='handmatig') as gevonden,
       'ja' as verwacht
union all
select 'bestaande toewijzingen staan op automatisch',
       (select count(*)::text from public.werkbon_medewerkers where not handmatig),
       'alle 41'
union all
select 'Jeroen heeft een ClickUp-naam',
       (select coalesce(clickup_label, 'NEE') from public.personen where naam = 'Jeroen'),
       'Jeroen';

commit;

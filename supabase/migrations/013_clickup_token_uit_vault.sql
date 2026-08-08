-- ============================================================
-- NMZ GO — Migratie 013: het ClickUp-token uit Vault halen
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- De Edge Function heeft het ClickUp-token nodig. Dat token staat in
-- Vault, niet als omgevingsvariabele van de functie — één plek waar
-- geheimen wonen, en Vault houdt bij wanneer er iets verandert.
--
-- Waarom een functie en niet rechtstreeks lezen: vault.decrypted_secrets
-- is een view op alles wat er in de kluis ligt. Wie daar bij mag, mag
-- bij elk geheim — ook bij de service-role-sleutel. Deze functie geeft
-- precies één geheim terug en niets anders, en is alleen voor
-- service_role. Een browser of een ingelogde gebruiker komt er niet bij.
--
-- Het token zelf zet je er los in (niet in deze migratie, want dan zou
-- het in de repo staan):
--   select vault.create_secret('<token>', 'clickup_token');
-- en bij een nieuw token:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'clickup_token'),
--     '<nieuw token>');
-- ============================================================

begin;

create or replace function public.geef_clickup_token()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'clickup_token';
$$;

-- Standaard mag iedereen een nieuwe functie uitvoeren. Dat is hier
-- precies niet de bedoeling: eerst alles intrekken, dan één rol terug.
revoke execute on function public.geef_clickup_token() from public;
revoke execute on function public.geef_clickup_token() from anon;
revoke execute on function public.geef_clickup_token() from authenticated;
grant  execute on function public.geef_clickup_token() to service_role;

comment on function public.geef_clickup_token() is
  'Geeft het ClickUp-token uit Vault. Alleen voor service_role — de Edge '
  'Function verwerker is de enige aanroeper.';


-- ── VERIFICATIE ───────────────────────────────────────────────

select 'authenticated mag de functie NIET uitvoeren' as controle,
       case when has_function_privilege('authenticated', 'public.geef_clickup_token()', 'execute')
            then 'NEE — staat open' else 'ja' end as gevonden,
       'ja' as verwacht
union all
select 'anon mag de functie NIET uitvoeren',
       case when has_function_privilege('anon', 'public.geef_clickup_token()', 'execute')
            then 'NEE — staat open' else 'ja' end, 'ja'
union all
select 'service_role mag de functie wel uitvoeren',
       case when has_function_privilege('service_role', 'public.geef_clickup_token()', 'execute')
            then 'ja' else 'NEE — functie onbruikbaar' end, 'ja'
union all
select 'er ligt een clickup_token in Vault',
       case when exists (select 1 from vault.secrets where name = 'clickup_token')
            then 'ja' else 'NEE — zet hem met vault.create_secret()' end, 'ja';

commit;

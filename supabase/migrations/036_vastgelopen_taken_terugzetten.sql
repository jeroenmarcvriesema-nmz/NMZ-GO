-- 036 — Taken die op 'bezig' blijven hangen
--
-- De wachtrij kent 'wachtend', 'bezig', 'geslaagd' en 'onverwerkbaar'.
-- Een taak gaat naar 'bezig' zodra hij geclaimd is, en de handler zet
-- hem daarna op geslaagd of mislukt. Dat werkt zolang de handler
-- terugkomt.
--
-- Hij komt niet altijd terug. De rapportgenerator liep tegen "CPU Time
-- exceeded" en werd door de runtime afgekapt — middenin, zonder dat er
-- code meer draaide om iets weg te schrijven. De taak bleef op 'bezig'
-- staan met een lege fout, en `claim_verwerkingstaken` kijkt alleen
-- naar 'wachtend'. Daarmee was hij voorgoed onzichtbaar: geen fout,
-- geen herhaling, geen spoor. Van buiten leek de generator simpelweg
-- niets te doen.
--
-- Dat kan bij elke handler gebeuren en bij elke herstart van de
-- runtime; de generator was alleen de eerste die er zwaar genoeg voor
-- was. Deze functie zet zulke taken terug in de wachtrij.
--
-- De poging telt gewoon mee. Een taak die drie keer achter elkaar de
-- runtime omlegt hoort na vijf keer onverwerkbaar te worden, net als
-- elke andere blijvende fout — anders draait hij eeuwig rond en neemt
-- hij elke ronde de plek in van werk dat wél kan slagen.

create or replace function public.taken_terugzetten(
  p_ouder_dan interval default interval '10 minutes'
)
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  aantal integer;
begin
  with vastgelopen as (
    update public.verwerkingstaken
       set status = case
             when pogingen >= max_pogingen then 'onverwerkbaar'
             else 'wachtend'
           end,
           fout = 'afgebroken zonder afronding (runtime gestopt of tijd op)',
           beschikbaar_vanaf = now(),
           geclaimd_op = null,
           afgerond_op = case
             when pogingen >= max_pogingen then now()
             else afgerond_op
           end
     where status = 'bezig'
       and geclaimd_op is not null
       and geclaimd_op < now() - p_ouder_dan
    returning 1
  )
  select count(*) into aantal from vastgelopen;

  return aantal;
end;
$$;

revoke execute on function public.taken_terugzetten(interval) from public, anon, authenticated;

comment on function public.taken_terugzetten(interval) is
  'Zet taken die zonder afronding op bezig bleven staan terug in de wachtrij. Draait aan het begin van elke verwerkingsronde.';

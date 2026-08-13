-- 031 — "Nog spuiten/isoleren" als eigen stilleg-status
--
-- De lijst in ClickUp kent zes statussen waarmee een klus kan blijven
-- liggen. NMZ GO kende er drie: on hold, onhold door asbest, en
-- opnieuw inplannen/later. "Nog spuiten/isoleren" viel daardoor terug
-- op het algemene "on hold" — terwijl dat juist de status is die zegt
-- wélk werk er nog moet gebeuren, en dus wie er ingepland moet worden.
--
-- De naam is precies zoals hij in de lijst staat. Wijkt hij af, dan
-- weigert ClickUp de statuswijziging en komt de taak met een fout terug
-- in de wachtrij; hij gaat niet stil de verkeerde kant op.

alter table public.clickup_instellingen
  add column if not exists status_spuiten_isoleren text;

-- Alleen invullen waar het nog leeg is: een tenant die zijn eigen naam
-- heeft gekozen houdt die.
update public.clickup_instellingen
   set status_spuiten_isoleren = 'nog spuiten/isoleren'
 where status_spuiten_isoleren is null;

comment on column public.clickup_instellingen.status_spuiten_isoleren is
  'ClickUp-status voor een klus die stilligt omdat er nog gespoten of geïsoleerd moet worden. Moet letterlijk overeenkomen met de statusnaam in de ClickUp-lijst.';

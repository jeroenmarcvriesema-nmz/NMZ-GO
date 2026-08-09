-- 016 — De pilotgroep als persoon vastleggen
--
-- Deze migratie is destijds rechtstreeks op de database toegepast en had
-- geen bestand in de repo. Dat is hersteld: wie het project opnieuw
-- opzet krijgt nu dezelfde uitkomst als de draaiende omgeving.
--
-- Waarom deze stap bestond: de vier man die de pilot draaien moesten aan
-- klussen gekoppeld kunnen worden vóórdat ze een account hadden. Het
-- personenregister uit migratie 014 maakt dat mogelijk; hier zetten we
-- de namen erin, met het label waaronder ze in ClickUp staan.
--
-- Jeffrey en Sami zijn eerste man, Thimmoty en Abdel tweede man. Dat
-- onderscheid staat bewust níet in de database: het verandert niets aan
-- rechten of aan wat iemand ziet. Het is een werkafspraak, geen rol.

insert into public.personen (tenant_id, naam, clickup_label, actief)
select t.id, n.naam, n.naam, true
from public.tenants t
cross join (values ('Jeffrey'), ('Sami'), ('Thimmoty'), ('Abdel')) as n(naam)
on conflict do nothing;

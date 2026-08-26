-- ============================================================
-- NMZ GO — de stand van het project, gemeten in plaats van onthouden
-- ============================================================
-- Draai deze query in plaats van cijfers op te zoeken in een document.
--
-- Waarom dit bestand bestaat: de documentatie in .ai/ heeft maandenlang
-- getallen bevat die verouderden zonder dat iemand het merkte. Een
-- sessie las "0 foto's" terwijl er 67 in de database stonden, en trok
-- daar verkeerde conclusies uit. Een getal in een document is een
-- momentopname die zich voordoet als een feit.
--
-- Afspraak: documentatie bevat regels en besluiten, geen tellingen.
-- Wil je weten hoe het ervoor staat, meet het dan hier.
-- ============================================================

select
  (select count(*) from werkbonnen)                                    as werkbonnen,
  (select count(*) from werkbonnen where clickup_taak_id is not null)  as uit_clickup,
  (select count(*) from werkbonnen where opgeleverd_op is not null)    as opgeleverd,
  (select count(*) from taken)                                         as punten,
  (select count(*) from taken where voltooid)                          as punten_afgevinkt,
  (select count(*) from fotos)                                         as fotos,
  (select count(distinct werkbon_id) from fotos)                       as bonnen_met_fotos,
  (select count(*) from fotos where clickup_geupload_op is not null)   as fotos_naar_clickup,
  (select count(*) from fotos where opgeruimd_op is not null)          as fotos_opgeruimd,
  (select count(*) from rapportages)                                   as rapportages,
  (select count(*) from profiles)                                      as accounts,
  (select count(*) from personen)                                      as personen,
  (select count(*) from werkbonnen
     where opdrachtnummer is not null and opdrachtnummer <> '')        as met_opdrachtnummer;

-- Wie er in het veld werkt, en sinds wanneer.
select
  p.naam,
  p.rol,
  count(f.id)                                        as fotos,
  max(f.created_at)::date                            as laatste_foto
from profiles p
left join fotos f on f.uploader_id = p.id
group by p.naam, p.rol
having count(f.id) > 0
order by count(f.id) desc;

-- De wachtrij: draait de verwerker, en valt er iets om?
select
  soort,
  status,
  count(*) as aantal,
  max(aangemaakt_op) as laatste
from verwerkingstaken
group by soort, status
order by soort, status;

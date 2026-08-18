-- 037 — Het opleverrapport mag de documentenbucket in
--
-- De generator schreef zijn document weg en kreeg:
--   "mime type text/html; charset=utf-8 is not supported"
--
-- `werkbon-documenten` liet alleen PDF en afbeeldingen toe. Dat was
-- terecht zolang die bucket alleen werkopdrachten en werktekeningen
-- droeg; nu komt het opleverrapport erbij en dat is HTML — het draagt
-- zijn eigen A4-drukregels mee, zodat afdrukken de PDF geeft.
--
-- Waarom dit te verantwoorden is: schrijven in deze bucket kan alleen
-- met `mag_werk_beheren()` (zie de insert-policy), dus uitvoerder of
-- hoger. De bucket is besloten en wordt alleen via ondertekende links
-- geopend. Het scherm zelf blijft bij het uploaden op PDF controleren;
-- deze lijst is de achtervang, niet de enige regel.

update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'text/html']
 where id = 'werkbon-documenten';

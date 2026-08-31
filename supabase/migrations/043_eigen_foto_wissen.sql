-- 043 — Je eigen foto kunnen weghalen
--
-- Verwijderen mocht alleen kantoor (`mag_werk_beheren()`). Een
-- zwamsaneerder die per ongeluk zijn schoen fotografeert, of een foto
-- maakt in de verkeerde kruipruimte, kon die niet weg krijgen — hij kon
-- er alleen een goede naast zetten. Dat levert een fotorapportage op
-- met ruis erin, en die gaat naar de opdrachtgever.
--
-- Wat er bijkomt is bewust smal:
--
--   * alleen je eigen foto (`uploader_id = auth.uid()`),
--   * alleen op een klus waar je op staat (`mag_bij_werkbon`),
--   * en alleen zolang de bon niet is opgeleverd.
--
-- Dat laatste is dezelfde regel als bij het weghalen van een punt
-- (migratie 032): een opgeleverd dossier is dicht. Wat de opdrachtgever
-- heeft gezien mag er niet achteraf uit, ook niet door degene die het
-- er zelf in heeft gezet.
--
-- Het recht van kantoor blijft ongewijzigd. Dat is geen vergetelheid:
-- die groep mag ook nu al opruimen in een opgeleverd dossier, en dat
-- veranderen is een andere beslissing dan deze.
--
-- Het bestand in de bucket blijft even staan; de opruimronde uit
-- migratie 027 haalt weg waar geen rij meer naar wijst.

drop policy if exists "fotos_delete" on public.fotos;
create policy "fotos_delete"
  on public.fotos for delete
  using (
    tenant_id = public.get_mijn_tenant()
    and (
      public.mag_werk_beheren()
      or (
        uploader_id = auth.uid()
        and public.mag_bij_werkbon(werkbon_id)
        and not exists (
          select 1 from public.werkbonnen w
           where w.id = fotos.werkbon_id and w.opgeleverd_op is not null
        )
      )
    )
  );

comment on policy "fotos_delete" on public.fotos is
  'Kantoor mag alle foto''s weghalen. Een medewerker alleen zijn eigen foto, op een klus waar hij op staat, en niet meer nadat de bon is opgeleverd.';

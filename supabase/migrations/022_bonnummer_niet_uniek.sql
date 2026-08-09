-- 022 — Het bonnummer hoeft niet uniek te zijn
--
-- Twee ClickUp-taken vielen elke synchronisatieronde af met
-- "duplicate key value violates unique constraint
-- werkbonnen_bonnummer_key": Bentinckstraat 63 in Amsterdam en
-- Rembrandstraat 79 t/m 129 in Den Haag. Dat is niet aan de gegevens
-- maar aan deze regel.
--
-- Het bonnummer komt uit het opdrachtnummer van de werkvoorbereider, en
-- dat nummer hoort bij de ópdracht, niet bij de klus. Eén opdracht kan
-- prima twee taken opleveren — een eerste ronde en meerwerk, of twee
-- fasen op hetzelfde adres. In ClickUp zijn dat twee taken, dus in NMZ
-- GO horen dat twee werkbonnen te zijn. De uniciteitseis dwong daar één
-- van te maken, en het gevolg was dat de tweede helemaal niet binnenkwam:
-- een ploeg die maandag op een adres staat waar geen bon van is.
--
-- Dubbele werkbonnen worden al voorkomen door de sleutel die dat
-- daadwerkelijk hoort te doen: `werkbonnen_clickup_uniek` op
-- (tenant_id, clickup_taak_id). Eén ClickUp-taak blijft één werkbon.
-- Deze constraint voegde daar niets aan toe behalve uitval.
--
-- Wat blijft: een gewone index, want er wordt op bonnummer gezocht.

alter table public.werkbonnen
  drop constraint if exists werkbonnen_bonnummer_key;

create index if not exists werkbonnen_bonnummer_idx
  on public.werkbonnen (tenant_id, bonnummer);

comment on column public.werkbonnen.bonnummer is
  'Het opdrachtnummer van de werkvoorbereider. Bewust niet uniek: een '
  'opdracht kan meerdere klussen opleveren. Uniciteit zit op '
  '(tenant_id, clickup_taak_id).';

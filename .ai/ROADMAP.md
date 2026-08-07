# ROADMAP.md — Toekomstvisie en bekende aandachtspunten

Dingen die bewust **nog niet** gebouwd zijn, maar wel op de horizon staan. Bouw deze niet ongevraagd — houd er wel rekening mee bij architecturale keuzes, zodat ze later zonder grote herbouw toegevoegd kunnen worden.

## Geplande uitbreidingen

- **PDF-export van rapportages.** Vermoedelijk een losse, later toe te voegen laag (mogelijk een edge function of externe service, omdat client-side PDF-generatie bij foto-rijke rapporten beperkingen kent) — een architecturale keuze die eerst met de gebruiker wordt afgestemd. Bevestigd nog niet geïmplementeerd (zie README).
- **Signed URLs voor foto-opslag**, ter vervanging van de huidige public `werkbon-fotos`-bucket, zodra privacy/beveiliging van foto's zwaarder gaat wegen.
- **Geautomatiseerde tests** (unit/integration), momenteel volledig afwezig — introductie hiervan is een bewuste, apart besproken beslissing, niet iets dat stilzwijgend in een feature-taak meelift.
- **Een uitgewerkt dark-mode-systeem**, verder dan de huidige losse `.nav-dark`-utility — pas bouwen na een expliciete designbeslissing (zie `DESIGN_SYSTEM.md`).
- **E-mailbevestiging bij registratie** heroverwegen naarmate de gebruikersgroep en het beheer daarvan groeit (momenteel uitgeschakeld voor intern gebruiksgemak, zie README).

## Bekende aandachtspunten (huidige stand)

- **E-mailbevestiging:** Supabase stuurt standaard een bevestigingsmail bij registratie. Voor intern gebruik is dit uit te schakelen via Supabase → Authentication → Settings → "Enable email confirmations" uit.
- **Foto storage:** de bucket `werkbon-fotos` moet public zijn voor directe URL's. Voor extra beveiliging kan dit later worden omgezet naar signed URLs (zie hierboven).
- **PDF-export:** Rapporten → PDF-export is nog niet geïmplementeerd in de MVP.

## Groeiprincipe

Groei blijft bewust beheerst. Bij twijfel of iets een architecturale uitbreiding rechtvaardigt (nieuwe backend-laag, nieuwe grote dependency, nieuwe globale state), is het antwoord: bespreek het eerst met de gebruiker, bouw het niet stilzwijgend als bijproduct van een kleinere taak. Zie `CLAUDE.md` → Projectvisie en Verboden acties.

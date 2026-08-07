-- ══════════════════════════════════════════════════════════════
--  ROLLENTEST — verplicht na elke RLS-wijziging (.ai/GIT_WORKFLOW.md)
-- ══════════════════════════════════════════════════════════════
--
-- Wat dit bestand doet: het speelt een beheerder, een medewerker en
-- een niet-ingelogde bezoeker na, en controleert per rol wat er wél
-- en niet mag. Geen echte login nodig — de rol wordt nagebootst met
-- `set local role` plus een JWT-claim, precies zoals PostgREST dat
-- voor de app doet.
--
-- Draai dit als `postgres` (SQL-editor of MCP-connector), blok voor
-- blok. Elk blok is één statement-groep: de `set local` geldt binnen
-- die groep en valt daarna vanzelf terug.
--
-- Schrijfacties worden altijd teruggedraaid: elke poging eindigt met
-- een opzettelijke fout (`ZZ001`) die het subtransactieblok afbreekt.
-- Er blijft dus niets van de test in de database achter, behalve de
-- testrijen uit blok 0 — die ruimt blok 4 op.
--
-- Vul vóór gebruik de vier UUID's in blok 0 in.

-- ── 0. TESTDATA ───────────────────────────────────────────────
-- Vul in:
--   :beheerder_id  profiles.id van een beheerder
--   :medewerker_id profiles.id van een medewerker met minstens één
--                  toegewezen werkbon
--   :tenant_a      tenant_id van beide bovenstaande profielen
-- De tweede tenant en de testrijen maakt dit blok zelf aan.

insert into public.tenants (id, naam)
values ('00000000-0000-4000-8000-0000000000b2', 'ZZ-TEST tenant B')
on conflict (id) do nothing;

insert into public.projecten (id, tenant_id, naam, adres)
values ('00000000-0000-4000-8000-000000000003', :'tenant_a', 'ZZ-TEST project A', 'Teststraat 1')
on conflict (id) do nothing;

-- Werkbon in de eigen tenant die NIET aan de medewerker is toegewezen.
insert into public.werkbonnen (id, tenant_id, bonnummer, projectnaam, adres, project_id)
values ('00000000-0000-4000-8000-000000000001', :'tenant_a', 'ZZ-TEST-A',
        'ZZ-TEST niet toegewezen', 'Teststraat 1', '00000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

-- Werkbon in een vreemde tenant.
insert into public.werkbonnen (id, tenant_id, bonnummer, projectnaam, adres)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b2',
        'ZZ-TEST-B', 'ZZ-TEST andere tenant', 'Vreemdestraat 2')
on conflict (id) do nothing;

insert into public.taken (id, tenant_id, werkbon_id, titel)
values ('00000000-0000-4000-8000-000000000004', :'tenant_a',
        '00000000-0000-4000-8000-000000000001', 'ZZ-TEST taak vreemde bon')
on conflict (id) do nothing;


-- ── 1. MEDEWERKER — lezen ─────────────────────────────────────
-- Verwacht: alleen de eigen werkbon en de taken daarvan. Geen
-- projecten, geen andere profielen, geen verwerkingswachtrij, en
-- niets uit een andere tenant.

set local role authenticated;
set local request.jwt.claims = '{"sub":"<medewerker_id>","role":"authenticated"}';

select 1 as nr, 'werkbonnen zichtbaar (alleen eigen)' as test,
       (select count(*) from public.werkbonnen)::text as gevonden, 'aantal eigen bonnen' as verwacht
union all select 2, 'werkbon eigen tenant, niet toegewezen',
       (select count(*) from public.werkbonnen where bonnummer = 'ZZ-TEST-A')::text, '0'
union all select 3, 'werkbon andere tenant',
       (select count(*) from public.werkbonnen where bonnummer = 'ZZ-TEST-B')::text, '0'
union all select 4, 'taak van vreemde bon zichtbaar',
       (select count(*) from public.taken where titel = 'ZZ-TEST taak vreemde bon')::text, '0'
union all select 5, 'projecten zichtbaar (beheerder-only)',
       (select count(*) from public.projecten)::text, '0'
union all select 6, 'profiles zichtbaar (alleen zichzelf)',
       (select count(*) from public.profiles)::text, '1'
union all select 7, 'verwerkingstaken zichtbaar (beheerder-only)',
       (select count(*) from public.verwerkingstaken)::text, '0'
union all select 8, 'verwerkingsronden zichtbaar (beheerder-only)',
       (select count(*) from public.verwerkingsronden)::text, '0'
order by nr;


-- ── 2. MEDEWERKER — schrijven ─────────────────────────────────
-- Verwacht: alleen taken van de eigen werkbon afvinken. Al het
-- overige geweigerd — met name rol-escalatie en tenant-hop.

set local role authenticated;
set local request.jwt.claims = '{"sub":"<medewerker_id>","role":"authenticated"}';

create temp table zz_uitslag(nr int, test text, resultaat text, verwacht text) on commit drop;

do $$
declare
  v            int;
  eigen_bon    uuid := (select werkbon_id from public.werkbon_medewerkers
                        where medewerker_id = auth.uid() limit 1);
  tenant_b     uuid := '00000000-0000-4000-8000-0000000000b2';
  vreemde_taak uuid := '00000000-0000-4000-8000-000000000004';
begin
  begin
    update public.profiles set rol = 'beheerder' where id = auth.uid();
    get diagnostics v = row_count;
    raise exception using errcode = 'ZZ001', message = v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (1,'eigen rol naar beheerder zetten','GELUKT ('||sqlerrm||' rijen)','geweigerd');
    when others          then insert into zz_uitslag values (1,'eigen rol naar beheerder zetten','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    update public.profiles set tenant_id = tenant_b where id = auth.uid();
    get diagnostics v = row_count;
    raise exception using errcode = 'ZZ001', message = v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (2,'eigen profiel naar andere tenant','GELUKT ('||sqlerrm||' rijen)','geweigerd');
    when others          then insert into zz_uitslag values (2,'eigen profiel naar andere tenant','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    insert into public.werkbonnen (bonnummer, projectnaam, adres) values ('ZZ-HACK','x','y');
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (3,'werkbon aanmaken','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (3,'werkbon aanmaken','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    update public.taken set voltooid = true where werkbon_id = eigen_bon;
    get diagnostics v = row_count;
    raise exception using errcode = 'ZZ001', message = v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (4,'taak van eigen werkbon afvinken','GELUKT ('||sqlerrm||' rijen)','mag (>0 rijen)');
    when others          then insert into zz_uitslag values (4,'taak van eigen werkbon afvinken','geweigerd: '||sqlerrm,'mag (>0 rijen)');
  end;

  begin
    update public.taken set voltooid = true where id = vreemde_taak;
    get diagnostics v = row_count;
    raise exception using errcode = 'ZZ001', message = v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (5,'taak van vreemde werkbon afvinken','geraakte rijen: '||sqlerrm,'0 rijen');
    when others          then insert into zz_uitslag values (5,'taak van vreemde werkbon afvinken','geweigerd: '||sqlerrm,'0 rijen');
  end;

  begin
    update public.taken set tenant_id = tenant_b where werkbon_id = eigen_bon;
    get diagnostics v = row_count;
    raise exception using errcode = 'ZZ001', message = v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (6,'eigen taak naar andere tenant','GELUKT ('||sqlerrm||' rijen)','geweigerd');
    when others          then insert into zz_uitslag values (6,'eigen taak naar andere tenant','geweigerd: '||sqlerrm,'geweigerd');
  end;

  -- 7 t/m 7c: afronden mag sinds migratie 005, maar alleen de
  -- kolom `status` en alleen naar bezig/voltooid.
  begin
    update public.werkbonnen set status = 'voltooid' where id = eigen_bon;
    get diagnostics v = row_count;
    raise exception using errcode = 'ZZ001', message = v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (7,'eigen werkbon op voltooid zetten','GELUKT ('||sqlerrm||' rijen)','mag (1 rij)');
    when others          then insert into zz_uitslag values (7,'eigen werkbon op voltooid zetten','geweigerd: '||sqlerrm,'mag (1 rij)');
  end;

  begin
    update public.werkbonnen set status = 'open' where id = eigen_bon;
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (71,'eigen werkbon terug op open zetten','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (71,'eigen werkbon terug op open zetten','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    update public.werkbonnen set adres = 'ZZ-GEKAAPT' where id = eigen_bon;
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (72,'adres van eigen werkbon wijzigen','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (72,'adres van eigen werkbon wijzigen','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    update public.werkbonnen set status = 'voltooid' where id = '00000000-0000-4000-8000-000000000001';
    get diagnostics v = row_count;
    raise exception using errcode = 'ZZ001', message = v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (73,'werkbon van een collega op voltooid zetten','geraakte rijen: '||sqlerrm,'0 rijen');
    when others          then insert into zz_uitslag values (73,'werkbon van een collega op voltooid zetten','geweigerd: '||sqlerrm,'0 rijen');
  end;

  begin
    insert into public.projecten (naam, adres) values ('ZZ-HACK','x');
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (8,'project aanmaken','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (8,'project aanmaken','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    insert into public.verwerkingstaken (soort, payload) values ('zz.hack','{}'::jsonb);
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (9,'verwerkingstaak direct inserten','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (9,'verwerkingstaak direct inserten','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    perform public.taak_aanmaken('zz.hack','{}'::jsonb);
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (10,'taak_aanmaken() aanroepen','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (10,'taak_aanmaken() aanroepen','geweigerd: '||sqlerrm,'geweigerd');
  end;

  -- 11 t/m 13: werkdag_logs (migratie 006). Een monteur mag zijn eigen
  -- werkdag starten en stoppen, maar zijn starttijd niet vervalsen en
  -- geen log op naam van een collega zetten.
  begin
    insert into public.werkdag_logs (medewerker_id, werkbon_id) values (auth.uid(), eigen_bon);
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (11,'eigen werkdag starten','GELUKT','mag');
    when others          then insert into zz_uitslag values (11,'eigen werkdag starten','geweigerd: '||sqlerrm,'mag');
  end;

  begin
    update public.werkdag_logs set start_tijd = now() - interval '4 hours'
     where medewerker_id = auth.uid();
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (12,'eigen starttijd vervalsen','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (12,'eigen starttijd vervalsen','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    insert into public.werkdag_logs (medewerker_id, werkbon_id, datum)
    values ('<beheerder_id>', eigen_bon, current_date - 1);
    raise exception using errcode = 'ZZ001', message = '1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag values (13,'werkdag voor een collega aanmaken','GELUKT','geweigerd');
    when others          then insert into zz_uitslag values (13,'werkdag voor een collega aanmaken','geweigerd: '||sqlerrm,'geweigerd');
  end;
end $$;

select * from zz_uitslag order by nr;


-- ── 3. BEHEERDER ──────────────────────────────────────────────
-- Verwacht: alles binnen de eigen tenant, niets daarbuiten. Een
-- beheerder mag rollen zetten, maar geen rij naar een andere tenant
-- verplaatsen en niets van een andere tenant zien of raken.

set local role authenticated;
set local request.jwt.claims = '{"sub":"<beheerder_id>","role":"authenticated"}';

create temp table zz_uitslag_b(nr int, test text, resultaat text, verwacht text) on commit drop;

do $$
declare
  v        int;
  tenant_b uuid := '00000000-0000-4000-8000-0000000000b2';
  bon_a    uuid := '00000000-0000-4000-8000-000000000001';
  bon_b    uuid := '00000000-0000-4000-8000-000000000002';
begin
  begin
    insert into public.werkbonnen (bonnummer, projectnaam, adres) values ('ZZ-B1','x','y');
    raise exception using errcode='ZZ001', message='1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (1,'werkbon aanmaken in eigen tenant','GELUKT','mag');
    when others          then insert into zz_uitslag_b values (1,'werkbon aanmaken in eigen tenant','geweigerd: '||sqlerrm,'mag');
  end;

  begin
    insert into public.werkbonnen (tenant_id, bonnummer, projectnaam, adres) values (tenant_b,'ZZ-B2','x','y');
    raise exception using errcode='ZZ001', message='1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (2,'werkbon aanmaken in andere tenant','GELUKT','geweigerd');
    when others          then insert into zz_uitslag_b values (2,'werkbon aanmaken in andere tenant','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    update public.werkbonnen set projectnaam = 'ZZ-GEKAAPT' where id = bon_b;
    get diagnostics v = row_count;
    raise exception using errcode='ZZ001', message=v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (3,'werkbon andere tenant wijzigen','geraakte rijen: '||sqlerrm,'0 rijen');
    when others          then insert into zz_uitslag_b values (3,'werkbon andere tenant wijzigen','geweigerd: '||sqlerrm,'0 rijen');
  end;

  begin
    update public.werkbonnen set tenant_id = tenant_b where id = bon_a;
    get diagnostics v = row_count;
    raise exception using errcode='ZZ001', message=v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (4,'eigen werkbon naar andere tenant','GELUKT ('||sqlerrm||' rijen)','geweigerd');
    when others          then insert into zz_uitslag_b values (4,'eigen werkbon naar andere tenant','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    delete from public.werkbonnen where id = bon_b;
    get diagnostics v = row_count;
    raise exception using errcode='ZZ001', message=v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (5,'werkbon andere tenant verwijderen','geraakte rijen: '||sqlerrm,'0 rijen');
    when others          then insert into zz_uitslag_b values (5,'werkbon andere tenant verwijderen','geweigerd: '||sqlerrm,'0 rijen');
  end;

  begin
    update public.profiles set rol = 'beheerder' where id <> auth.uid();
    get diagnostics v = row_count;
    raise exception using errcode='ZZ001', message=v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (6,'rol van medewerker verhogen','GELUKT ('||sqlerrm||' rijen)','mag');
    when others          then insert into zz_uitslag_b values (6,'rol van medewerker verhogen','geweigerd: '||sqlerrm,'mag');
  end;

  begin
    update public.profiles set tenant_id = tenant_b where id <> auth.uid();
    get diagnostics v = row_count;
    raise exception using errcode='ZZ001', message=v::text;
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (7,'profiel naar andere tenant','GELUKT ('||sqlerrm||' rijen)','geweigerd');
    when others          then insert into zz_uitslag_b values (7,'profiel naar andere tenant','geweigerd: '||sqlerrm,'geweigerd');
  end;

  begin
    insert into public.projecten (naam, adres) values ('ZZ-B8','x');
    raise exception using errcode='ZZ001', message='1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (8,'project aanmaken','GELUKT','mag');
    when others          then insert into zz_uitslag_b values (8,'project aanmaken','geweigerd: '||sqlerrm,'mag');
  end;

  begin
    insert into public.verwerkingstaken (soort, payload) values ('zz.hack','{}'::jsonb);
    raise exception using errcode='ZZ001', message='1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (9,'verwerkingstaak direct inserten','GELUKT','geweigerd (alleen via taak_aanmaken)');
    when others          then insert into zz_uitslag_b values (9,'verwerkingstaak direct inserten','geweigerd: '||sqlerrm,'geweigerd (alleen via taak_aanmaken)');
  end;

  begin
    perform public.taak_aanmaken('zz.test','{}'::jsonb);
    raise exception using errcode='ZZ001', message='1';
  exception
    when sqlstate 'ZZ001' then insert into zz_uitslag_b values (10,'taak_aanmaken() aanroepen','GELUKT','mag');
    when others          then insert into zz_uitslag_b values (10,'taak_aanmaken() aanroepen','geweigerd: '||sqlerrm,'mag');
  end;
end $$;

select * from zz_uitslag_b order by nr;


-- ── 4. NIET INGELOGD ──────────────────────────────────────────
-- Verwacht: overal nul, en geen enkel uitnodigingstoken zichtbaar.
-- De registratiepagina moet een link wél kunnen controleren; dat
-- loopt sinds migratie 005 via uitnodiging_controleren(), die alleen
-- ja of nee teruggeeft.
--
-- Zet vóór dit blok een testuitnodiging klaar (als postgres):
--   insert into public.uitnodigingen (token, tenant_id)
--   values ('ZZ-GEHEIM-TOKEN', '00000000-0000-4000-8000-0000000000b2');

set local role anon;

select 1 as nr, 'anon: werkbonnen'    as test, (select count(*) from public.werkbonnen)::text    as gevonden, '0' as verwacht
union all select 2, 'anon: profiles',        (select count(*) from public.profiles)::text,        '0'
union all select 3, 'anon: taken',           (select count(*) from public.taken)::text,           '0'
union all select 4, 'anon: projecten',       (select count(*) from public.projecten)::text,       '0'
union all select 5, 'anon: tenants',         (select count(*) from public.tenants)::text,         '0'
union all select 6, 'anon: uitnodigingen',   (select count(*) from public.uitnodigingen)::text,   '0'
union all select 7, 'anon: zichtbare tokens',
       (select coalesce(string_agg(token, ','), 'geen') from public.uitnodigingen), 'geen'
union all select 8, 'anon: geldig token via functie',
       (select public.uitnodiging_controleren('ZZ-GEHEIM-TOKEN'))::text, 'true'
union all select 9, 'anon: onzin-token via functie',
       (select public.uitnodiging_controleren('bestaat-niet'))::text, 'false'
order by nr;


-- ── 5. OPRUIMEN ───────────────────────────────────────────────
-- Draai dit altijd, ook als een blok hierboven is afgebroken.

delete from public.werkdag_logs     where werkbon_id in (select id from public.werkbonnen where bonnummer like 'ZZ-%');
delete from public.taken            where titel like 'ZZ-%';
delete from public.werkbonnen       where bonnummer like 'ZZ-%';
delete from public.projecten        where naam like 'ZZ-%';
delete from public.verwerkingstaken where soort like 'zz.%';
delete from public.uitnodigingen    where token like 'ZZ-%';
delete from public.tenants          where naam like 'ZZ-TEST%';

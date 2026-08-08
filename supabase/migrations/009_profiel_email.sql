-- ============================================================
-- NMZ GO — Migratie 009: e-mailadres op het profiel
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- De knop "wachtwoord resetten" in het medewerkersscherm gaf het
-- profiel-id door aan een functie die een e-mailadres verwacht. Die
-- knop kon dus nooit gewerkt hebben — en dat viel niet op omdat er
-- geen foutafhandeling op zat.
--
-- De oorzaak zit dieper: `profiles` heeft geen e-mailadres, en
-- `auth.users` is voor de app niet leesbaar (terecht). Er was dus
-- geen manier om aan het adres te komen.
--
-- Dit voegt het adres toe aan het profiel, houdt het gelijk met
-- auth.users, en vult de bestaande rijen.
-- ============================================================

begin;

alter table public.profiles add column if not exists email text;

-- Bestaande profielen bijwerken.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is distinct from u.email;

-- Nieuwe gebruikers krijgen het adres meteen mee.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_token  text := new.raw_user_meta_data->>'uitnodiging_token';
  v_tenant uuid;
  v_rol    text := 'medewerker';
begin
  if v_token is not null then
    update public.uitnodigingen
       set gebruikt = true
     where token = v_token
       and not gebruikt
       and (verloopt_op is null or verloopt_op > now())
    returning tenant_id into v_tenant;
  end if;

  v_tenant := coalesce(v_tenant, public.get_mijn_tenant());

  if not exists (
    select 1 from public.profiles
    where tenant_id = v_tenant and rol = 'beheerder'
  ) and not exists (
    select 1 from public.profiles
    where tenant_id = v_tenant and rol = 'eigenaar'
  ) then
    v_rol := 'eigenaar';
  end if;

  insert into public.profiles (id, naam, email, rol, tenant_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'naam',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    -- Nooit uit de metadata: die is client-gestuurd.
    v_rol,
    v_tenant
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Wijzigt iemand zijn e-mailadres in Supabase, dan volgt het profiel.
create or replace function public.sync_profiel_email()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profiel_email();

-- Verificatie
select 'profielen met e-mailadres' as controle,
       (select count(*)::text from public.profiles where email is not null) as gevonden,
       (select count(*)::text from public.profiles) as verwacht;

commit;

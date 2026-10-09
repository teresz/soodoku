-- Lista kont (mail, kiedy założone, ostatnie logowanie) dla admina z tabeli site_admins (zob. page_visits.sql).
-- Uruchom raz w Supabase: SQL Editor → New query → wklej → Run. Można puścić ponownie.

create or replace function public.admin_users() returns json
language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.site_admins where email = lower(auth.jwt() ->> 'email')) then return null; end if;
  return (select coalesce(json_agg(u order by u.created_at desc), '[]') from (
    select email, created_at, last_sign_in_at from auth.users where email is not null
  ) u);
end $$;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

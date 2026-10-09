-- Licznik wejść na stronę (dziś i łącznie), widoczny tylko dla adminów z tabeli site_admins.
-- Uruchom raz w Supabase: SQL Editor → New query → wklej → wpisz swój mail w ostatniej linijce → Run. Można puścić ponownie.

-- Jedno urządzenie = losowy identyfikator z przeglądarki (bez maili i IP). hits = ile razy weszło danego dnia.
create table if not exists public.page_visits (
  day    date    not null,
  device text    not null check (length(device) between 8 and 40),
  hits   integer not null default 1,
  primary key (day, device)
);
alter table public.page_visits enable row level security; -- bez polityk: nikt nie czyta ani nie pisze wprost

create table if not exists public.site_admins (email text primary key);
alter table public.site_admins enable row level security;

-- Gra woła to przy każdym wejściu (także bez logowania). Dzień liczony po czasie polskim.
create or replace function public.count_visit(device text) returns void
language sql security definer set search_path = public as $$
  insert into page_visits (day, device) values ((now() at time zone 'Europe/Warsaw')::date, device)
  on conflict (day, device) do update set hits = page_visits.hits + 1;
$$;
grant execute on function public.count_visit(text) to anon, authenticated;

-- Statystyki dla admina; każdy inny dostaje null.
create or replace function public.visit_stats() returns json
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if not exists (select 1 from site_admins where email = lower(auth.jwt() ->> 'email')) then return null; end if;
  return json_build_object(
    'today', (select json_build_object('visits', coalesce(sum(hits), 0), 'devices', count(*)) from page_visits where day = today),
    'total', (select json_build_object('visits', coalesce(sum(hits), 0), 'devices', count(distinct device)) from page_visits),
    'days', (select coalesce(json_agg(d order by d.day), '[]') from (
      select day, sum(hits) as visits, count(*) as devices from page_visits where day > today - 14 group by day) d)
  );
end $$;
revoke execute on function public.visit_stats() from public, anon;
grant execute on function public.visit_stats() to authenticated;

-- Twój mail (ten, którym logujesz się w grze):
insert into public.site_admins (email) values (lower('TWOJ@MAIL.PL')) on conflict do nothing;

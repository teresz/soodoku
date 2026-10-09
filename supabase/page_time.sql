-- Dokładka do page_visits.sql: ile czasu ludzie spędzają na stronie (liczony tylko, gdy karta jest na wierzchu).
-- Uruchom raz w Supabase: SQL Editor → New query → wklej → Run. Można puścić ponownie.

alter table public.page_visits add column if not exists seconds integer not null default 0;

-- Gra dosyła czas co minutę i przy chowaniu karty. Jeden kawałek to najwyżej 2 minuty, żeby nikt nie nabił godzin jednym strzałem.
create or replace function public.add_time(device text, secs integer) returns void
language sql security definer set search_path = public as $$
  insert into page_visits (day, device, hits, seconds)
  values ((now() at time zone 'Europe/Warsaw')::date, device, 0, least(greatest(secs, 0), 120))
  on conflict (day, device) do update set seconds = page_visits.seconds + least(greatest(secs, 0), 120);
$$;
grant execute on function public.add_time(text, integer) to anon, authenticated;

create or replace function public.visit_stats() returns json
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if not exists (select 1 from site_admins where email = lower(auth.jwt() ->> 'email')) then return null; end if;
  return json_build_object(
    'today', (select json_build_object('visits', coalesce(sum(hits), 0), 'devices', count(*), 'seconds', coalesce(sum(seconds), 0)) from page_visits where day = today),
    'total', (select json_build_object('visits', coalesce(sum(hits), 0), 'devices', count(distinct device), 'seconds', coalesce(sum(seconds), 0)) from page_visits),
    'days', (select coalesce(json_agg(d order by d.day), '[]') from (
      select day, sum(hits) as visits, count(*) as devices, sum(seconds) as seconds from page_visits where day > today - 14 group by day) d)
  );
end $$;

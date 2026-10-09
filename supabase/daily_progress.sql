-- Postęp wyzwań dnia dla zalogowanych graczy (opcjonalne konto: mail + hasło).
-- Uruchom raz w Supabase: SQL Editor → New query → wklej → Run. Można puścić ponownie, nic się nie zepsuje.

create table if not exists public.daily_progress (
  user_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  day       date        not null,               -- dzień wyzwania
  ms        integer     not null check (ms >= 0), -- najlepszy czas
  mistakes  smallint    not null default 0,
  hints     smallint    not null default 0,
  on_time   boolean     not null default false, -- zrobione w swoim dniu (tylko to liczy się do streaka)
  done_on   date        not null,               -- kiedy pierwszy raz zrobione
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_progress enable row level security;

-- Każdy widzi i zmienia wyłącznie własne wiersze.
drop policy if exists "daily_progress select own" on public.daily_progress;
drop policy if exists "daily_progress insert own" on public.daily_progress;
drop policy if exists "daily_progress update own" on public.daily_progress;
create policy "daily_progress select own" on public.daily_progress for select to authenticated using (auth.uid() = user_id);
create policy "daily_progress insert own" on public.daily_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "daily_progress update own" on public.daily_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Raz zdobyte „w terminie” nie da się nadpisać na false (np. starszą kopią z innego telefonu).
create or replace function public.daily_progress_keep_best() returns trigger language plpgsql as $$
begin
  new.on_time := new.on_time or old.on_time;
  if old.ms < new.ms then
    new.ms := old.ms; new.mistakes := old.mistakes; new.hints := old.hints;
  end if;
  new.done_on := least(new.done_on, old.done_on);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists daily_progress_keep_best on public.daily_progress;
create trigger daily_progress_keep_best before update on public.daily_progress
  for each row execute function public.daily_progress_keep_best();

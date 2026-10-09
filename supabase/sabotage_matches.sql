-- Mecze Sabotażu zalogowanych graczy: statystyki z podziałem na rywali (po mailu), które przeżywają zmianę telefonu.
-- Uruchom raz w Supabase: SQL Editor → New query → wklej → Run. Można puścić ponownie, nic się nie zepsuje.

create table if not exists public.sabotage_matches (
  user_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  match_id  text        not null check (length(match_id) between 1 and 64), -- id meczu nadane przez telefon
  opponent  text        check (opponent is null or length(opponent) <= 254), -- mail rywala; null = gość (bez konta)
  won       boolean     not null,
  ms        integer     not null check (ms >= 0),            -- czas gry
  level     text        not null check (length(level) <= 16), -- easy / medium / hard
  played_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.sabotage_matches enable row level security;

-- Każdy widzi i dopisuje wyłącznie własne mecze. Zapisanego meczu nie da się zmienić.
drop policy if exists "sabotage_matches select own" on public.sabotage_matches;
drop policy if exists "sabotage_matches insert own" on public.sabotage_matches;
create policy "sabotage_matches select own" on public.sabotage_matches for select to authenticated using (auth.uid() = user_id);
create policy "sabotage_matches insert own" on public.sabotage_matches for insert to authenticated with check (auth.uid() = user_id);

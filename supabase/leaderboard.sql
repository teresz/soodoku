-- Globalny ranking najlepszych czasów (Tetroku: punktów), widoczny dla wszystkich w Statystykach.
-- Uruchom raz w Supabase: SQL Editor → New query → wklej → Run. Można puścić ponownie, nic się nie zepsuje.

-- Jeden wiersz = najlepszy wynik jednego gracza w danym trybie i poziomie.
-- Gracz z kontem to 'u:<id konta>', bez konta 'd:<losowy id przeglądarki>' (ten sam co w licznik wejść, bez maili i IP).
create table if not exists public.leaderboard (
  mode       text        not null check (mode in ('classic', 'clues', 'tetris', 'minesweeper', 'siege')),
  level      text        not null check (length(level) between 1 and 16),
  player     text        not null check (length(player) between 3 and 48),
  user_id    uuid        references auth.users (id) on delete cascade,
  name       text        check (name is null or length(name) <= 24), -- część maila przed @; null = gość
  ms         integer     not null check (ms between 10000 and 86400000),
  score      integer     check (score is null or score >= 0),         -- tylko Tetroku
  runs       integer     not null default 1,                          -- ile wygranych zgłoszono
  record_at  timestamptz not null default now(),                      -- kiedy padł ten rekord
  primary key (mode, level, player)
);
alter table public.leaderboard enable row level security; -- bez polityk: czyta i pisze się tylko przez funkcje niżej
create index if not exists leaderboard_time on public.leaderboard (mode, level, ms);

-- Gra woła to po każdej wygranej (także bez konta). Zapisuje tylko, jeśli to lepszy wynik niż dotychczasowy.
-- Zwraca miejsce gracza i liczbę graczy w tym rankingu albo null, gdy dane są bez sensu.
create or replace function public.submit_score(p_mode text, p_level text, p_ms integer, p_score integer default null, p_device text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  who text;
  nm  text;
  me  public.leaderboard;
  better boolean := false;
begin
  if p_mode not in ('classic', 'clues', 'tetris', 'minesweeper', 'siege') or p_level !~ '^[a-z0-9]{1,16}$'
     or p_ms is null or p_ms < 10000 or p_ms > 86400000 then return null; end if;
  if p_mode = 'tetris' and (p_score is null or p_score < 0 or p_score > 10000000) then return null; end if;
  if p_mode <> 'tetris' then p_score := null; end if;

  if uid is not null then
    who := 'u:' || uid;
    nm := nullif(left(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), 24), '');
  elsif p_device ~ '^[a-z0-9]{8,40}$' then
    who := 'd:' || p_device;
  else
    return null;
  end if;

  select * into me from leaderboard where mode = p_mode and level = p_level and player = who;
  if not found then
    insert into leaderboard (mode, level, player, user_id, name, ms, score) values (p_mode, p_level, who, uid, nm, p_ms, p_score)
    returning * into me;
    better := true;
  else
    better := case when p_mode = 'tetris' then p_score > me.score or (p_score = me.score and p_ms < me.ms) else p_ms < me.ms end;
    update leaderboard set runs = runs + 1, name = nm,
      ms = case when better then p_ms else ms end,
      score = case when better then p_score else score end,
      record_at = case when better then now() else record_at end
    where mode = p_mode and level = p_level and player = who
    returning * into me;
  end if;

  return json_build_object(
    'better', better,
    'rank', 1 + (select count(*) from leaderboard l where l.mode = p_mode and l.level = p_level and (
      case when p_mode = 'tetris' then l.score > me.score or (l.score = me.score and l.ms < me.ms) else l.ms < me.ms end)),
    'players', (select count(*) from leaderboard l where l.mode = p_mode and l.level = p_level)
  );
end $$;
grant execute on function public.submit_score(text, text, integer, integer, text) to anon, authenticated;

-- Nicki graczy z kontem. Nick podaje się przy zakładaniu konta (stare konta: raz w Ustawieniach) i NIE da się go zmienić.
-- Bez nicku w rankingu jest część maila przed @. Wielkość liter bez znaczenia przy sprawdzaniu, czy nick zajęty.
-- Ta sama lista wulgaryzmów jest w src/net/nick.ts (szybka podpowiedź w formularzu); rozstrzyga ta tutaj.
create table if not exists public.profiles (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  nick       text        not null check (nick ~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{3,16}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security; -- tylko przez funkcje niżej
create unique index if not exists profiles_nick_ci on public.profiles (lower(nick));

-- 'ok', 'invalid' (znaki/długość), 'rude' (wulgaryzm) albo 'taken'. Woła to też formularz przed założeniem konta.
create or replace function public.nick_check(p_nick text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  n text := btrim(coalesce(p_nick, ''));
  flat text;
begin
  if n !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{3,16}$' then return 'invalid'; end if;
  -- spłaszczenie: małe litery, bez ogonków, 0→o 1→i 3→e 4→a 5→s 7→t 8→b, bez kropek/kresek/podkreślników
  flat := translate(lower(n), 'ąćęłńóśźż0134578', 'acelnoszzoieastb');
  flat := regexp_replace(flat, '[^a-z]', '', 'g');
  if flat ~ '(kurw|chuj|choj|huj|pierd|jeb|pizd|cipa|cipk|kutas|fiut|dziwk|szmat|pedal|pedzi|ciota|sukinsyn|skurw|cwel|zjeb|gowno|gowna|sraj|sran|srac|ruchac|ruchan|dupa|dupe|dupy|dupk|chwdp|hitler|nazi|fuck|fuk|shit|cunt|bitch|nigg|niga|fag|dick|cock|puss|whore|slut|rapist|asshole|bastard|penis|vagina|porn|sex)' then
    return 'rude';
  end if;
  if exists (select 1 from profiles where lower(nick) = lower(n) and user_id is distinct from auth.uid()) then return 'taken'; end if;
  return 'ok';
end $$;
grant execute on function public.nick_check(text) to anon, authenticated;

-- Mój nick albo null.
create or replace function public.my_nick()
returns text language sql stable security definer set search_path = public as $$
  select nick from profiles where user_id = auth.uid();
$$;
grant execute on function public.my_nick() to authenticated;

-- Ustawia nick, tylko raz. Zwraca 'ok', 'locked' (nick już jest), 'signed_out' albo powód z nick_check.
create or replace function public.set_nick(p_nick text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n text := btrim(coalesce(p_nick, ''));
  why text;
begin
  if uid is null then return 'signed_out'; end if;
  if exists (select 1 from profiles where user_id = uid) then return 'locked'; end if;
  why := nick_check(n);
  if why <> 'ok' then return why; end if;
  insert into profiles (user_id, nick) values (uid, n);
  return 'ok';
exception when unique_violation then
  return case when exists (select 1 from profiles where user_id = uid) then 'locked' else 'taken' end;
end $$;
grant execute on function public.set_nick(text) to authenticated;

-- Top 10 danego trybu i poziomu, plus miejsce pytającego (z konta albo z tej przeglądarki), także spoza dziesiątki.
create or replace function public.leaderboard_top(p_mode text, p_level text, p_device text default null)
returns json language sql stable security definer set search_path = public as $$
  with ranked as (
    select coalesce(p.nick, l.name) as name, l.ms, l.score, l.record_at, l.player,
      rank() over (order by case when p_mode = 'tetris' then -l.score end, l.ms) as pos
    from leaderboard l left join profiles p on p.user_id = l.user_id
    where l.mode = p_mode and l.level = p_level
  ), mine as (
    select * from ranked
    where player = 'u:' || coalesce(auth.uid()::text, '-') or player = 'd:' || coalesce(p_device, '-')
    order by pos limit 1
  )
  select json_build_object(
    'players', (select count(*) from ranked),
    'top', coalesce((select json_agg(json_build_object('pos', pos, 'name', name, 'ms', ms, 'score', score, 'at', record_at,
                       'me', player in (select player from mine)) order by pos, record_at)
                     from (select * from ranked order by pos, record_at limit 10) t), '[]'),
    'me', (select json_build_object('pos', pos, 'ms', ms, 'score', score) from mine)
  );
$$;
grant execute on function public.leaderboard_top(text, text, text) to anon, authenticated;

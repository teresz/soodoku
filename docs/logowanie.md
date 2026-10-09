# Logowanie Google (opcjonalne)

Bez logowania gra działa jak dotąd: postęp wyzwań dnia (streak, kalendarz) siedzi w localStorage telefonu. Po zalogowaniu kontem Google ten sam postęp ląduje też w Supabase i wraca na każdym urządzeniu, na którym się zalogujesz.

- Przycisk „Zaloguj przez Google” jest w Ustawieniach (sekcja Konto) i w kalendarzu wyzwań.
- Logowanie działa tylko na zwykłej stronie (GitHub Pages, localhost). W Artifact na claude.ai przycisku nie ma, bo przekierowanie z Google nie ma tam dokąd wrócić.
- Po zalogowaniu lokalne dni łączą się z tymi z serwera: „w terminie” raz zdobyte zostaje, czas jest najlepszy z obu. Wylogowanie nie kasuje postępu z telefonu.
- Kod: `src/net/account.ts` (Supabase Auth + REST), `src/daily/sync.ts` (łączenie i wysyłka), `src/ui/account.ts` (przyciski). Tabela: `supabase/daily_progress.sql`.

## Jednorazowa konfiguracja (robi właściciel projektu Supabase)

1. **Tabela.** Supabase → SQL Editor → New query → wklej `supabase/daily_progress.sql` → Run.
2. **Klient OAuth w Google.** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → utwórz projekt (jeśli nie ma) → „OAuth consent screen”: typ External, nazwa „soodoku”, swój mail → „Credentials” → Create credentials → OAuth client ID → typ **Web application**.
   - Authorized JavaScript origins: `https://teresz.github.io`
   - Authorized redirect URIs: `https://qzvtvrzvznrfdyjocotw.supabase.co/auth/v1/callback`
   - Skopiuj Client ID i Client secret.
3. **Google w Supabase.** Authentication → Sign In / Providers → Google → włącz, wklej Client ID i Client secret → Save.
4. **Adresy powrotu.** Authentication → URL Configuration:
   - Site URL: `https://teresz.github.io/soodoku/`
   - Redirect URLs: dodaj `https://teresz.github.io/soodoku/**` (i `http://localhost:5173/**` do testów lokalnych).
5. Dopóki ekran zgody Google jest w trybie „Testing”, zalogować się mogą tylko maile dodane jako test users. Żeby mógł każdy, kliknij „Publish app” (dla samych podstawowych danych, imię, mail i zdjęcie, Google nie wymaga weryfikacji).

## Czego to nie robi

Streak liczy telefon gracza, więc ktoś uparty może go oszukać zmianą daty. Dopóki nie ma rankingu, to nikomu nie szkodzi.

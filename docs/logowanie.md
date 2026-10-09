# Konto: mail + hasło (opcjonalne)

Bez konta gra działa jak dotąd: postęp wyzwań dnia (streak, kalendarz) siedzi w localStorage telefonu. Po założeniu konta (mail + hasło) ten sam postęp ląduje też w Supabase i wraca na każdym urządzeniu, na którym się zalogujesz.

- Formularz jest w Ustawieniach (sekcja Konto). W kalendarzu wyzwań jest pasek z przyciskiem, który tam prowadzi.
- „Zaloguj” loguje na istniejące konto, „Załóż konto” tworzy nowe i od razu loguje. Hasło musi mieć co najmniej 6 znaków (domyślne minimum Supabase).
- Maila nikt nie sprawdza i nic na niego nie przychodzi, więc **hasła nie da się odzyskać**. Gra mówi to graczowi pod formularzem.
- Konto działa tylko na zwykłej stronie (GitHub Pages, localhost). W Artifact na claude.ai i z pliku (file://) sekcji Konto nie ma.
- Po zalogowaniu lokalne dni łączą się z tymi z serwera: „w terminie” raz zdobyte zostaje, czas jest najlepszy z obu. Wylogowanie nie kasuje postępu z telefonu.
- Kod: `src/net/account.ts` (Supabase Auth + REST), `src/daily/sync.ts` (łączenie i wysyłka), `src/ui/account.ts` (formularz). Tabela: `supabase/daily_progress.sql`.

## Jednorazowa konfiguracja (robi właściciel projektu Supabase)

1. **Tabela.** Supabase → SQL Editor → New query → wklej `supabase/daily_progress.sql` → Run. Można puścić drugi raz, nic się nie zepsuje.
2. **Bez maila potwierdzającego.** Authentication → Sign In / Providers ([bezpośredni link](https://supabase.com/dashboard/project/qzvtvrzvznrfdyjocotw/auth/providers)) → wyłącz **Confirm email** → Save. Logowanie mailem i hasłem (provider Email) jest w nowym projekcie włączone domyślnie, więc tylko to jedno trzeba przestawić.

Bez kroku 2 Supabase przy zakładaniu konta próbuje wysłać mail z linkiem, a jego darmowa skrzynka wysyła tylko do członków zespołu projektu (i 2 maile na godzinę). Gra wtedy pokaże „Serwer czeka na potwierdzenie maila, więc logowanie jeszcze nie działa”.

## Czego to nie robi

- Nie ma resetu hasła ani zmiany maila. Kto zapomni hasła, zakłada nowe konto (postęp z telefonu i tak zostaje i dołączy się do nowego konta).
- Ktoś może założyć konto na cudzy mail. Szkodzi to tylko tyle, że właściciel maila nie założy już konta na ten adres; danych nikomu nie zabiera.
- Streak liczy telefon gracza, więc ktoś uparty może go oszukać zmianą daty. Dopóki nie ma rankingu, to nikomu nie szkodzi.

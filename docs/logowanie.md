# Konto: mail + hasło (opcjonalne)

Bez konta gra działa jak dotąd: postęp wyzwań dnia (streak, kalendarz) siedzi w localStorage telefonu. Po założeniu konta (mail + hasło) ten sam postęp ląduje też w Supabase i wraca na każdym urządzeniu, na którym się zalogujesz.

- Formularz jest w Ustawieniach (sekcja Konto). W kalendarzu wyzwań jest pasek z przyciskiem, który tam prowadzi.
- „Zaloguj” loguje na istniejące konto, „Załóż konto” tworzy nowe i od razu loguje. Hasło musi mieć co najmniej 6 znaków (domyślne minimum Supabase).
- Maila nikt nie sprawdza i nic na niego nie przychodzi, więc **hasła nie da się odzyskać**. Gra mówi to graczowi pod formularzem.
- Konto działa tylko na zwykłej stronie (GitHub Pages, localhost). W Artifact na claude.ai i z pliku (file://) sekcji Konto nie ma.
- Po zalogowaniu lokalne dni łączą się z tymi z serwera: „w terminie” raz zdobyte zostaje, czas jest najlepszy z obu. Wylogowanie nie kasuje postępu z telefonu.
- Mecze Sabotażu zalogowanego gracza też idą na konto (statystyki z rywalami po mailu, zob. docs/sabotaz.md).
- Kod: `src/net/account.ts` (Supabase Auth + REST), `src/daily/sync.ts` (łączenie i wysyłka), `src/ui/account.ts` (formularz). Tabele: `supabase/daily_progress.sql`, `supabase/sabotage_matches.sql`.

## Jednorazowa konfiguracja (robi właściciel projektu Supabase)

1. **Tabele.** Supabase → SQL Editor → New query → wklej `supabase/daily_progress.sql` → Run. To samo z `supabase/sabotage_matches.sql` (mecze Sabotażu do statystyk z rywalami). Każdy można puścić drugi raz, nic się nie zepsuje.
2. **Bez maila potwierdzającego.** Authentication → Sign In / Providers ([bezpośredni link](https://supabase.com/dashboard/project/qzvtvrzvznrfdyjocotw/auth/providers)) → wyłącz **Confirm email** → Save. Logowanie mailem i hasłem (provider Email) jest w nowym projekcie włączone domyślnie, więc tylko to jedno trzeba przestawić.

Bez kroku 2 Supabase przy zakładaniu konta próbuje wysłać mail z linkiem, a jego darmowa skrzynka wysyła tylko do członków zespołu projektu (i 2 maile na godzinę). Gra wtedy pokaże „Serwer czeka na potwierdzenie maila, więc logowanie jeszcze nie działa”.

## Czego to nie robi

- Nie ma resetu hasła ani zmiany maila. Kto zapomni hasła, zakłada nowe konto (postęp z telefonu i tak zostaje i dołączy się do nowego konta).
- Ktoś może założyć konto na cudzy mail. Szkodzi to tylko tyle, że właściciel maila nie założy już konta na ten adres; danych nikomu nie zabiera.
- Streak liczy telefon gracza, więc ktoś uparty może go oszukać zmianą daty. Dopóki nie ma rankingu, to nikomu nie szkodzi.

## Licznik wejść (tylko dla admina)

- Każde wejście na stronę (GitHub Pages) woła funkcję `count_visit` w Supabase z losowym identyfikatorem przeglądarki (bez maili i IP). Nie liczą się localhost, testy `?net=local` ani Artifact.
- Admin (mail w tabeli `site_admins`) widzi w Statystykach panel „Odwiedziny”: wejścia i urządzenia dziś, łącznie i słupki z 14 dni. Inni gracze dostają z serwera pustkę i panelu nie widzą.
- SQL: `supabase/page_visits.sql` (w ostatniej linijce trzeba wpisać swój mail). Dzień liczony po czasie polskim.
- Czas na stronie: gra liczy sekundy tylko, gdy karta jest na wierzchu, i dosyła je co minutę oraz przy schowaniu karty (`add_time`, najwyżej 120 s na raz). W panelu: ⏱ dziś i łącznie, w dymku słupka czas z danego dnia. SQL: `supabase/page_time.sql` (dokładka do page_visits.sql). Minuta, której nie zdążyło się wysłać przy zabiciu przeglądarki, przepada.
- Lista kont: pod Odwiedzinami rozwijane „Konta graczy” (mail, kiedy założone, ostatnie logowanie), czytane z auth.users przez funkcję `admin_users` tylko dla adminów. SQL: `supabase/admin_users.sql`. To samo jest w Supabase: Authentication → Users.
- Licznik da się podbić, wołając funkcję ręcznie, więc to liczba orientacyjna, a nie księgowość.

## Ranking globalny (dla wszystkich)

- W Statystykach na górze: top 10 dla każdego trybu i poziomu (Logika, Odkryte pola, Saperdoku, Oblężenie po czasie, Tetroku po punktach), plus „Twoje miejsce”, gdy gracz jest poza dziesiątką. Sabotaż i wyzwania dnia są poza rankingiem.
- Liczy się tylko wygrana bez „Graj dalej bez limitu”. Każdy gracz ma w rankingu jeden wiersz na tryb i poziom: swój najlepszy wynik.
- Gracz z kontem widnieje pod częścią maila przed @ (np. `jan.kowalski`), bez konta jako „Gość” / „Guest” w języku oglądającego. Gość jest rozpoznawany po losowym id przeglądarki (tym samym co w liczniku wejść).
- Po wygranej ekran końca dostaje plakietkę z miejscem na świecie. Wynik, który nie doszedł (brak sieci), czeka w telefonie i leci przy następnym wejściu.
- SQL: `supabase/leaderboard.sql` (funkcje `submit_score` i `leaderboard_top`, tabela bez bezpośredniego dostępu). Bez niego ranking pokazuje „chwilowo nie odpowiada”, a admin widzi podpowiedź, który plik puścić.
- Serwer odrzuca czasy poniżej 10 s i bzdurne tryby, ale wynik da się podrobić, wołając funkcję ręcznie. Na hobbystyczny ranking wystarczy; gdyby ktoś zaczął oszukiwać, trzeba będzie sprawdzać rozwiązanie na serwerze.

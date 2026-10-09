# Wyzwanie dnia

Codziennie jedna plansza, ta sama dla wszystkich graczy. Kod: `src/daily/` (`daily.ts` logika, `note.ts` notatka, `view.ts` karta, arkusz i kalendarz, `daily.css` wygląd).

## Skąd się bierze wyzwanie

- Wyzwanie wynika z samej daty (`challengeFor('RRRR-MM-DD')`), bez serwera. Dzień liczy się w lokalnym czasie telefonu.
- Tryby rotują po trybach solo (Logika, Odkryte pola, Tetroku, Saperdoku, Oblężenie; bez Sabotażu): w każdym bloku pięciu dni każdy tryb raz, nigdy ten sam dwa dni pod rząd.
- Trudność rośnie w ciągu tygodnia jak w gazecie: poniedziałek łagodnie, sobota najciężej, niedziela trochę luźniej (plus odrobina losowości).
- Mniej więcej co drugi dzień jest haczyk: bez podpowiedzi, jeden błąd i koniec (tylko tryby z limitem błędów, liczy błędy nawet z wyłączonym sprawdzaniem) albo bez notatek.
- Kalendarz zaczyna się 1 października 2026 (`DAILY_START`).

## Notatka „Dlaczego to wyzwanie”

Składana z kawałków: zdanie o dniu tygodnia, opis trybu i poziomu z liczbami z planszy (cyfry na start, miny, mur, tempo), technika potrzebna do rozwiązania (dla zwykłych plansz, z oceny solvera) i haczyk. Warianty zdań wybiera liczba dnia, więc notatki różnią się z dnia na dzień.

## Postęp i streak

- Zapis w localStorage (`kratka.daily.v1`): dla każdego zrobionego dnia czas, błędy, podpowiedzi i czy zrobione w swoim dniu.
- Streak to dni z rzędu zrobione w swoim dniu. Dzisiejszy brak jeszcze go nie zrywa (dzień trwa), wczorajszy już tak.
- Nadrobienie starego wyzwania odhacza je w kalendarzu (obwódka), ale streaka nie podbija ani nie skleja.
- Wygrana po „Graj dalej bez limitu” się nie liczy. Przegraną albo poddaną planszę można zacząć od nowa z kalendarza.
- Gra-wyzwanie siedzi w zwykłym zapisie gry (przycisk Kontynuuj), więc rozpoczęcie wyzwania porzuca bieżącą grę (arkusz o tym ostrzega).

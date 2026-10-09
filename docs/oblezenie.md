# Oblężenie – jak to działa

Stan: zrobione (2026-10-08). Kod w `src/modes/siege/`, id trybu `siege`. Po angielsku: Siege.

Wybrany wariant: „E. Oblężenie kwadratów” (teresz odrzucił: linie frontu w stylu PvZ, labirynt w stylu Kingdom Rush, turowe oblężenie i potwory zjadające cyfry).

## Zasady

- Plansza sudoku z klasycznego generatora (łatwa / średnia / trudna), więc rozwiązywalna samą logiką.
- 9 kwadratów 3x3 to 9 zamków. Każdy ma mur (3 punkty, na Ekspercie 2), widoczny jako kreski na dolnej krawędzi kwadratu.
- Wrogowie (potwory) przychodzą co kilkanaście sekund i siadają na górnej krawędzi kwadratu, który szturmują. Pierścień wokół potwora to pasek szturmu: jak się zapełni, potwór wali w mur i znika.
- **Dobra cyfra** w szturmowanym kwadracie = strzał w potwora, któremu najmniej zostało.
- Potwory (decyzja teresza 2026-10-09: mocniejszy bije mocniej, ale ładuje dłużej):

  | Potwór | Życia | Ładowanie szturmu | Zbija muru | Od poziomu |
  |---|---|---|---|---|
  | zielony | 1 | 1× | 1 | Łatwy |
  | pomarańczowy | 2 | 1,5× | 2 | Średni |
  | fioletowy z rogami | 3 | 2× | 3 (cały zamek) | Ekspert |
- **Pełny wiersz albo kolumna** = laser: zabija wszystkich szturmujących kwadraty, przez które przechodzi.
- **Pełny kwadrat** = twierdza: szturmujący giną, mur wraca do pełna, nikt go już nie atakuje.
- **Zła cyfra** rani mur własnego kwadratu (zostaje na planszy na czerwono, trzeba zmazać). Osobnego limitu błędów nie ma.
- Mur na zero = **zamek pada**: puste i błędne pola kwadratu wypełniają się rozwiązaniem jako szare ruiny (nie da się ich zmienić), szturmujący odchodzą.
- **Trzy upadłe zamki = przegrana.** „Graj dalej bez limitu” wycofuje wrogów i zostaje dokończyć planszę.
- Wygrana: cała plansza poprawnie wypełniona (ruiny się liczą). Rekord to najlepszy czas.
- Co 4 wrogów nowa fala: krótsze odstępy (do 55% startowych) i częściej twardsi wrogowie.

## Bez zgadywania

Wróg wybiera cel losowo z wagami: 6× chętniej kwadrat, w którym gracz ma teraz prosty ruch (pojedynczy albo ukryty kandydat, licząc tylko dobre cyfry), i rzadziej kwadrat, który już ktoś szturmuje. Ukończonych i upadłych kwadratów nie atakuje.

## Instrukcja w grze

Arkusz „Jak grać” (legenda potworów, broń, kary, porady) pokazuje się sam przy pierwszej grze w Oblężeniu (zapamiętane w localStorage `kratka.rules.v1`). Potem otwiera go przycisk ? w górnym pasku gry i „Jak grać?” na liście poziomów. Treść daje tryb przez `GameMode.rules()` (`src/modes/siege/rules.ts`), więc inne tryby mogą dostać swoją. Gdy arkusz jest otwarty, szturm i zegar stoją.

## Sterowanie

Jak w klasyku: tap w pole + klawiatura cyfr, na komputerze 1–9, strzałki, Shift+cyfra notatka. Cofanie wyłączone (strzały poszły). Podpowiedź (wspólny limit 3) też strzela. Pauza zatrzymuje szturm, karta w tle = pauza.

Potwór, pod którym jest zaznaczone pole, blednie, żeby nie zasłaniał cyfr.

## Poziomy

| Poziom  | Sudoku  | Szturm | Wróg co | Mur | Max wrogów | Max życie wroga |
|---------|---------|--------|---------|-----|------------|-----------------|
| Łatwy   | łatwe   | ~42 s  | 17 s    | 3   | 3          | 1               |
| Średni  | średnie | ~36 s  | 14 s    | 3   | 4          | 2               |
| Trudny  | trudne  | ~32 s  | 12 s    | 3   | 5          | 2               |
| Ekspert | trudne  | ~26 s  | 9,5 s   | 2   | 6          | 3               |

Czasy w tabeli dotyczą zielonego; twardsi ładują 1,5× i 2× dłużej. Pierwszy wróg po 5 s.

## Efekty

Pociski z pola do potwora, iskry, lasery przez wiersz/kolumnę, złota twierdza z błyskiem, trzęsienie planszy przy uderzeniu, napisy „Fala N” i „Zamek padł”, czerwona poświata planszy, gdy któryś szturm jest na ostatnich 20%. Na telefonie krótkie wibracje. Wyłączenie animacji w ustawieniach wyłącza efekty, gra działa dalej.

# Saperdoku – jak to działa

Stan: zrobione (2026-10-08). Kod w `src/modes/saperdoku/`, id trybu `minesweeper`. Po angielsku: Minedoku.

Wybrany wariant to pomysł teresza: **kilka losowych pustych pól to miny**. Odrzucone propozycje (jedna cyfra jako mina, miny które po oflagowaniu odsłaniają cyfrę, „mgła” do odkopywania) były łatwiejsze albo były dwiema grami po kolei.

## Zasady

- Plansza sudoku z cyframi startowymi jak zwykle.
- Pod kilkoma losowymi pustymi polami leżą miny. Pod każdą miną dalej jest cyfra z rozwiązania, ale **nie wolno jej wpisać**, tylko trzeba postawić flagę.
- Pola startowe i każde dobrze wpisane pole pokazują w prawym górnym rogu **licznik min** na 8 sąsiednich polach (kolory jak w saperze, 0 jest przygaszone).
- Sudoku mówi, jaka cyfra stoi w polu, ale nie mówi, czy to mina. To wiadomo tylko z liczników (i z listy cyfr spod min, jeśli poziom ją pokazuje). Obie logiki trzeba ciągnąć naraz.
- Cyfra wpisana w minę: **wybuch**, błąd, mina zostaje odsłonięta i oflagowana.
- Flaga na polu bez miny: błąd, flaga nie zostaje. Dlatego każda flaga na planszy jest prawdziwa i nie da się jej zdjąć.
- Wybuchy i złe flagi liczą się jako błędy także przy wyłączonym „sprawdzaniu błędów”, bo to rdzeń trybu.
- Wygrana: wszystkie pola bez min uzupełnione i wszystkie miny oflagowane.
- Przegrana: 3 błędy. Potem jak wszędzie można grać dalej bez limitu.
- „Zakończ grę” odsłania rozwiązanie i wszystkie miny.

## Gwarancja: bez zgadywania

Generator (`engine.ts`) losuje planszę sudoku z daną liczbą cyfr, a potem miny w pustych polach i sprawdza je solverem, który symuluje gracza:
- zna cyfry z sudoku (plansza startowa ma jedno rozwiązanie),
- widzi liczniki na polach startowych i na polach, o których już wie, że są bezpieczne,
- stosuje reguły: licznik z kompletem (0 albo same miny), podzbiory dwóch liczników, lista cyfr spod min (gdy widoczna) i licznik pozostałych min.

Jeśli solver utknie, układ min idzie do kosza. Generowanie trwa kilkadziesiąt milisekund nawet na Mistrzu.

## Sterowanie

- **Telefon:** tap zaznacza pole, cyfry z klawiatury. Przycisk **Flaga** obok Notatek włącza tryb flag (wtedy tap stawia flagę). Przytrzymanie pola też stawia flagę.
- **Komputer:** prawy klik albo klawisz **F** stawia flagę na zaznaczonym polu.
- U góry chip 💣 z liczbą min jeszcze nieoflagowanych.
- Pod planszą (na poziomach z listą) „Pod minami”: cyfry kryjące się pod minami, oflagowane są przekreślone.
- Na klawiaturze, gdy lista jest widoczna, cyfry spod min nie liczą się do „zostało”.

## Podpowiedź

Wspólny limit 3 na grę. Jeśli zaznaczone pole nie jest gotowe: mina zostaje oflagowana, zwykłe pole wpisane. Bez zaznaczenia podpowiedź wybiera pole, które gracz już może wydedukować z liczników.

## Poziomy

| Poziom  | Cyfry na start | Miny | Lista cyfr spod min |
|---------|----------------|------|---------------------|
| Łatwy   | 36             | 8    | tak                 |
| Średni  | 32             | 11   | tak                 |
| Trudny  | 28             | 14   | tak                 |
| Ekspert | 26             | 17   | nie                 |
| Mistrz  | 24             | 21   | nie                 |

Rekord to najlepszy czas na poziom, jak w trybach klasycznych.

## Jak grać

Arkusz „Jak grać” (przykład 3×3 z licznikami i flagami, narzędzia, kary, porady) wyskakuje przy pierwszej grze, potem pod ? w pasku. Kod: `src/modes/saperdoku/rules.ts`.

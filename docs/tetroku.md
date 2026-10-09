# Tetroku – jak to ma działać (propozycja)

Stan: wybrany i zrobiony wariant A („Układanka”), kod w `src/modes/tetroku/`.

## Problem do rozwiązania

Tetris stoi na grawitacji i czyszczeniu linii, a sudoku na tym, że każde pole ma jedną, z góry ustaloną cyfrę. Jak klocek ze sztywnymi cyframi spada „gdzie popadnie”, sudoku się sypie. Więc nie bierzemy grawitacji dosłownie: bierzemy z tetrisa **klocki, kolejkę, schowek, obracanie, presję czasu i combo za linie**, a z sudoku **dedukcję, gdzie dany kawałek pasuje**.

## Wariant A – „Układanka” (rekomendowany)

**Zasada w jednym zdaniu:** dostajesz klocki z wypisanymi cyframi i musisz znaleźć na planszy miejsce, gdzie ten kawałek pasuje do rozwiązania.

- Plansza 9×9 z garścią cyfr startowych, jak w zwykłym sudoku.
- Pod planszą (tam, gdzie teraz jest klawiatura cyfr) leży **kolejka 3 klocków**. Każdy klocek to kształt od 1 do 4 pól (na wyższych poziomach do 5), a w każdym polu jest cyfra.
- Plansza powstaje tak, że całe rozwiązanie dzielimy na klocki i zdejmujemy je całymi kawałkami (pilnując jednego rozwiązania), więc puste pola składają się w porządne klocki, a nie w same pojedyncze dziurki. **Zawsze istnieje miejsce, gdzie dany klocek pasuje**, a jak ktoś położy klocek w innym pasującym miejscu, wolne pola są cięte od nowa, więc nie ma ślepych zaułków.
- Klocek można **obrócić** (cyfry obracają się razem z kształtem) i odłożyć do **schowka** (1 slot, jak „hold” w tetrisie).
- Kładziesz klocek: jeśli wszystkie jego cyfry zgadzają się z rozwiązaniem, zostaje. Jeśli nie, odbija się z powrotem do kolejki i liczy się **błąd**.
- Każdy poprawny układ w innym miejscu, który też zgadza się z rozwiązaniem, jest OK (nie wymuszamy „tego jednego” miejsca).
- **Notatki** zostają: można dalej ołówkiem wpisywać kandydatów w puste pola, bo bez nich na wyższych poziomach to zgadywanie.

### Presja czasu („spadanie”)

Klocek na czele kolejki ma **pasek opadania**. Jak dojedzie do zera, klocek „spada”: przepada, zabiera życie i wraca kiedyś później jako inny kawałek. Pasek przyspiesza z każdym poziomem i lekko z postępem gry (o 1% na klocek, najwyżej o 40%). Na najłatwiejszym poziomie paska nie ma.

### Wygrana / przegrana

- Wygrana: cała plansza wypełniona.
- Przegrana: 3 życia (błędne położenie albo klocek, który spadł).

### Punkty

- 10 pkt za każde pole położonego klocka.
- Domknięty wiersz, kolumna albo kwadrat 3×3: +100 i błysk animacji.
- Kilka naraz = combo ×2, ×3, ×4… Cztery jednostki jednym klockiem = napis **„TETROKU!”**.
- Seria poprawnych ruchów bez błędu podbija mnożnik (×1 → ×1,5 → ×2), błąd go zeruje.
- Na koniec bonus za pozostały czas i życia.
- Rekord punktów na każdy poziom w Statystykach.

### Poziomy (drabinka jak w innych trybach)

| Poziom  | Cyfry na start | Klocki       | Widoczna kolejka | Pasek opadania |
|---------|----------------|--------------|------------------|----------------|
| Start   | 40             | 2–3 pola     | 3                | brak           |
| Łatwy   | 34             | 2–4 pola     | 3                | 90 s           |
| Średni  | 30             | 3–4 pola     | 3                | 60 s           |
| Trudny  | 27             | 4 pola       | 2                | 45 s           |
| Ekspert | 25             | 4–5 pól      | 1                | 35 s           |
| Mistrz  | 23             | 4–5 pól      | 1, bez schowka   | 25 s            |

Mniej cyfr na start = trudniej wydedukować miejsce, większe klocki = mniej miejsc do sprawdzenia, ale trudniej je zmieścić, krótszy pasek = mniej czasu na myślenie.

### Sterowanie

**Telefon:**
- Przeciągasz klocek z kolejki na planszę; nad palcem pokazuje się jego cień przesunięty do góry, żeby palec go nie zasłaniał.
- Stuknięcie w klocek = obrót o 90°.
- Przycisk schowka obok kolejki, przycisk ołówka do notatek.
- Cień nie podpowiada, czy pasuje (to byłoby oszustwo): na każdym poziomie ma jeden kolor, bez czerwieni za konflikty. Jedyną pomocą jest Podpowiedź (najwyżej 3 na grę, zeruje serię).

**Komputer:**
- Mysz: przeciąganie jak na telefonie, kółko albo prawy przycisk = obrót.
- Klawiatura: 1–3 wybór klocka, Tab następny, strzałki przesuwają cień po planszy, X/Z obrót, Spacja/Enter kładzie, C schowek, N notatki, H podpowiedź (pokazuje miejsce klocka, zeruje serię, najwyżej 3 na grę).

W trybie notatek tacka chowa się, a wraca klawiatura cyfr do ołówka. Cofania nie ma (rozwaliłoby kolejkę), gumka czyści tylko notatki.

### Wygląd

Ten sam modernistyczny styl i palety co reszta Kratki. Klocki to zaokrąglone kafelki w kolorze akcentu palety, każdy kształt w innym odcieniu, cyfry tym samym krojem co na planszy. Pasek opadania jako cienka linia nad kolejką. W menu kafel Tetroku przestaje mieć „wkrótce” i otwiera listę poziomów jak inne tryby.

## Wariant B – „Prawdziwe spadanie”

Klocek naprawdę jedzie z góry planszy w dół, sterujesz lewo/prawo/obrót i zatrzymuje się na pierwszym zajętym polu albo na dnie. Plansza zaczyna pusta (albo prawie) i buduje się od dołu, a generator podaje klocki w kolejności, która to umożliwia.

Plus: wygląda jak tetris. Minus: grawitacja mocno ogranicza, gdzie klocek w ogóle może trafić, więc dedukcja sudoku robi się płytka, a gra to głównie zręcznościówka. Na telefonie sterowanie spadającym klockiem palcem jest gorsze niż przeciąganie.

## Wariant C – „Sudoku pod ostrzałem”

Normalnie rozwiązujesz sudoku cyframi z klawiatury, a co jakiś czas na planszę spada szary klocek-śmieć, który zasłania pola. Domknięcie wiersza/kolumny/kwadratu zdmuchuje śmieci z tej jednostki.

Plus: najprostsze do zrobienia. Minus: tetris jest tu tylko przeszkadzajką, a nie mechaniką.

## Rekomendacja

**Wariant A.** Jest jedynym, w którym tetris i sudoku naprawdę grają razem: kształt klocka jest wskazówką, a sudoku mówi, gdzie go położyć. Dobrze działa palcem i nie rozwala logiki planszy. Wariant B można później dorobić jako osobny poziom „Spadanie”, jeśli A się przyjmie.

## Jak to wchodzi w kod

- Nowy moduł `src/modes/tetroku/`: generator klocków (cięcie pustych pól rozwiązania na kształty), stan gry (kolejka, schowek, życia, punkty, pasek), widok (kolejka + przeciąganie).
- Istniejący `core/` (generator, solver, ocena trudności) używany bez zmian.
- Interfejs `GameMode` dostaje opcjonalny własny widok gry, a `ui/app.ts` tylko przekierowuje do niego, gdy tryb go ma. Zmiany we wspólnych plikach minimalne.
- Zapis bieżącej gry i statystyki (rekord punktów) przez istniejący `storage.ts`, z polami specyficznymi dla Tetroku.
- Testy: generator zawsze daje klocki, które pokrywają puste pola i pasują do rozwiązania; kolejka nigdy nie daje klocka bez miejsca.

## Jak grać

Arkusz „Jak grać” (przykład z dziurą i klockiem, sterowanie, kary, punkty, porady) wyskakuje przy pierwszej grze, potem pod ? w pasku. Kod: `src/modes/tetroku/rules.ts`.

# soodoku – sudoku na telefon i komputer

Klasyczne sudoku jako responsywna gra webowa. Fundament pod kolejne tryby (sudoku+tetris, sudoku+saper…).

## Uruchomienie

```bash
npm install
npm run dev        # serwer deweloperski
npm test           # testy silnika (vitest)
npm run build      # dist/index.html – jeden samodzielny plik
npm run artifact   # artifact/kratka.html – wersja do publikacji jako Artifact
```

Uwaga: `npm install` nie działa bezpośrednio w `/mnt/project-files` (brak symlinków) – skopiuj katalog gdzie indziej i tam instaluj.

## Struktura

- `src/core/` – czysta logika, bez DOM: plansza i geometria (`board.ts`), solver z backtrackingiem na maskach bitowych (`solver.ts`), „ludzki” solver do oceny trudności i podpowiedzi (`logic.ts`), generator z seedem (`generator.ts`), RNG (`rng.ts`).
- `src/modes/` – tryby gry. `GameMode` to kontrakt (każdy tryb ma własną drabinkę poziomów); `classic.ts` („Logika”, trudność wg technik), `clues.ts` („Odkryte pola”, trudność wg liczby cyfr), `index.ts` trzyma rejestr (Saperoku jest na razie zapowiedzią w menu).
- `src/modes/tetroku/` – Tetroku (sudoku + tetris, wariant „Układanka”): `engine.ts` to czysta logika (cięcie planszy na klocki, kolejka, schowek, punkty, pasek opadania), `view.ts` tacka z klockami, przeciąganie i klawiatura, `tetroku.css` jej wygląd. Stan siedzi w `SavedGame.tetroku`. Opis zasad: `docs/tetroku.md`.
- `src/modes/siege/` – Oblężenie (sudoku + tower defense): `engine.ts` czysta logika (mury, wrogowie, fale, strzały, lasery, twierdze, ruiny), `view.ts` warstwa nad planszą z potworami i efektami, `siege.css` wygląd. Stan w `SavedGame.siege`. Zasady: `docs/oblezenie.md`.
- `src/modes/sabotage/` – Sabotaż, gra we dwóch na dwóch telefonach: `engine.ts` czysta logika ataków (kolejka, ochrona przed podwójnym obrotem, kody pokoi), `view.ts` lobby, pasek rywala, odliczanie i efekty. Zasady: `docs/sabotaz.md`.
- `src/daily/` – wyzwanie dnia: plansza wyznaczana z daty, notatka „dlaczego to wyzwanie”, kalendarz zrobionych dni i streak (zapis w localStorage). Zasady: `docs/wyzwania.md`.
- Konto Google (opcjonalne): `src/net/account.ts` + `src/daily/sync.ts` synchronizują postęp wyzwań z Supabase. Konfiguracja i SQL: `docs/logowanie.md`, `supabase/daily_progress.sql`.
- `src/net/` – pokoje multiplayer: Supabase Realtime (broadcast + presence, `config.ts` z publicznym kluczem), a z `?net=local` zamiennik na BroadcastChannel do testów na dwóch kartach.
- `src/game/` – stan rozgrywki (`game.ts`: wpisywanie, notatki, cofanie, podpowiedzi, błędy) i zapis w localStorage (`storage.ts`: bieżąca gra + statystyki).
- `src/ui/app.ts` – renderowanie planszy (9 kafli po 9 pól), klawiatura pod planszą i fizyczna, arkusze (nowa gra, ustawienia, wynik, statystyki).
- `src/ui/themes.ts` – palety kolorów (Wolt, Limonka, Koral, Irys, Laguna, Mono), każda w wersji jasnej i ciemnej; tryb Auto idzie za systemem.
- `src/i18n.ts` – teksty po polsku i angielsku (`t('klucz')`), wybór języka w localStorage, flagi PL/GB w menu i ustawieniach. Stałe teksty w `index.html` mają atrybuty `data-i18n`. Nowy tekst = klucz w obu słownikach (TypeScript pilnuje, żeby angielski miał komplet).
- `src/ui/settings.ts` – ustawienia gracza w localStorage (motyw, wygląd, sprawdzanie błędów, podświetlenia, sprzątanie notatek, zegar, animacje).
- `src/styles.css` – jedna kolumna na każdym ekranie, żywe tło z dryfującymi plamami koloru.

## Ekrany

Na start jest menu: Kontynuuj (gdy jest rozpoczęta gra), karta wyzwania dnia (streak, ostatni tydzień, wejście do kalendarza), kafle trybów, Ustawienia i Statystyki. Wybór trybu otwiera listę jego poziomów.

## Poziomy trudności

Generator zdejmuje cyfry symetrycznie, pilnując jednego rozwiązania, a potem ocenia planszę technikami:
- Łatwy / Średni: wystarczą pojedynczy i ukryci kandydaci (38 / 31 cyfr na start).
- Trudny: potrzeba zablokowanych kandydatów lub nagich par.
- Ekspert: proste techniki nie wystarczają, ≤25 cyfr.

Tryb „Odkryte pola” (`src/modes/clues.ts`, `generateByClues`) liczy trudność tylko po liczbie cyfr na start: 50, 42, 36, 30, 26, 23. Cyfry zdejmowane są bez symetrii, plansza zawsze ma jedno rozwiązanie.

## Jak dodać nowy tryb

1. Utwórz `src/modes/<tryb>.ts` implementujący `GameMode`.
2. Dodaj go do `MODES` w `src/modes/index.ts` (zamiast zapowiedzi).
3. Jeśli tryb zmienia reguły wpisywania, rozszerz `GameMode` o haki i wywołaj je w `Game.place()`.
4. Niestandardowy tryb (wszystko poza klasycznym sudoku) dostaje arkusz „Jak grać”: `rules: () => rulesSheet(wstęp, sekcje)` z `src/modes/rules.ts`. Sekcje to wiersze legendy (ikona + tytuł + opis), opcjonalny przykład w `html` i lista porad; ikony rysuj tymi samymi klasami co na planszy, a gotowe wspólne (zła cyfra, życia, odznaki) bierz z `RULE_ICONS`. Teksty jako klucze `<tryb>.r.*` w obu słownikach `src/i18n.ts`. Arkusz sam wyskakuje przy pierwszej grze, potem jest pod ? w pasku i „Jak grać?” przy poziomach. Test `tests/rules.test.ts` pilnuje, żeby żaden niestandardowy tryb nie został bez instrukcji.

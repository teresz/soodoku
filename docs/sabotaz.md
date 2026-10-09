# Sabotaż – jak to działa

Stan: działa (2026-10-09), kod w `src/modes/sabotage/` (id `sabotage`) i `src/net/` (pokoje). Testowane na dwóch kartach przez `?net=local`; z prawdziwym Supabase jeszcze nie (kontener nie ma dostępu do supabase.co). Pierwszy tryb dla dwóch graczy, każdy na swoim telefonie. Po angielsku roboczo: Sabotage.

Wybrane przez teresza spośród: Sabotaż, Wojna o pola, Wyścig duchów, Kooperacja. Pomysł ataków (zakaz cyfry, zamazanie, obrót za kwadrat) jest teresza; liczby i hamulce to propozycja Claude'a do potwierdzenia.

## Technika

- Backend: Supabase Realtime (kanał na pokój + presence), gra hostowana poza claude.ai (GitHub Pages). Granie po kodzie pokoju, bez konta claude.ai.
- Projekt Supabase: `qzvtvrzvznrfdyjocotw` (klucz anon w `src/net/config.ts`, jest publiczny). Bez tabel: tylko kanały Realtime `soodoku:sabotage-KOD`.
- Lobby: „Załóż pokój” daje 4-znakowy kod i link `?pokoj=KOD` (udostępnianie z telefonu), kumpel wpisuje kod albo otwiera link. Gospodarz wybiera poziom (Łatwy/Średni/Trudny) i losuje seed.
- Testy lokalne bez serwera: `npm run build && npx vite preview`, potem dwie karty z `?net=local` (BroadcastChannel zamiast Supabase).
- Hosting: `.github/workflows/pages.yml` publikuje `dist/` na GitHub Pages przy pushu na main. Gra we dwóch nie nadpisuje zapisanej gry solo.
- Przez sieć idą tylko: seed planszy, postęp (ile pól wpisanych), ataki i koniec gry. Plansze liczy każdy telefon sam.

## Zasady

- Obaj gracze dostają **tę samą planszę** (ten sam seed i poziom), każdy rozwiązuje swoją kopię.
- Widać pasek postępu przeciwnika (procent wypełnionych pól), bez jego cyfr.
- **Pełny wiersz albo kolumna** = prosty atak na przeciwnika, losowo jeden z:
  - **Zakaz cyfry**: jedna losowa cyfra (taka, której przeciwnikowi jeszcze brakuje) zablokowana na 8 s, jej przycisk przekreślony.
  - **Zamazanie**: plansza przeciwnika rozmyta na 4 s.
- **Pełny kwadrat 3x3** = **obrót planszy przeciwnika o 90°** (animowany; zaznaczenie i notatki obracają się razem z planszą). Obrócone sudoku nadal jest poprawne, więc nic się nie psuje.
- Jeden ruch zamykający naraz wiersz i kolumnę wysyła dwa ataki.
- **Zła cyfra** = kara u siebie, rosnąca z każdym błędem (decyzja teresza, 2026-10-09), żeby nie opłacało się klepać na ślepo:
  - 1. błąd: 3 s blokady wpisywania,
  - 2. błąd: 5 s blokady + 3 s rozmycia własnej planszy,
  - 3. i każdy następny: 5 s blokady + 5 s rozmycia.
  Licznik nie spada do końca rundy, zeruje się dopiero w rewanżu.
- **Wygrana**: kto pierwszy poprawnie wypełni planszę. Wyjście z gry albo zerwane połączenie na dłużej = wygrana drugiego.

## Hamulce

- Ataki trafiają do kolejki u ofiary i odpalają się po kolei, nie wszystkie naraz.
- Dwa obroty pod rząd nie wchodzą: po obrocie 10 s ochrony przed kolejnym obrotem (proste ataki dalej działają).
- Podpowiedzi wyłączone w multiplayerze (do potwierdzenia).

## Statystyki z rywalami

- W Statystykach na górze jest sekcja **Sabotaż · rywale**: karta na każdego przeciwnika z bilansem (wygrane:porażki), procentem wygranych i datą ostatniego meczu, nad nimi bilans wszystkich meczów.
- Przeciwnik ma nazwę z maila tylko wtedy, gdy **obaj gracze są zalogowani**. Telefon wysyła swój mail do rywala dopiero, gdy rywal zgłosił, że też ma konto. Mecze z kimś bez konta (albo rozegrane bez logowania) lądują zbiorczo pod „Gość”.
- Zalogowanemu mecze zapisują się też na koncie (tabela `sabotage_matches`, SQL w `supabase/sabotage_matches.sql`), więc wracają po zmianie telefonu. Bez konta siedzą tylko w telefonie. Mecze rozegrane bez logowania nie przechodzą na konto po zalogowaniu (i tak nie mają maila rywala).
- W trakcie gry pasek rywala pokazuje jego nazwę (część maila przed @), jeśli obaj są zalogowani.
- Mail rywala podaje jego własny telefon, serwer go nie sprawdza. Ktoś z przerobioną grą mógłby się podpisać cudzym mailem; przy statystykach dla zabawy to nie boli.
- Kod: `src/modes/sabotage/matches.ts` (zapis, łączenie z serwerem, bilans), `src/ui/rivals.ts` (karty), wymiana maili w `src/modes/sabotage/view.ts` (wiadomość `id`).

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
- **Zła cyfra** = 3 s blokady wpisywania u siebie (żeby nie opłacało się klepać na ślepo).
- **Wygrana**: kto pierwszy poprawnie wypełni planszę. Wyjście z gry albo zerwane połączenie na dłużej = wygrana drugiego.

## Hamulce

- Ataki trafiają do kolejki u ofiary i odpalają się po kolei, nie wszystkie naraz.
- Dwa obroty pod rząd nie wchodzą: po obrocie 10 s ochrony przed kolejnym obrotem (proste ataki dalej działają).
- Podpowiedzi wyłączone w multiplayerze (do potwierdzenia).

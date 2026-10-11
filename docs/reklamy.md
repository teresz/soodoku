# Reklamy (Google AdSense, wersja web)

## Gdzie są reklamy
- **Menu**: jedna jednostka pod przyciskami Ustawienia/Statystyki.
- **Okienko końca gry**: jedna jednostka pod przyciskami (żeby nie było przypadkowych kliknięć).
  Nowa reklama najwyżej raz na minutę, szybkie „Jeszcze raz” nie mieli odsłon.
- **Nigdzie w trakcie gry**: plansza, pauza, mecz Sabotażu i arkusze „Jak grać” są czyste.

Reklamy ładują się tylko na `soodoku.org` i `www.soodoku.org`. Podglądy PR-ów, localhost
i Artifact ich nie mają (Google nie lubi ruchu z cudzych domen i od developera).
Podgląd układu bez konta: dopisz `?ads=demo` do adresu, pojawią się szare ramki.

## Co trzeba zrobić w AdSense (teresz)
1. Załóż konto na adsense.google.com i dodaj stronę `soodoku.org`.
2. Weryfikacja strony: wybierz metodę **ads.txt**. Google pokaże linijkę
   `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` – podeślij ją albo sam numer `pub-…`.
3. **Prywatność i wiadomości → Europejskie przepisy**: utwórz komunikat o zgodzie (CMP Google, darmowy).
   Bez tego w EOG (czyli w Polsce) reklamy się nie wyświetlą. Kod nic tu nie potrzebuje,
   skrypt AdSense sam pokazuje baner zgody.
4. **Reklamy → Według jednostki → Reklamy displayowe**: utwórz dwie jednostki, np. `menu` i `koniec-gry`
   (format elastyczny). Podeślij ich numery `data-ad-slot`.
5. **Reklamy automatyczne zostaw wyłączone** – wcisnęłyby się na planszę w trakcie gry.

## Co wtedy zmieniam w kodzie
- `src/ads/config.ts`: `ADSENSE_CLIENT = 'ca-pub-…'`, `AD_SLOTS.home`, `AD_SLOTS.end`.
- `public/ads.txt`: linijka z punktu 2 (musi być pod `soodoku.org/ads.txt`).
Po merge'u Cloudflare wdroży to sam; akceptacja strony w AdSense trwa zwykle od kilku dni do kilku tygodni.

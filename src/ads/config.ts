// Google AdSense. Dopóki ADSENSE_CLIENT jest pusty, reklam nie ma wcale (skrypt Google się nie ładuje).
// Po akceptacji strony w AdSense: wpisz tu ca-pub-… i numery dwóch jednostek reklamowych,
// a ten sam pub-… dopisz do public/ads.txt (instrukcja w docs/reklamy.md).
// Jedna dyskretna reklama na samym dole menu; w grze i w okienkach nie ma żadnej (życzenie teresza).
export const ADSENSE_CLIENT = '';
export const AD_SLOTS = {
  home: '', // na samym dole menu, pod Ustawieniami/Statystykami
};
// Reklamy tylko na produkcji: podglądy PR-ów, localhost i Artifact nie klikają się w konto teresza.
export const AD_HOSTS = ['soodoku.org', 'www.soodoku.org'];

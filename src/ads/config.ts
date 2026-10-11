// Google AdSense (konto teresza). Skrypt Google ładuje się na soodoku.org już teraz (weryfikacja strony,
// baner zgody), ale reklama pojawi się dopiero po wpisaniu numeru jednostki w AD_SLOTS.home.
// Ten sam pub-… siedzi w public/ads.txt (instrukcja w docs/reklamy.md).
// Jedna dyskretna reklama na samym dole menu; w grze i w okienkach nie ma żadnej (życzenie teresza).
export const ADSENSE_CLIENT = 'ca-pub-6505616545830186';
export const AD_SLOTS = {
  home: '', // na samym dole menu, pod Ustawieniami/Statystykami
};
// Reklamy tylko na produkcji: podglądy PR-ów, localhost i Artifact nie klikają się w konto teresza.
export const AD_HOSTS = ['soodoku.org', 'www.soodoku.org'];

import { Appearance } from './themes';

export interface Settings {
  theme: string;
  appearance: Appearance;
  checkMistakes: boolean; // czerwone błędy + limit 3 pomyłek
  highlightPeers: boolean; // wiersz, kolumna, kwadrat
  highlightSame: boolean; // te same cyfry
  autoClearNotes: boolean; // wpisana cyfra czyści notatki sąsiadów
  showTimer: boolean;
  motion: boolean; // animacje i żywe tło
  sound: boolean; // ciche dźwięki gry
  vibrate: boolean; // wibracje przy błędach (telefony z Androidem)
  music: number; // głośność muzyki w tle 0–100, 0 = wyłączona
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'volt',
  appearance: 'auto',
  checkMistakes: true,
  highlightPeers: true,
  highlightSame: true,
  autoClearNotes: true,
  showTimer: true,
  motion: true,
  sound: true,
  vibrate: true,
  music: 40,
};

const KEY = 'kratka.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bez zapisu też się gra */ }
}

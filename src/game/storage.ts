import { SavedGame } from './game';

const GAME_KEY = 'kratka.game.v1';
const STATS_KEY = 'kratka.stats.v1';

export interface DiffStats { played: number; won: number; bestMs: number | null; bestScore?: number }
export type Stats = Partial<Record<string, DiffStats>>; // klucz: `${modeId}:${difficulty}`

// localStorage potrafi rzucić wyjątkiem (tryb prywatny, zablokowane dane) – wtedy po prostu nie zapisujemy.
const read = <T>(key: string): T | null => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
};
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* trudno */ }
};

export const loadGame = () => {
  const g = read<SavedGame>(GAME_KEY);
  return g && g.v === 1 && g.values?.length === 81 ? g : null;
};
export const saveGame = (g: SavedGame) => write(GAME_KEY, g);

export const loadStats = (): Stats => read<Stats>(STATS_KEY) ?? {};

/** Wynik gry. Tryby z punktami (Tetroku) podają `score`: rekordem jest wtedy wynik, liczony też po przegranej. */
export function recordResult(modeId: string, difficulty: string, won: boolean, ms: number, score?: number): { stats: DiffStats; newBest: boolean } {
  const all = loadStats();
  const key = `${modeId}:${difficulty}`;
  const s = all[key] ?? { played: 0, won: 0, bestMs: null };
  s.played++;
  let newBest = false;
  if (score !== undefined) {
    if (s.bestScore === undefined || score > s.bestScore) { s.bestScore = score; newBest = true; }
    if (won) s.won++;
  } else if (won) {
    s.won++;
    if (s.bestMs === null || ms < s.bestMs) { s.bestMs = ms; newBest = true; }
  }
  all[key] = s;
  write(STATS_KEY, all);
  return { stats: s, newBest };
}

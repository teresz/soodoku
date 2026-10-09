// Wyzwanie dnia: czysta logika bez DOM. Wyzwanie wynika z samej daty (ten sam dla wszystkich, bez serwera),
// a postęp gracza (zrobione dni, streak) siedzi w localStorage.
import { makeRng, shuffle } from '../core/rng';

/** Pierwszy dzień kalendarza wyzwań. Wcześniejszych dni nie ma. */
export const DAILY_START = '2026-10-01';

/** Haczyk dnia: dodatkowa reguła na wierzch trybu. */
export type DailyMod = 'none' | 'noHints' | 'strict' | 'noNotes';

export interface DailyTag { day: string; mod: DailyMod }

export interface Challenge {
  day: string;
  weekday: number; // 0 = poniedziałek … 6 = niedziela
  modeId: string;
  difficulty: string;
  level: number; // pozycja poziomu w drabince trybu (0 = najłatwiejszy)
  levels: number; // ile poziomów ma tryb
  mod: DailyMod;
  seed: number;
  /** Losowa liczba dnia do wyboru wariantów tekstu notatki. */
  flavor: number;
}

// Wyzwania są tylko z klasycznego sudoku (decyzja teresza): Logika i Odkryte pola, na zmianę.
// Kolejność id = kolejność poziomów.
export const DAILY_MODES: { id: string; levels: string[] }[] = [
  { id: 'classic', levels: ['easy', 'medium', 'hard', 'expert'] },
  { id: 'clues', levels: ['c50', 'c42', 'c36', 'c30', 'c26', 'c23'] },
];
const MODS: DailyMod[] = ['noHints', 'strict', 'noNotes'];

// Tydzień rośnie jak w gazecie: poniedziałek na rozgrzewkę, sobota najcięższa, niedziela trochę luźniej.
const WEEK_RAMP = [0.05, 0.2, 0.38, 0.5, 0.62, 0.92, 0.75];

// --- daty w lokalnym czasie telefonu, zapisywane jako 'RRRR-MM-DD' ---
const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // południe: zmiana czasu nie przeskoczy dnia
};
export const addDays = (key: string, n: number) => {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
/** Numer dnia od 1970 (niezależny od strefy, bo liczony z samej daty). */
export const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
export const weekdayOf = (key: string) => (parseDay(key).getDay() + 6) % 7;

/** Hash tekstu (FNV-1a) na seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Kolejność trybów w bloku dni (tyle dni, ile trybów): każdy tryb raz, bez powtórki na styku bloków. */
function blockOrder(block: number): number[] {
  const order = shuffle(DAILY_MODES.map((_, k) => k), makeRng(hashString(`soodoku-block-${block}`)));
  if (block > 0) {
    const prev = blockOrder(block - 1);
    if (order[0] === prev[prev.length - 1]) [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

/** Wyzwanie na dany dzień. Zawsze to samo dla tej samej daty. */
export function challengeFor(day: string): Challenge {
  const n = dayNumber(day);
  const rng = makeRng(hashString(`soodoku-daily-${day}`));
  const block = Math.floor(n / DAILY_MODES.length);
  const mode = DAILY_MODES[blockOrder(block - Math.floor(dayNumber(DAILY_START) / DAILY_MODES.length))[n % DAILY_MODES.length]];
  const weekday = weekdayOf(day);
  // Odrobina szumu, żeby dwa wtorki nie były identyczne.
  const frac = Math.min(1, Math.max(0, WEEK_RAMP[weekday] + (rng() - 0.5) * 0.22));
  const level = Math.round(frac * (mode.levels.length - 1));
  const roll = rng();
  // Mniej więcej co drugi dzień bez haczyka; w weekend haczyk częściej.
  const mod: DailyMod = roll < (weekday >= 5 ? 0.3 : 0.5) ? 'none' : MODS[Math.floor(rng() * MODS.length)];
  return {
    day, weekday, modeId: mode.id, difficulty: mode.levels[level], level, levels: mode.levels.length, mod,
    seed: hashString(`soodoku-seed-${day}`) & 0x7fffffff,
    flavor: Math.floor(rng() * 1e6),
  };
}

// --- postęp gracza ---
export interface DayRecord {
  ms: number; // najlepszy czas
  mistakes: number;
  hints: number;
  onTime: boolean; // ukończone w swoim dniu (tylko to podbija streak)
  doneOn: string; // dzień pierwszego ukończenia
}
export type DailyProgress = Record<string, DayRecord>;

const KEY = 'kratka.daily.v1';

export function loadProgress(): DailyProgress {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as DailyProgress) ?? {}; } catch { return {}; }
}
const saveProgress = (p: DailyProgress) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* trudno */ }
};

/**
 * Zapisuje ukończenie wyzwania z dnia `day`, zrobione dnia `today`.
 * Raz zdobyte „w terminie” zostaje; powtórka może tylko poprawić czas.
 */
export function recordDaily(progress: DailyProgress, day: string, today: string, r: { ms: number; mistakes: number; hints: number }): { progress: DailyProgress; first: boolean; onTime: boolean } {
  const prev = progress[day];
  const onTime = day === today;
  const next: DayRecord = prev
    ? { ...prev, onTime: prev.onTime || onTime, ms: Math.min(prev.ms, r.ms), mistakes: prev.ms <= r.ms ? prev.mistakes : r.mistakes, hints: prev.ms <= r.ms ? prev.hints : r.hints }
    : { ...r, onTime, doneOn: today };
  return { progress: { ...progress, [day]: next }, first: !prev, onTime };
}

export function markDone(day: string, today: string, r: { ms: number; mistakes: number; hints: number }) {
  const res = recordDaily(loadProgress(), day, today, r);
  saveProgress(res.progress);
  return res;
}

/**
 * Bieżący streak: dni z rzędu zrobione w terminie. Dzisiejszy brak jeszcze go nie zrywa
 * (dzień się nie skończył), więc liczymy od dziś albo od wczoraj.
 */
export function currentStreak(progress: DailyProgress, today: string): number {
  let d = progress[today]?.onTime ? today : addDays(today, -1);
  let n = 0;
  while (progress[d]?.onTime) { n++; d = addDays(d, -1); }
  return n;
}

export function bestStreak(progress: DailyProgress): number {
  const days = Object.keys(progress).filter((d) => progress[d].onTime).map(dayNumber).sort((a, b) => a - b);
  let best = 0, run = 0;
  days.forEach((n, k) => { run = k > 0 && n === days[k - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

export type DayState = 'before' | 'future' | 'today' | 'onTime' | 'late' | 'missed';

export function dayState(progress: DailyProgress, day: string, today: string): DayState {
  if (dayNumber(day) < dayNumber(DAILY_START)) return 'before';
  if (dayNumber(day) > dayNumber(today)) return 'future';
  const r = progress[day];
  if (r) return r.onTime ? 'onTime' : 'late';
  return day === today ? 'today' : 'missed';
}

import { CELLS, Grid } from './board';
import { Technique, rate } from './logic';
import { Rng, makeRng, shuffle } from './rng';
import { countSolutions, search } from './solver';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Łatwy' },
  { id: 'medium', label: 'Średni' },
  { id: 'hard', label: 'Trudny' },
  { id: 'expert', label: 'Ekspert' },
];

interface Profile {
  targetClues: number; // do ilu podpowiedzi zdejmujemy cyfry
  accept: (t: Technique, clues: number) => boolean;
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { targetClues: 38, accept: (t) => t <= Technique.HiddenSingle },
  medium: { targetClues: 31, accept: (t) => t <= Technique.HiddenSingle },
  hard: { targetClues: 26, accept: (t, clues) => clues <= 28 && t === Technique.LockedCandidates || t === Technique.NakedPair },
  expert: { targetClues: 22, accept: (t, clues) => t === Technique.Beyond && clues <= 25 },
};

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: string;
  seed: number;
}

export function fullGrid(rng: Rng): Grid {
  return search(new Array(CELLS).fill(0), 1, rng).solution!;
}

/** Zdejmuje cyfry symetrycznie (180°), pilnując jednoznaczności rozwiązania. */
export function carve(solution: Grid, targetClues: number, rng: Rng): Grid {
  const g = solution.slice();
  let clues = CELLS;
  const order = shuffle([...Array(41)].map((_, i) => i), rng); // połowa planszy + środek
  for (const i of order) {
    if (clues <= targetClues) break;
    const j = CELLS - 1 - i;
    const a = g[i], b = g[j];
    g[i] = 0; g[j] = 0;
    if (countSolutions(g, 2) !== 1) { g[i] = a; g[j] = b; continue; }
    clues -= i === j ? 1 : 2;
  }
  return g;
}

/**
 * Generuje planszę o danej trudności. Próbuje kilka razy trafić w profil technik,
 * a jak się nie uda, oddaje najlepsze przybliżenie (lepsza gra teraz niż idealna nigdy).
 */
export function generate(difficulty: Difficulty, seed: number, maxAttempts = 120): Puzzle {
  const profile = PROFILES[difficulty];
  const rng = makeRng(seed);
  let fallback: Puzzle | null = null;
  let fallbackScore = -Infinity;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = fullGrid(rng);
    const puzzle = carve(solution, profile.targetClues, rng);
    const r = rate(puzzle);
    const clues = puzzle.filter(Boolean).length;
    const result = { puzzle, solution, difficulty, seed };
    if (profile.accept(r.hardest, clues)) return result;
    // Na łatwych chcemy jak najprościej, na trudnych jak najtrudniej.
    const score = difficulty === 'easy' || difficulty === 'medium' ? -r.hardest * 100 + clues : r.hardest * 100 - clues;
    if (score > fallbackScore) { fallback = result; fallbackScore = score; }
  }
  return fallback!;
}

/** Zdejmuje cyfry pojedynczo w losowej kolejności (bez symetrii), aż zostanie dokładnie `targetClues` albo nie da się dalej. */
export function carveFree(solution: Grid, targetClues: number, rng: Rng): Grid {
  const g = solution.slice();
  let clues = CELLS;
  for (const i of shuffle([...Array(CELLS)].map((_, k) => k), rng)) {
    if (clues <= targetClues) break;
    const a = g[i];
    g[i] = 0;
    if (countSolutions(g, 2) !== 1) { g[i] = a; continue; }
    clues--;
  }
  return g;
}

/**
 * Trudność wg liczby wpisanych pól: plansza ma dokładnie `clues` cyfr na start (jednoznaczna).
 * Techniki nie mają tu znaczenia. Przy bardzo małej liczbie cyfr może trzeba kilku prób.
 */
export function generateByClues(clues: number, seed: number, maxAttempts = 60): Puzzle {
  const rng = makeRng(seed);
  let best: Puzzle | null = null;
  let bestClues = Infinity;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = fullGrid(rng);
    const puzzle = carveFree(solution, clues, rng);
    const n = puzzle.filter(Boolean).length;
    const result = { puzzle, solution, difficulty: `c${clues}`, seed };
    if (n === clues) return result;
    if (n < bestClues) { best = result; bestClues = n; }
  }
  return best!;
}

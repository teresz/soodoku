import { Grid, fromString } from './board';
import { makeRng, shuffle } from './rng';
import { solve } from './solver';
import type { Puzzle } from './generator';

/**
 * Poziom Niemożliwy: losowanie nawet z twardym solverem daje plansze ledwo trudniejsze od Eksperta,
 * więc bierzemy najtrudniejsze znane sudoku (AI Escargot, Everest, Easter Monster i podobne z list „top”)
 * i przebieramy je z seeda: zamiana cyfr, przestawianie wierszy w pasach, pasów, kolumn, stosów i transpozycja.
 * To ta sama łamigłówka w innym przebraniu: dalej jedno rozwiązanie i ta sama (kosmiczna) trudność.
 * Każda ma dokładnie jedno rozwiązanie (pilnuje test), a `deep.ts` utyka na niej, czyli jest poza wszystkim, co generujemy.
 */
export const HARDEST: string[] = [
  '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..', // AI Escargot
  '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..', // Everest
  '1.......2.9.4...5...6...7...5.9.3.......7.......85..4.7.....6...3...9.8...2.....1', // Easter Monster
  '..3..6.8....1..2......7...4..9..8.6..3..4...1.7.2.....3....5.....5...6..98.....5.',
  '........8..3...4...9..2..6.....79.......612...6.5.2.7...8...5...1.....2.4.5.....3',
  '1.......2.9.4...5...6...7...5.3.4.......6........58.4...2...6...3...9.8.7.......1',
  '6.2.5.........4.3..........43...8....1....2........7..5..27...........81...6.....',
  '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
  '7.8...3.....6.1...5.........4.....263...8.......1...9..9.2....4....7.5...........',
];

/** Permutacja 0..8, która miesza grupy po trzy i kolejność wewnątrz grup (zachowuje pasy/stosy). */
function bandPerm(rng: () => number): number[] {
  const out: number[] = [];
  for (const b of shuffle([0, 1, 2], rng)) for (const r of shuffle([0, 1, 2], rng)) out.push(b * 3 + r);
  return out;
}

export function generateHardest(seed: number): Puzzle {
  const rng = makeRng(seed);
  const base = fromString(HARDEST[Math.floor(rng() * HARDEST.length)]);
  const digits = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)];
  const rows = bandPerm(rng), cols = bandPerm(rng);
  const flip = rng() < 0.5;
  const puzzle: Grid = new Array(81).fill(0);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const [sr, sc] = flip ? [cols[c], rows[r]] : [rows[r], cols[c]];
    puzzle[r * 9 + c] = digits[base[sr * 9 + sc]];
  }
  return { puzzle, solution: solve(puzzle)!, difficulty: 'impossible', seed };
}

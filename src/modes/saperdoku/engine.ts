import { CELLS, Grid, colOf, rowOf } from '../../core/board';
import { generateByClues } from '../../core/generator';
import { Rng, makeRng, shuffle } from '../../core/rng';

/**
 * Saperdoku: sudoku + saper. Kilka losowych pustych pól to miny. Pod miną dalej leży cyfra z rozwiązania,
 * ale jej się nie wpisuje, tylko flaguje. Pola startowe i dobrze wpisane pokazują licznik min dookoła.
 * Sudoku mówi, jaka cyfra stoi w polu, ale nie mówi, czy to mina: to wiadomo tylko z liczników.
 */

export interface SaperLevel {
  id: string;
  clues: number; // cyfry na start
  mines: number;
  showList: boolean; // czy gra pokazuje, które cyfry leżą pod minami
}

export const LEVELS: SaperLevel[] = [
  { id: 'm1', clues: 36, mines: 8, showList: true },
  { id: 'm2', clues: 32, mines: 11, showList: true },
  { id: 'm3', clues: 28, mines: 14, showList: true },
  { id: 'm4', clues: 26, mines: 17, showList: false },
  { id: 'm5', clues: 24, mines: 21, showList: false },
];

export const levelOf = (id: string) => LEVELS.find((l) => l.id === id) ?? LEVELS[1];

export interface SaperState {
  mines: number[]; // indeksy pól z minami
  flags: number[]; // oflagowane miny (zła flaga się nie utrzymuje, więc każda flaga jest poprawna)
  exploded: number[]; // miny, w które ktoś wpisał cyfrę
  showList: boolean;
}

/** 8 sąsiadów jak w saperze (nie mylić z PEERS z sudoku). */
export const AROUND: number[][] = [...Array(CELLS)].map((_, i) => {
  const out: number[] = [];
  const r = rowOf(i), c = colOf(i);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((dr || dc) && rr >= 0 && rr < 9 && cc >= 0 && cc < 9) out.push(rr * 9 + cc);
  }
  return out;
});

export const mineCount = (mineSet: Set<number> | boolean[], i: number) =>
  AROUND[i].reduce((n, j) => n + ((mineSet instanceof Set ? mineSet.has(j) : mineSet[j]) ? 1 : 0), 0);

/** Wiedza gracza: które pola na pewno są bezpieczne (pokazują licznik), a które na pewno są minami. */
export interface Knowledge { safe: boolean[]; mine: boolean[] }

export type Deduction = { index: number; mine: boolean };

/**
 * Jeden krok dedukcji sapera (z cyframi z sudoku, bo te gracz zawsze może wydedukować z planszy startowej).
 * Reguły: licznik z kompletem (0 lub wszystko), podzbiory dwóch liczników, lista cyfr-min (gdy widoczna)
 * i globalna liczba min. Zwraca listę pewnych wniosków albo pustą, gdy trzeba by zgadywać.
 */
export function deduce(solution: Grid, mines: Set<number>, k: Knowledge, showList: boolean): Deduction[] {
  const out = new Map<number, boolean>();
  const add = (i: number, m: boolean) => { if (!k.safe[i] && !k.mine[i] && !out.has(i)) out.set(i, m); };

  // Ograniczenia z liczników: zbiór nieznanych pól + ile z nich to miny.
  const cons: { cells: number[]; n: number }[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (!k.safe[i]) continue;
    const unknown = AROUND[i].filter((j) => !k.safe[j] && !k.mine[j]);
    if (!unknown.length) continue;
    const n = mineCount(mines, i) - AROUND[i].filter((j) => k.mine[j]).length;
    cons.push({ cells: unknown, n });
  }
  // Lista cyfr-min: dla każdej cyfry wiadomo, ile min ją kryje.
  if (showList) {
    for (let d = 1; d <= 9; d++) {
      let total = 0, found = 0;
      const unknown: number[] = [];
      for (let i = 0; i < CELLS; i++) {
        if (solution[i] !== d) continue;
        if (mines.has(i)) total++;
        if (k.mine[i]) found++;
        else if (!k.safe[i]) unknown.push(i);
      }
      if (unknown.length) cons.push({ cells: unknown, n: total - found });
    }
  }
  // Globalnie: licznik pozostałych min u góry ekranu.
  const allUnknown = [...Array(CELLS).keys()].filter((i) => !k.safe[i] && !k.mine[i]);
  if (allUnknown.length) cons.push({ cells: allUnknown, n: mines.size - k.mine.filter(Boolean).length });

  for (const c of cons) {
    if (c.n === 0) c.cells.forEach((i) => add(i, false));
    else if (c.n === c.cells.length) c.cells.forEach((i) => add(i, true));
  }
  if (out.size) return [...out].map(([index, mine]) => ({ index, mine }));

  // Podzbiory: A ⊆ B => różnica B\A ma n(B)-n(A) min.
  for (const a of cons) for (const b of cons) {
    if (a === b || a.cells.length >= b.cells.length) continue;
    const bs = new Set(b.cells);
    if (!a.cells.every((i) => bs.has(i))) continue;
    const as = new Set(a.cells);
    const rest = b.cells.filter((i) => !as.has(i));
    const n = b.n - a.n;
    if (n === 0) rest.forEach((i) => add(i, false));
    else if (n === rest.length) rest.forEach((i) => add(i, true));
  }
  return [...out].map(([index, mine]) => ({ index, mine }));
}

/** Czy da się przejść całą planszę bez zgadywania, startując od pól startowych. */
export function solvable(puzzle: Grid, solution: Grid, mines: Set<number>, showList: boolean): boolean {
  const k: Knowledge = { safe: puzzle.map(Boolean), mine: new Array(CELLS).fill(false) };
  for (;;) {
    const ds = deduce(solution, mines, k, showList);
    if (!ds.length) break;
    for (const d of ds) (d.mine ? k.mine : k.safe)[d.index] = true;
  }
  return k.safe.every((s, i) => s || k.mine[i]);
}

/** Losuje miny w pustych polach, aż układ da się rozwiązać logicznie. null = nie wyszło. */
export function placeMines(puzzle: Grid, solution: Grid, level: SaperLevel, rng: Rng, tries = 400): number[] | null {
  const empty = [...Array(CELLS).keys()].filter((i) => !puzzle[i]);
  for (let t = 0; t < tries; t++) {
    const mines = shuffle(empty.slice(), rng).slice(0, level.mines);
    if (solvable(puzzle, solution, new Set(mines), level.showList)) return mines.sort((a, b) => a - b);
  }
  return null;
}

export function createSaper(difficulty: string, seed: number) {
  const level = levelOf(difficulty);
  const rng = makeRng(seed ^ 0x5a9e);
  for (let attempt = 0; ; attempt++) {
    const p = generateByClues(level.clues, seed + attempt * 7919);
    const mines = placeMines(p.puzzle, p.solution, level, rng);
    if (mines) return { puzzle: p.puzzle, solution: p.solution, mines };
  }
}

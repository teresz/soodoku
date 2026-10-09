import { ALL_DIGITS, CELLS, Grid, boxOf, colOf, popcount, rowOf } from './board';
import { Rng } from './rng';

export interface SearchResult {
  count: number; // ile rozwiązań znaleziono (maks. limit)
  solution: Grid | null; // pierwsze znalezione
}

/**
 * Backtracking na maskach bitowych z heurystyką MRV.
 * limit=2 wystarcza do sprawdzenia jednoznaczności; rng losuje kolejność cyfr (do generowania pełnych plansz).
 */
export function search(grid: Grid, limit = 2, rng?: Rng): SearchResult {
  const g = grid.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < CELLS; i++) {
    const v = g[i];
    if (!v) continue;
    const b = 1 << v, r = rowOf(i), c = colOf(i), x = boxOf(i);
    if (rows[r] & b || cols[c] & b || boxes[x] & b) return { count: 0, solution: null };
    rows[r] |= b; cols[c] |= b; boxes[x] |= b;
  }

  let count = 0;
  let solution: Grid | null = null;

  const rec = (): boolean => {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (g[i]) continue;
      const m = ALL_DIGITS & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = popcount(m);
      if (n === 0) return false;
      if (n < bestCount) { best = i; bestMask = m; bestCount = n; if (n === 1) break; }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = g.slice();
      return count >= limit;
    }
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (rng) for (let k = digits.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [digits[k], digits[j]] = [digits[j], digits[k]];
    }
    const r = rowOf(best), c = colOf(best), x = boxOf(best);
    for (const d of digits) {
      const b = 1 << d;
      g[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
      const stop = rec();
      g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b;
      if (stop) return true;
    }
    return false;
  };

  rec();
  return { count, solution };
}

export const countSolutions = (grid: Grid, limit = 2) => search(grid, limit).count;
export const solve = (grid: Grid) => search(grid, 1).solution;

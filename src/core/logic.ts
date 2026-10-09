import { ALL_DIGITS, CELLS, Grid, PEERS, UNITS, UNITS_OF, bit, popcount } from './board';

/**
 * Logiczny „ludzki” solver do oceny trudności.
 * Poziomy technik: 1 = pojedynczy kandydat (naked single), 2 = ukryta pojedyncza (hidden single),
 * 3 = zablokowani kandydaci (pointing/claiming), 4 = nagie pary, 5 = trzeba zgadywać / zaawansowane.
 */
export enum Technique {
  NakedSingle = 1,
  HiddenSingle = 2,
  LockedCandidates = 3,
  NakedPair = 4,
  Beyond = 5,
}

export interface Rating {
  solved: boolean;
  hardest: Technique;
  steps: number;
}

export function rate(puzzle: Grid): Rating {
  const g = puzzle.slice();
  const cand: number[] = new Array(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (g[i]) continue;
    let used = 0;
    for (const p of PEERS[i]) if (g[p]) used |= bit(g[p]);
    cand[i] = ALL_DIGITS & ~used;
  }
  let hardest = Technique.NakedSingle;
  let steps = 0;

  const place = (i: number, d: number) => {
    g[i] = d; cand[i] = 0; steps++;
    for (const p of PEERS[i]) cand[p] &= ~bit(d);
  };

  const nakedSingle = () => {
    for (let i = 0; i < CELLS; i++) {
      if (!g[i] && popcount(cand[i]) === 1) { place(i, Math.log2(cand[i])); return true; }
    }
    return false;
  };

  const hiddenSingle = () => {
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        let spot = -1, n = 0;
        for (const i of unit) if (!g[i] && cand[i] & bit(d)) { spot = i; n++; }
        if (n === 1) { place(spot, d); return true; }
      }
    }
    return false;
  };

  const lockedCandidates = () => {
    let changed = false;
    // Kandydaci cyfry d w jednostce A leżą w całości w jednostce B => usuń d z reszty B.
    for (let a = 0; a < 27; a++) {
      for (let d = 1; d <= 9; d++) {
        const spots = UNITS[a].filter((i) => !g[i] && cand[i] & bit(d));
        if (spots.length < 2) continue;
        for (const b of UNITS_OF[spots[0]]) {
          if (b === a || !spots.every((i) => UNITS_OF[i].includes(b))) continue;
          for (const j of UNITS[b]) {
            if (!spots.includes(j) && !g[j] && cand[j] & bit(d)) { cand[j] &= ~bit(d); changed = true; }
          }
        }
      }
    }
    return changed;
  };

  const nakedPair = () => {
    let changed = false;
    for (const unit of UNITS) {
      const pairs = unit.filter((i) => !g[i] && popcount(cand[i]) === 2);
      for (let x = 0; x < pairs.length; x++) for (let y = x + 1; y < pairs.length; y++) {
        const m = cand[pairs[x]];
        if (m !== cand[pairs[y]]) continue;
        for (const j of unit) {
          if (j !== pairs[x] && j !== pairs[y] && !g[j] && cand[j] & m) { cand[j] &= ~m; changed = true; }
        }
      }
    }
    return changed;
  };

  for (;;) {
    if (g.every((v) => v)) return { solved: true, hardest, steps };
    if (nakedSingle()) continue;
    if (hiddenSingle()) { hardest = Math.max(hardest, Technique.HiddenSingle); continue; }
    if (lockedCandidates()) { hardest = Math.max(hardest, Technique.LockedCandidates); continue; }
    if (nakedPair()) { hardest = Math.max(hardest, Technique.NakedPair); continue; }
    return { solved: false, hardest: Technique.Beyond, steps };
  }
}

/** Znajdź komórkę, którą da się teraz wydedukować prostą techniką (do podpowiedzi). */
export function findEasyMove(grid: Grid): { index: number; digit: number } | null {
  const cand = grid.map((v, i) => {
    if (v) return 0;
    let used = 0;
    for (const p of PEERS[i]) if (grid[p]) used |= bit(grid[p]);
    return ALL_DIGITS & ~used;
  });
  for (let i = 0; i < CELLS; i++) if (!grid[i] && popcount(cand[i]) === 1) return { index: i, digit: Math.log2(cand[i]) };
  for (const unit of UNITS) for (let d = 1; d <= 9; d++) {
    const spots = unit.filter((i) => !grid[i] && cand[i] & bit(d));
    if (spots.length === 1) return { index: spots[0], digit: d };
  }
  return null;
}

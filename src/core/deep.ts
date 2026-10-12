import { ALL_DIGITS, CELLS, Grid, PEERS, UNITS, bit, popcount } from './board';

/**
 * Mocniejszy „ludzki” solver do poziomu Niemożliwy. Zna techniki, których nie ma w `logic.ts`
 * (trójki, ukryte pary, ryby, skrzydła, łańcuchy kolorów, wymuszenia), więc odróżnia planszę
 * „trudną, ale do zrobienia głową” od takiej, gdzie zostaje zgadywanie.
 * `logic.ts` zostaje bez zmian, bo z niego liczą się stare poziomy i wyzwania dnia (ta sama plansza z seeda).
 */
export enum Tier {
  Singles = 1,
  Locked = 2,
  Subsets = 3, // nagie/ukryte pary i trójki
  Fish = 4, // X-Wing, Swordfish, Jellyfish
  Wings = 5, // XY-Wing, XYZ-Wing
  Coloring = 6, // łańcuchy jednej cyfry (proste kolorowanie)
  Forcing = 7, // założenie prowadzi do sprzeczności
}

export interface DeepRating {
  solved: boolean;
  hardest: Tier;
  /** Ile razy trzeba było sięgnąć po technikę z poziomu Fish lub wyżej. */
  advanced: number;
  /** Ile razy trzeba było użyć wymuszenia (najcięższa technika). */
  forced: number;
  /** Plansza po rozwiązywaniu (pełna, gdy solved). */
  grid: Grid;
}

const ROWS = UNITS.slice(0, 9), COLS = UNITS.slice(9, 18);
const PEER_SET = PEERS.map((p) => new Set(p));
const sees = (a: number, b: number) => PEER_SET[a].has(b);

function combos(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < n; i++) { acc.push(i); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}
const COMBOS: Record<number, number[][]> = {};
const combosOf = (n: number, k: number) => (COMBOS[n * 10 + k] ??= combos(n, k));

class Board {
  g: Grid;
  cand: number[];
  constructor(g: Grid, cand?: number[]) {
    this.g = g.slice();
    if (cand) { this.cand = cand.slice(); return; }
    this.cand = new Array(CELLS).fill(0);
    for (let i = 0; i < CELLS; i++) {
      if (this.g[i]) continue;
      let used = 0;
      for (const p of PEERS[i]) if (this.g[p]) used |= bit(this.g[p]);
      this.cand[i] = ALL_DIGITS & ~used;
    }
  }
  clone() { return new Board(this.g, this.cand); }
  place(i: number, d: number) {
    this.g[i] = d; this.cand[i] = 0;
    for (const p of PEERS[i]) this.cand[p] &= ~bit(d);
  }
  /** Usuwa kandydata; true = coś się zmieniło. */
  drop(i: number, d: number) {
    if (this.g[i] || !(this.cand[i] & bit(d))) return false;
    this.cand[i] &= ~bit(d);
    return true;
  }
  done() { return this.g.every((v) => v); }
  /** Sprzeczność: puste pole bez kandydatów albo cyfra bez miejsca w jednostce. */
  broken() {
    for (let i = 0; i < CELLS; i++) if (!this.g[i] && !this.cand[i]) return true;
    for (const u of UNITS) {
      let seen = 0, placed = 0;
      for (const i of u) {
        if (this.g[i]) { if (placed & bit(this.g[i])) return true; placed |= bit(this.g[i]); } else seen |= this.cand[i];
      }
      if ((seen | placed) !== ALL_DIGITS) return true;
    }
    return false;
  }
  spots(u: number[], d: number) { return u.filter((i) => !this.g[i] && this.cand[i] & bit(d)); }
}

// --- techniki: każda zwraca true, gdy coś wpisała albo skreśliła ---

function singles(b: Board): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (!b.g[i] && popcount(b.cand[i]) === 1) { b.place(i, Math.log2(b.cand[i])); return true; }
  }
  for (const u of UNITS) for (let d = 1; d <= 9; d++) {
    const s = b.spots(u, d);
    if (s.length === 1) { b.place(s[0], d); return true; }
  }
  return false;
}

function locked(b: Board): boolean {
  let changed = false;
  for (let a = 0; a < 27; a++) for (let d = 1; d <= 9; d++) {
    const s = b.spots(UNITS[a], d);
    if (s.length < 2) continue;
    for (let o = 0; o < 27; o++) {
      if (o === a || !s.every((i) => UNITS[o].includes(i))) continue;
      for (const j of UNITS[o]) if (!s.includes(j) && b.drop(j, d)) changed = true;
    }
  }
  return changed;
}

function subsets(b: Board): boolean {
  let changed = false;
  for (const u of UNITS) {
    const empty = u.filter((i) => !b.g[i]);
    for (let k = 2; k <= 3 && k < empty.length; k++) {
      // nagie: k pól o łącznie k kandydatach
      for (const c of combosOf(empty.length, k)) {
        let m = 0;
        for (const x of c) m |= b.cand[empty[x]];
        if (popcount(m) !== k) continue;
        const set = c.map((x) => empty[x]);
        for (const j of empty) if (!set.includes(j)) for (let d = 1; d <= 9; d++) if (m & bit(d) && b.drop(j, d)) changed = true;
      }
      // ukryte: k cyfr, które mieszczą się w k polach
      const digits = [...Array(9)].map((_, x) => x + 1).filter((d) => b.spots(u, d).length >= 2);
      for (const c of combosOf(digits.length, k)) {
        const ds = c.map((x) => digits[x]);
        const cells = new Set<number>();
        for (const d of ds) for (const i of b.spots(u, d)) cells.add(i);
        if (cells.size !== k) continue;
        const keep = ds.reduce((m, d) => m | bit(d), 0);
        for (const i of cells) for (let d = 1; d <= 9; d++) if (!(keep & bit(d)) && b.drop(i, d)) changed = true;
      }
    }
    if (changed) return true;
  }
  return changed;
}

function fish(b: Board): boolean {
  for (const [base, cover] of [[ROWS, COLS], [COLS, ROWS]] as const) {
    for (let d = 1; d <= 9; d++) {
      const lines = base.map((u, n) => ({ n, pos: b.spots(u, d).map((i) => (base === ROWS ? i % 9 : Math.floor(i / 9))) }))
        .filter((l) => l.pos.length >= 2);
      for (let k = 2; k <= 4; k++) {
        const ok = lines.filter((l) => l.pos.length <= k);
        for (const c of combosOf(ok.length, k)) {
          const pick = c.map((x) => ok[x]);
          const covers = new Set(pick.flatMap((l) => l.pos));
          if (covers.size !== k) continue;
          const rows = new Set(pick.map((l) => l.n));
          let changed = false;
          for (const cn of covers) for (const i of cover[cn]) {
            const line = base === ROWS ? Math.floor(i / 9) : i % 9;
            if (!rows.has(line) && b.drop(i, d)) changed = true;
          }
          if (changed) return true;
        }
      }
    }
  }
  return false;
}

function wings(b: Board): boolean {
  const bival = [];
  for (let i = 0; i < CELLS; i++) if (!b.g[i] && popcount(b.cand[i]) === 2) bival.push(i);
  // XY-Wing: oś {x,y}, skrzydła {x,z} i {y,z} => z znika z pól widzących oba skrzydła
  for (const p of bival) {
    const wingsOf = bival.filter((w) => w !== p && sees(p, w) && popcount(b.cand[p] & b.cand[w]) === 1);
    for (let a = 0; a < wingsOf.length; a++) for (let c = a + 1; c < wingsOf.length; c++) {
      const w1 = wingsOf[a], w2 = wingsOf[c];
      const z = b.cand[w1] & b.cand[w2] & ~b.cand[p];
      if (popcount(z) !== 1 || (b.cand[w1] | b.cand[w2] | b.cand[p]) !== (b.cand[p] | z)) continue;
      if ((b.cand[w1] & b.cand[p]) === (b.cand[w2] & b.cand[p])) continue;
      const d = Math.log2(z);
      let changed = false;
      for (const j of PEERS[w1]) if (j !== p && j !== w2 && sees(j, w2) && b.drop(j, d)) changed = true;
      if (changed) return true;
    }
  }
  // XYZ-Wing: oś {x,y,z}, skrzydła {x,z} i {y,z} => z znika z pól widzących wszystkie trzy
  for (let p = 0; p < CELLS; p++) {
    if (b.g[p] || popcount(b.cand[p]) !== 3) continue;
    const ws = bival.filter((w) => sees(p, w) && (b.cand[w] & ~b.cand[p]) === 0);
    for (let a = 0; a < ws.length; a++) for (let c = a + 1; c < ws.length; c++) {
      const w1 = ws[a], w2 = ws[c];
      if (b.cand[w1] === b.cand[w2]) continue;
      const z = b.cand[w1] & b.cand[w2];
      if (popcount(z) !== 1) continue;
      const d = Math.log2(z);
      let changed = false;
      for (const j of PEERS[p]) if (j !== w1 && j !== w2 && sees(j, w1) && sees(j, w2) && b.drop(j, d)) changed = true;
      if (changed) return true;
    }
  }
  return false;
}

/** Proste kolorowanie: łańcuch silnych połączeń jednej cyfry, dwa kolory na przemian. */
function coloring(b: Board): boolean {
  for (let d = 1; d <= 9; d++) {
    const links = new Map<number, number[]>();
    for (const u of UNITS) {
      const s = b.spots(u, d);
      if (s.length !== 2) continue;
      for (const [x, y] of [[s[0], s[1]], [s[1], s[0]]]) {
        const l = links.get(x) ?? [];
        if (!l.includes(y)) l.push(y);
        links.set(x, l);
      }
    }
    const color = new Map<number, number>();
    for (const start of links.keys()) {
      if (color.has(start)) continue;
      const group: number[] = [];
      const queue = [start];
      color.set(start, 0);
      while (queue.length) {
        const x = queue.pop()!;
        group.push(x);
        for (const y of links.get(x)!) if (!color.has(y)) { color.set(y, 1 - color.get(x)!); queue.push(y); }
      }
      if (group.length < 4) continue;
      const side = [group.filter((x) => color.get(x) === 0), group.filter((x) => color.get(x) === 1)];
      // Dwa pola tego samego koloru się widzą => cały ten kolor jest fałszywy.
      for (const s of [0, 1]) {
        const clash = side[s].some((x, n) => side[s].slice(n + 1).some((y) => sees(x, y)));
        if (clash) {
          let changed = false;
          for (const x of side[s]) if (b.drop(x, d)) changed = true;
          if (changed) return true;
        }
      }
      // Pole spoza łańcucha widzi oba kolory => d tam nie stoi.
      let changed = false;
      for (let i = 0; i < CELLS; i++) {
        if (b.g[i] || !(b.cand[i] & bit(d)) || color.has(i)) continue;
        if (side[0].some((x) => sees(i, x)) && side[1].some((x) => sees(i, x)) && b.drop(i, d)) changed = true;
      }
      if (changed) return true;
    }
  }
  return false;
}

/** Proste techniki do sprawdzania założeń w wymuszeniach. */
function propagate(b: Board): boolean {
  for (;;) {
    if (b.broken()) return false;
    if (b.done()) return true;
    if (singles(b) || locked(b)) continue;
    return true;
  }
}

/** Wymuszenie: wpisanie kandydata do pola z dwoma kandydatami kończy się sprzecznością => skreśl go. */
function forcing(b: Board): boolean {
  const order = [...Array(CELLS).keys()].filter((i) => !b.g[i]).sort((x, y) => popcount(b.cand[x]) - popcount(b.cand[y]));
  for (const i of order) {
    if (popcount(b.cand[i]) > 3) break;
    for (let d = 1; d <= 9; d++) {
      if (!(b.cand[i] & bit(d))) continue;
      const t = b.clone();
      t.place(i, d);
      if (!propagate(t)) { b.drop(i, d); return true; }
    }
  }
  return false;
}

const STEPS: [Tier, (b: Board) => boolean][] = [
  [Tier.Singles, singles],
  [Tier.Locked, locked],
  [Tier.Subsets, subsets],
  [Tier.Fish, fish],
  [Tier.Wings, wings],
  [Tier.Coloring, coloring],
  [Tier.Forcing, forcing],
];

export function rateDeep(puzzle: Grid): DeepRating {
  const b = new Board(puzzle);
  let hardest = Tier.Singles, advanced = 0, forced = 0;
  for (;;) {
    if (b.done()) return { solved: true, hardest, advanced, forced, grid: b.g };
    if (b.broken()) return { solved: false, hardest, advanced, forced, grid: b.g };
    let moved = false;
    for (const [tier, step] of STEPS) {
      if (!step(b)) continue;
      hardest = Math.max(hardest, tier);
      if (tier >= Tier.Fish) advanced++;
      if (tier === Tier.Forcing) forced++;
      moved = true;
      break;
    }
    if (!moved) return { solved: false, hardest, advanced, forced, grid: b.g };
  }
}

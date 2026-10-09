import { CELLS, Grid, PEERS, UNITS, UNITS_OF, colOf, idx, rowOf } from '../../core/board';
import { Rng, makeRng, shuffle } from '../../core/rng';
import { countSolutions } from '../../core/solver';

// Tetroku „Układanka”: klocki z cyframi wycięte z rozwiązania, gracz szuka, gdzie pasują.
// Czysta logika bez DOM; stan siedzi w SavedGame.tetroku i zapisuje się razem z grą.

export interface PieceCell { r: number; c: number; d: number }
export interface Piece { id: number; cells: PieceCell[]; origin: number[] } // origin: pola, z których wycięto klocek

export interface Level {
  id: string;
  label: string;
  clues: number;
  minSize: number;
  maxSize: number;
  visible: number; // ile klocków widać w kolejce
  hold: boolean;
  fallMs: number | null; // pasek opadania; null = bez presji czasu
}

export const LEVELS: Level[] = [
  { id: 't40', label: 'Start', clues: 40, minSize: 2, maxSize: 3, visible: 3, hold: true, fallMs: null },
  { id: 't34', label: 'Łatwy', clues: 34, minSize: 2, maxSize: 4, visible: 3, hold: true, fallMs: 90000 },
  { id: 't30', label: 'Średni', clues: 30, minSize: 3, maxSize: 4, visible: 3, hold: true, fallMs: 60000 },
  { id: 't27', label: 'Trudny', clues: 27, minSize: 4, maxSize: 4, visible: 2, hold: true, fallMs: 45000 },
  { id: 't25', label: 'Ekspert', clues: 25, minSize: 4, maxSize: 5, visible: 1, hold: true, fallMs: 35000 },
  { id: 't23', label: 'Mistrz', clues: 23, minSize: 4, maxSize: 5, visible: 1, hold: false, fallMs: 25000 },
];
export const levelOf = (id: string) => LEVELS.find((l) => l.id === id) ?? LEVELS[2];

export interface TetrokuState {
  level: string;
  queue: Piece[];
  hold: Piece | null;
  holdUsed: boolean; // schowek raz na położenie, jak w tetrisie
  score: number;
  streak: number; // poprawne położenia z rzędu
  bestCombo: number;
  placed: number;
  fallLeftMs: number;
  draws: number; // licznik losowań (deterministyczny RNG: seed + draws)
  nextId: number;
  plan: number[][]; // jeszcze nie wylosowane kawałki pustych pól
}

/** Minimalny kawałek SavedGame, którego potrzebuje silnik. */
export interface Board {
  seed: number;
  values: Grid;
  solution: Grid;
  notes: number[];
  mistakes: number;
  hints: number;
  tetroku?: TetrokuState;
}

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// --- kształty ---

export function normalize(cells: PieceCell[]): PieceCell[] {
  const r0 = Math.min(...cells.map((p) => p.r)), c0 = Math.min(...cells.map((p) => p.c));
  return cells.map((p) => ({ r: p.r - r0, c: p.c - c0, d: p.d })).sort((a, b) => a.r - b.r || a.c - b.c);
}

/** Obrót o 90° zgodnie z zegarem; cyfry jadą razem z polami. */
export function rotate(cells: PieceCell[]): PieceCell[] {
  const h = Math.max(...cells.map((p) => p.r));
  return normalize(cells.map((p) => ({ r: p.c, c: h - p.r, d: p.d })));
}

export const pieceSize = (cells: PieceCell[]) => ({
  h: Math.max(...cells.map((p) => p.r)) + 1,
  w: Math.max(...cells.map((p) => p.c)) + 1,
});

/** Pola planszy, które zająłby klocek położony lewym górnym rogiem w (r, c); null = wystaje. */
export function footprint(cells: PieceCell[], r: number, c: number): number[] | null {
  const out: number[] = [];
  for (const p of cells) {
    const rr = r + p.r, cc = c + p.c;
    if (rr < 0 || rr > 8 || cc < 0 || cc > 8) return null;
    out.push(idx(rr, cc));
  }
  return out;
}

export const fitsSolution = (b: Board, cells: PieceCell[], r: number, c: number) => {
  const f = footprint(cells, r, c);
  return !!f && f.every((i, k) => !b.values[i] && b.solution[i] === cells[k].d);
};

/** Wszystkie miejsca (we wszystkich obrotach), gdzie klocek pasuje do rozwiązania. */
export function findFits(b: Board, cells: PieceCell[]): { cells: PieceCell[]; r: number; c: number }[] {
  const out: { cells: PieceCell[]; r: number; c: number }[] = [];
  let shape = normalize(cells);
  for (let rot = 0; rot < 4; rot++) {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (fitsSolution(b, shape, r, c)) out.push({ cells: shape, r, c });
    shape = rotate(shape);
  }
  return out;
}

// --- cięcie na klocki ---

const inBoard = (r: number, c: number) => r >= 0 && r < 9 && c >= 0 && c < 9;
const around = (i: number) => NEIGHBORS.map(([dr, dc]) => [rowOf(i) + dr, colOf(i) + dc]).filter(([r, c]) => inBoard(r, c)).map(([r, c]) => idx(r, c));

/**
 * Dzieli zbiór pól na spójne kawałki o rozmiarze min..max. Zaczyna od pól z najmniejszą liczbą wolnych
 * sąsiadów i rośnie w stronę najciaśniejszych, żeby nie zostawiać samotnych dziur. Za małe resztki
 * dokleja do sąsiedniego kawałka, jeśli ten ma jeszcze miejsce.
 */
export function tile(cells: Iterable<number>, min: number, max: number, rng: Rng): number[][] {
  const free = new Set(cells);
  const deg = (i: number) => around(i).filter((j) => free.has(j)).length;
  const pieces: number[][] = [];
  const owner = new Map<number, number[]>();
  while (free.size) {
    const list = [...free];
    const lo = Math.min(...list.map(deg));
    const seeds = list.filter((i) => deg(i) === lo);
    const start = seeds[Math.floor(rng() * seeds.length)];
    const target = min + Math.floor(rng() * (max - min + 1));
    const shape = [start];
    free.delete(start);
    while (shape.length < target) {
      const frontier = [...new Set(shape.flatMap(around))].filter((j) => free.has(j));
      if (!frontier.length) break;
      const best = Math.min(...frontier.map(deg));
      const pick = frontier.filter((j) => deg(j) <= best + (rng() < 0.3 ? 1 : 0));
      const next = pick[Math.floor(rng() * pick.length)];
      shape.push(next);
      free.delete(next);
    }
    if (shape.length < min) {
      const host = [...new Set(shape.flatMap(around))].map((j) => owner.get(j)).find((p) => p && p.length + shape.length <= max);
      if (host) { host.push(...shape); shape.forEach((i) => owner.set(i, host)); continue; }
    }
    pieces.push(shape);
    shape.forEach((i) => owner.set(i, shape));
  }
  return pieces;
}

/**
 * Plansza dla Tetroku: dzielimy całe rozwiązanie na klocki i zdejmujemy je całymi kawałkami, pilnując
 * jednoznaczności. Dzięki temu puste pola składają się w porządne klocki, a nie w same pojedyncze dziurki.
 */
export function carvePieces(solution: Grid, lv: Level, rng: Rng): { puzzle: Grid; plan: number[][] } {
  let best: { puzzle: Grid; plan: number[][]; clues: number } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const g = solution.slice();
    let clues = CELLS;
    const plan: number[][] = [];
    const owner = new Map<number, number[]>();
    const tryRemove = (chunk: number[], merge: boolean) => {
      if (clues - chunk.length < lv.clues) return;
      chunk.forEach((i) => (g[i] = 0));
      if (countSolutions(g, 2) !== 1) { chunk.forEach((i) => (g[i] = solution[i])); return; }
      clues -= chunk.length;
      // Drobne resztki doklejamy do sąsiedniego klocka, jeśli się zmieści.
      const host = merge ? [...new Set(chunk.flatMap(around))].map((j) => owner.get(j)).find((p) => p && p.length + chunk.length <= lv.maxSize) : undefined;
      const target = host ?? chunk;
      if (host) host.push(...chunk); else plan.push(chunk);
      chunk.forEach((i) => owner.set(i, target));
    };
    // Najpierw całe klocki, potem drobniejsze kawałki, żeby zejść do docelowej liczby cyfr.
    for (const piece of shuffle(tile([...Array(CELLS).keys()], lv.minSize, lv.maxSize, rng), rng)) tryRemove(piece, false);
    for (const size of [2, 1]) {
      if (clues <= lv.clues) break;
      const left = [...Array(CELLS).keys()].filter((i) => g[i]);
      for (const chunk of shuffle(tile(left, size, size, rng), rng)) { if (clues <= lv.clues) break; tryRemove(chunk, true); }
    }
    if (!best || clues < best.clues) best = { puzzle: g, plan, clues };
    if (clues <= lv.clues) break;
  }
  return { puzzle: best!.puzzle, plan: best!.plan };
}

// --- losowanie klocków ---

function reserved(t: TetrokuState, skip?: Piece): Set<number> {
  const s = new Set<number>();
  for (const p of [...t.queue, ...(t.hold ? [t.hold] : [])]) if (p !== skip) p.origin.forEach((i) => s.add(i));
  return s;
}

/**
 * Bierze kolejny klocek z planu cięcia. Jak plan się zdezaktualizował (ktoś położył klocek w innym
 * pasującym miejscu), tnie wolne pola od nowa.
 */
export function drawPiece(b: Board, t: TetrokuState, lv: Level, skip?: Piece): Piece | null {
  const rng = makeRng((b.seed ^ 0x9e3779b9) + t.draws * 7919);
  t.draws++;
  const taken = reserved(t, skip);
  const isFree = (i: number) => !b.values[i] && !taken.has(i);
  const free = [...Array(CELLS).keys()].filter(isFree);
  const planned = t.plan.flat();
  // Plan musi pokrywać dokładnie wolne pola: ani zajętych, ani osieroconych.
  if (planned.length !== free.length || !planned.every(isFree)) t.plan = tile(free, lv.minSize, lv.maxSize, rng);
  if (!t.plan.length) return null;
  const shape = t.plan.splice(Math.floor(rng() * t.plan.length), 1)[0];
  let cells = normalize(shape.map((i) => ({ r: rowOf(i), c: colOf(i), d: b.solution[i] })));
  // Losowy obrót, żeby kształt nie zdradzał od razu orientacji.
  for (let k = Math.floor(rng() * 4); k > 0; k--) cells = rotate(cells);
  return { id: t.nextId++, cells, origin: shape.sort((a, z) => a - z) };
}

/** Dopełnia kolejkę do `visible` i wymienia klocki, które po ostatnim ruchu nie mają już gdzie wejść. */
export function refill(b: Board, t: TetrokuState) {
  const lv = levelOf(t.level);
  const dead = (p: Piece) => p.origin.some((i) => b.values[i]) && !findFits(b, p.cells).length;
  for (let k = 0; k < t.queue.length; k++) {
    if (!dead(t.queue[k])) continue;
    const fresh = drawPiece(b, t, lv, t.queue[k]);
    if (fresh) t.queue[k] = fresh; else t.queue.splice(k--, 1);
  }
  if (t.hold && dead(t.hold)) t.hold = drawPiece(b, t, lv, t.hold);
  // Pola wycięte dla klocka, który nadal pasuje gdzie indziej, mogły zostać zajęte: przepinamy origin.
  for (const p of [...t.queue, ...(t.hold ? [t.hold] : [])]) {
    if (p.origin.some((i) => b.values[i])) {
      const fit = findFits(b, p.cells)[0];
      p.origin = footprint(fit.cells, fit.r, fit.c)!;
    }
  }
  while (t.queue.length < lv.visible) {
    const p = drawPiece(b, t, lv);
    if (!p) break;
    t.queue.push(p);
  }
}

export function createTetroku(b: Board, levelId: string, plan: number[][] = []): TetrokuState {
  const lv = levelOf(levelId);
  const t: TetrokuState = {
    level: lv.id, queue: [], hold: null, holdUsed: false, score: 0, streak: 0, bestCombo: 0,
    placed: 0, fallLeftMs: lv.fallMs ?? 0, draws: 0, nextId: 1, plan,
  };
  refill(b, t);
  return t;
}

// --- ruchy ---

export const multiplier = (streak: number) => (streak >= 6 ? 2 : streak >= 3 ? 1.5 : 1);

/** Pasek opadania kurczy się o 1% z każdym położonym klockiem, do 60% wartości wyjściowej. */
export const fallTotal = (t: TetrokuState) => {
  const base = levelOf(t.level).fallMs;
  return base === null ? null : Math.round(base * Math.max(0.6, 1 - 0.01 * t.placed));
};

export type PlaceResult =
  | { kind: 'invalid' } // poza planszą albo na zajętym polu – klocek po prostu wraca
  | { kind: 'wrong'; cells: number[] }
  | { kind: 'ok'; cells: number[]; units: number[]; gained: number; won: boolean };

/** Kładzie klocek (z kolejki albo schowka) w danym obrocie i miejscu. */
export function place(b: Board, piece: Piece, cells: PieceCell[], r: number, c: number): PlaceResult {
  const t = b.tetroku!;
  const f = footprint(cells, r, c);
  if (!f || f.some((i) => b.values[i])) return { kind: 'invalid' };
  if (!f.every((i, k) => b.solution[i] === cells[k].d)) {
    b.mistakes++;
    t.streak = 0;
    return { kind: 'wrong', cells: f };
  }
  f.forEach((i, k) => { b.values[i] = cells[k].d; b.notes[i] = 0; });
  // Wpisane cyfry czyszczą notatki sąsiadów.
  f.forEach((i) => PEERS[i].forEach((p) => { b.notes[p] &= ~(1 << b.values[i]); }));
  const touched = new Set<number>();
  f.forEach((i) => UNITS_OF[i].forEach((u) => touched.add(u)));
  const units = [...touched].filter((u) => UNITS[u].every((j) => b.values[j]));
  t.streak++;
  const mult = multiplier(t.streak);
  const gained = Math.round((f.length * 10 + 100 * units.length * units.length) * mult);
  t.score += gained;
  t.bestCombo = Math.max(t.bestCombo, units.length);
  t.placed++;
  t.holdUsed = false;
  removePiece(t, piece);
  refill(b, t);
  t.fallLeftMs = fallTotal(t) ?? 0;
  const won = b.values.every(Boolean);
  if (won) t.score += 500 * Math.max(0, 3 - b.mistakes);
  return { kind: 'ok', cells: f, units, gained, won };
}

function removePiece(t: TetrokuState, piece: Piece) {
  if (t.hold?.id === piece.id) t.hold = null;
  else t.queue = t.queue.filter((p) => p.id !== piece.id);
}

/** Zapisuje obrót klocka (żeby po odświeżeniu leżał tak, jak go zostawiłeś). */
export function setCells(t: TetrokuState, pieceId: number, cells: PieceCell[]) {
  const p = t.queue.find((q) => q.id === pieceId) ?? (t.hold?.id === pieceId ? t.hold : null);
  if (p) p.cells = cells;
}

/** Schowek: klocek z kolejki idzie do schowka, a stary ze schowka wraca na jego miejsce. */
export function swapHold(b: Board, pieceId: number): boolean {
  const t = b.tetroku!;
  if (!levelOf(t.level).hold || t.holdUsed) return false;
  const k = t.queue.findIndex((p) => p.id === pieceId);
  if (k < 0) return false;
  const old = t.hold;
  t.hold = t.queue[k];
  if (old) t.queue[k] = old; else { t.queue.splice(k, 1); refill(b, t); }
  t.holdUsed = true;
  return true;
}

/** Upływ czasu. Zwraca klocek, który właśnie spadł (przepadł i zabrał życie), albo null. */
export function tick(b: Board, dt: number): Piece | null {
  const t = b.tetroku!;
  const total = fallTotal(t);
  if (total === null || !t.queue.length) return null;
  t.fallLeftMs -= dt;
  if (t.fallLeftMs > 0) return null;
  const fallen = t.queue.shift()!;
  b.mistakes++;
  t.streak = 0;
  refill(b, t);
  t.fallLeftMs = total;
  return fallen;
}

/** Podpowiedź: gdzie pasuje klocek. Kosztuje serię. */
export function hintFor(b: Board, piece: Piece, limit: number) {
  if (b.hints >= limit) return null;
  const fit = findFits(b, piece.cells)[0] ?? null;
  if (fit) { b.hints++; b.tetroku!.streak = 0; }
  return fit;
}

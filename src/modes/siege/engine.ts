import { ALL_DIGITS, CELLS, Grid, PEERS, UNITS, bit, boxOf, popcount } from '../../core/board';
import { makeRng } from '../../core/rng';

/**
 * Oblężenie: sudoku + tower defense. 9 kwadratów 3x3 to 9 zamków z murami.
 * Wrogowie szturmują konkretne kwadraty: każdy ma pasek szturmu i jak dobiegnie do końca, mur traci tyle punktów,
 * ile potwór miał żyć (twardsze ładują za to dłużej).
 * Bronisz kwadratu, wpisując w nim dobre cyfry: każda to strzał w najbliższego szturmującego.
 * Pełny wiersz/kolumna to laser przez trzy kwadraty, pełny kwadrat to twierdza (szturmy na niego giną).
 * Zła cyfra rani własny mur. Zamek z zerowym murem pada: jego puste pola zamieniają się w ruiny.
 * Trzy upadłe zamki = przegrana. Wygrana = cała plansza.
 */

export interface SiegeLevel {
  id: string;
  puzzle: 'easy' | 'medium' | 'hard';
  chargeMs: number; // ile trwa szturm jednego wroga
  spawnMs: number; // co ile przychodzi nowy wróg (na starcie; potem szybciej)
  maxHp: number; // najtwardszy wróg
  wall: number; // mur każdego zamku
  maxFoes: number; // ilu wrogów naraz na planszy
}

export const LEVELS: SiegeLevel[] = [
  { id: 's1', puzzle: 'easy', chargeMs: 42000, spawnMs: 17000, maxHp: 1, wall: 3, maxFoes: 3 },
  { id: 's2', puzzle: 'medium', chargeMs: 36000, spawnMs: 14000, maxHp: 2, wall: 3, maxFoes: 4 },
  { id: 's3', puzzle: 'hard', chargeMs: 32000, spawnMs: 12000, maxHp: 2, wall: 3, maxFoes: 5 },
  { id: 's4', puzzle: 'hard', chargeMs: 26000, spawnMs: 9500, maxHp: 3, wall: 2, maxFoes: 6 },
];

export const levelOf = (id: string) => LEVELS.find((l) => l.id === id) ?? LEVELS[1];

/** Ile zamków może paść, zanim przegrasz (trzeci upadek kończy grę). */
export const FALLS_TO_LOSE = 3;
/** Co tylu wrogów zaczyna się nowa fala (i tempo rośnie). */
export const WAVE_SIZE = 4;
const FIRST_SPAWN_MS = 5000;

export interface Foe {
  id: number;
  box: number;
  hp: number;
  maxHp: number;
  chargeMs: number;
  leftMs: number;
}

export interface SiegeState {
  level: string;
  walls: number[]; // mur każdego kwadratu
  fallen: number[]; // upadłe kwadraty
  ruins: number[]; // pola wypełnione przez upadek (szare)
  foes: Foe[];
  spawnLeftMs: number;
  spawned: number;
  killed: number;
  nextId: number;
  draws: number; // licznik losowań (deterministyczny RNG: seed + draws)
}

/** Minimalny kawałek SavedGame, którego potrzebuje silnik. */
export interface Board {
  seed: number;
  values: Grid;
  solution: Grid;
  notes: number[];
  status: 'playing' | 'won' | 'lost';
  unlimited: boolean;
  siege?: SiegeState;
}

export const BOX_CELLS: number[][] = UNITS.slice(18);

export function createSiege(level: string): SiegeState {
  const lv = levelOf(level);
  return {
    level: lv.id, walls: new Array(9).fill(lv.wall), fallen: [], ruins: [], foes: [],
    spawnLeftMs: FIRST_SPAWN_MS, spawned: 0, killed: 0, nextId: 1, draws: 0,
  };
}

export const waveOf = (s: SiegeState) => Math.floor(Math.max(0, s.spawned - 1) / WAVE_SIZE) + 1;
const done = (b: Board, i: number) => b.values[i] === b.solution[i];
export const boxComplete = (b: Board, box: number) => BOX_CELLS[box].every((i) => done(b, i));
const attackable = (b: Board, box: number) => !b.siege!.fallen.includes(box) && !boxComplete(b, box);

/** Kwadraty, w których gracz ma teraz prosty logiczny ruch (pojedynczy albo ukryty kandydat). */
export function boxesWithMove(b: Board): Set<number> {
  const grid = b.values.map((v, i) => (v === b.solution[i] ? v : 0));
  const cand = grid.map((v, i) => {
    if (v) return 0;
    let used = 0;
    for (const p of PEERS[i]) if (grid[p]) used |= bit(grid[p]);
    return ALL_DIGITS & ~used;
  });
  const out = new Set<number>();
  for (let i = 0; i < CELLS; i++) if (!grid[i] && popcount(cand[i]) === 1) out.add(boxOf(i));
  for (const unit of UNITS) for (let d = 1; d <= 9; d++) {
    const spots = unit.filter((i) => !grid[i] && cand[i] & bit(d));
    if (spots.length === 1) out.add(boxOf(spots[0]));
  }
  return out;
}

/**
 * Wybór celu szturmu. Żeby nie było zgadywania, wróg idzie przede wszystkim tam,
 * gdzie da się teraz coś logicznie wpisać, i woli kwadraty, których nikt jeszcze nie szturmuje.
 */
export function pickTarget(b: Board, rnd: () => number): number | null {
  const s = b.siege!;
  const open = [...Array(9).keys()].filter((x) => attackable(b, x));
  if (!open.length) return null;
  const moves = boxesWithMove(b);
  const busy = new Map<number, number>();
  for (const f of s.foes) busy.set(f.box, (busy.get(f.box) ?? 0) + 1);
  const weights = open.map((x) => (moves.has(x) ? 6 : 1) / (1 + 2 * (busy.get(x) ?? 0)));
  let r = rnd() * weights.reduce((a, w) => a + w, 0);
  for (let k = 0; k < open.length; k++) { r -= weights[k]; if (r <= 0) return open[k]; }
  return open[open.length - 1];
}

export type SiegeEvent =
  | { type: 'spawn'; foe: Foe; wave: number; newWave: boolean }
  | { type: 'strike'; foe: Foe; box: number; wall: number; damage: number }
  | { type: 'fall'; box: number; cells: number[] }
  | { type: 'lost' };

const rngFor = (b: Board) => makeRng((b.seed ^ 0x51e6e) + b.siege!.draws++ * 7919);

/** Ile potwór zbija murowi: tyle, ile miał żyć na starcie. */
export const strikeDamage = (f: Foe) => f.maxHp;
/** Twardszy potwór ładuje szturm dłużej: +50% za każde życie ponad jedno. */
export const chargeFactor = (hp: number) => 1 + (hp - 1) * 0.5;

/** Wyrok muru: odejmij punkty, a przy zerze zamek pada. */
function damageWall(b: Board, box: number, foe: Foe | null, out: SiegeEvent[]) {
  const s = b.siege!;
  if (s.fallen.includes(box)) return;
  const damage = foe ? strikeDamage(foe) : 1;
  s.walls[box] = Math.max(0, s.walls[box] - damage);
  if (foe) out.push({ type: 'strike', foe, box, wall: s.walls[box], damage });
  if (s.walls[box] > 0) return;
  // Upadek: puste i błędne pola dostają cyfry z rozwiązania jako ruiny, szturmujący ten kwadrat odchodzą.
  s.fallen.push(box);
  const cells = BOX_CELLS[box].filter((i) => !done(b, i));
  for (const i of cells) { b.values[i] = b.solution[i]; b.notes[i] = 0; }
  for (const i of cells) for (const p of PEERS[i]) b.notes[p] &= ~bit(b.solution[i]);
  s.ruins.push(...cells);
  s.foes = s.foes.filter((f) => f.box !== box);
  out.push({ type: 'fall', box, cells });
  if (s.fallen.length >= FALLS_TO_LOSE && !b.unlimited) {
    b.status = 'lost';
    out.push({ type: 'lost' });
  }
}

/** Upływ czasu: szturmy idą do przodu, przychodzą nowi wrogowie. */
export function tick(b: Board, dt: number): SiegeEvent[] {
  const s = b.siege!;
  const out: SiegeEvent[] = [];
  if (b.status !== 'playing') return out;
  // Po „graj dalej bez limitu” wrogowie się wycofują, zostaje dokończyć planszę.
  if (b.unlimited) { s.foes = []; return out; }
  for (const f of [...s.foes]) {
    f.leftMs -= dt;
    if (f.leftMs > 0) continue;
    s.foes = s.foes.filter((x) => x !== f);
    damageWall(b, f.box, f, out);
    if (b.status !== 'playing') return out;
  }
  const lv = levelOf(s.level);
  s.spawnLeftMs -= dt;
  if (s.spawnLeftMs > 0) return out;
  if (s.foes.length >= lv.maxFoes) { s.spawnLeftMs = 1000; return out; }
  const rnd = rngFor(b);
  const box = pickTarget(b, rnd);
  if (box === null) { s.spawnLeftMs = 1000; return out; }
  const before = waveOf(s);
  s.spawned++;
  const wave = waveOf(s);
  // Z każdą falą szybciej (do 55% startowego tempa) i coraz częściej twardsi wrogowie.
  const pace = Math.max(0.55, 1 - (wave - 1) * 0.07);
  s.spawnLeftMs = lv.spawnMs * pace;
  const hpRoll = rnd() + (wave - 1) * 0.12;
  const hp = Math.min(lv.maxHp, 1 + Math.floor(hpRoll * lv.maxHp * 0.75));
  const chargeMs = Math.round(lv.chargeMs * (0.9 + 0.2 * rnd()) * chargeFactor(hp));
  const foe: Foe = { id: s.nextId++, box, hp, maxHp: hp, chargeMs, leftMs: chargeMs };
  s.foes.push(foe);
  out.push({ type: 'spawn', foe, wave, newWave: wave !== before && s.spawned > 1 });
  return out;
}

export type ShotEvent =
  | { type: 'shot'; from: number; foe: Foe; killed: boolean }
  | { type: 'laser'; unit: number; foes: Foe[] }
  | { type: 'fortress'; box: number; foes: Foe[] }
  | { type: 'backfire'; from: number; box: number };

const kill = (s: SiegeState, f: Foe) => { s.foes = s.foes.filter((x) => x !== f); s.killed++; };

/**
 * Ruch gracza w polu i. Dobra cyfra strzela w najbliższego szturmującego ten kwadrat,
 * ukończone jednostki strzelają laserem. Zła cyfra rani własny mur.
 */
export function onMove(b: Board, i: number, correct: boolean, completedUnits: number[] = []): { shots: ShotEvent[]; events: SiegeEvent[] } {
  const s = b.siege!;
  const shots: ShotEvent[] = [];
  const events: SiegeEvent[] = [];
  const box = boxOf(i);
  if (!correct) {
    if (!s.fallen.includes(box)) {
      shots.push({ type: 'backfire', from: i, box });
      if (!b.unlimited) damageWall(b, box, null, events);
    }
    return { shots, events };
  }
  const target = s.foes.filter((f) => f.box === box).sort((a, c) => a.leftMs - c.leftMs)[0];
  if (target) {
    target.hp--;
    if (target.hp <= 0) kill(s, target);
    shots.push({ type: 'shot', from: i, foe: target, killed: target.hp <= 0 });
  }
  for (const u of completedUnits) {
    if (u >= 18) {
      const foes = s.foes.filter((f) => f.box === u - 18);
      foes.forEach((f) => kill(s, f));
      s.walls[u - 18] = Math.max(s.walls[u - 18], levelOf(s.level).wall);
      shots.push({ type: 'fortress', box: u - 18, foes });
      continue;
    }
    const boxes = new Set(UNITS[u].map(boxOf));
    const foes = s.foes.filter((f) => boxes.has(f.box));
    foes.forEach((f) => kill(s, f));
    shots.push({ type: 'laser', unit: u, foes });
  }
  return { shots, events };
}

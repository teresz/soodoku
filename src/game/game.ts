import { CELLS, Grid, PEERS, UNITS, UNITS_OF, bit } from '../core/board';
import { findEasyMove } from '../core/logic';
import { getMode } from '../modes';
import { deduce } from '../modes/saperdoku/engine';
import type { SaperState } from '../modes/saperdoku/engine';
import type { TetrokuState } from '../modes/tetroku/engine';
import type { SiegeState } from '../modes/siege/engine';
import type { DailyTag } from '../daily/daily';

export type Status = 'playing' | 'won' | 'lost';

/** Ile podpowiedzi przypada na jedną grę (we wszystkich trybach). */
export const HINT_LIMIT = 3;

export interface SavedGame {
  v: 1;
  modeId: string;
  difficulty: string;
  seed: number;
  puzzle: Grid;
  solution: Grid;
  values: Grid;
  notes: number[]; // maski bitowe notatek
  mistakes: number;
  hints: number;
  elapsedMs: number;
  status: Status;
  unlimited: boolean; // gracz wybrał „graj dalej” po przekroczeniu limitu błędów
  tetroku?: TetrokuState; // tylko w trybie Tetroku: kolejka, schowek, punkty
  saper?: SaperState; // tylko w Saperdoku: miny i flagi
  siege?: SiegeState; // tylko w Oblężeniu: mury, wrogowie, ruiny
  daily?: DailyTag; // wyzwanie dnia: z którego dnia i jaki haczyk
}

export interface MoveResult {
  changed: boolean;
  wrong?: boolean;
  completedUnits?: number[];
  won?: boolean;
  lost?: boolean;
  boom?: boolean; // Saperdoku: cyfra wpisana w minę
}

interface Snapshot { values: Grid; notes: number[] }

export interface GameOptions {
  checkMistakes: boolean; // false = brak liczenia błędów i limitu
  autoClearNotes: boolean;
}

export class Game {
  state: SavedGame;
  options: GameOptions = { checkMistakes: true, autoClearNotes: true };
  private history: Snapshot[] = [];

  constructor(state: SavedGame) {
    this.state = state;
  }

  static create(modeId: string, difficulty: string, seed: number): Game {
    const mode = getMode(modeId);
    const p = mode.createPuzzle(difficulty, seed);
    const state: SavedGame = {
      v: 1, modeId: mode.id, difficulty, seed,
      puzzle: p.puzzle, solution: p.solution, values: p.puzzle.slice(),
      notes: new Array(CELLS).fill(0), mistakes: 0, hints: 0, elapsedMs: 0,
      status: 'playing', unlimited: false,
    };
    mode.setup?.(state);
    return new Game(state);
  }

  /** Pusta gra-zaślepka, zanim gracz wybierze tryb w menu. */
  static blank(): SavedGame {
    return {
      v: 1, modeId: 'classic', difficulty: 'medium', seed: 0, puzzle: new Array(CELLS).fill(0), solution: new Array(CELLS).fill(0),
      values: new Array(CELLS).fill(0), notes: new Array(CELLS).fill(0), mistakes: 0, hints: 0, elapsedMs: 0, status: 'won', unlimited: false,
    };
  }

  get mode() { return getMode(this.state.modeId); }
  /** Haczyk wyzwania dnia: „jeden błąd” liczy błędy nawet z wyłączonym sprawdzaniem. */
  private get strict() { return this.state.daily?.mod === 'strict' && this.mode.mistakeLimit !== null; }
  private get checking() { return this.options.checkMistakes || this.strict; }
  /** Limit trybu po haczykach, bez patrzenia na ustawienia (Saperdoku liczy wybuchy zawsze). */
  private get baseLimit() { return this.state.unlimited ? null : this.strict ? 1 : this.mode.mistakeLimit; }
  get mistakeLimit() { return this.checking ? this.baseLimit : null; }
  get hintsLeft() { return this.state.daily?.mod === 'noHints' ? 0 : Math.max(0, HINT_LIMIT - this.state.hints); }
  get notesAllowed() { return this.state.daily?.mod !== 'noNotes'; }
  get canUndo() { return this.history.length > 0 && !this.state.tetroku && !this.state.siege; }

  /** Pole startowe (albo ruina w Oblężeniu): nie da się go zmienić. */
  isGiven(i: number) { return this.state.puzzle[i] !== 0 || !!this.state.siege?.ruins.includes(i); }
  isMine(i: number) { return !!this.state.saper?.mines.includes(i); }
  isFlagged(i: number) { return !!this.state.saper?.flags.includes(i); }
  /** Pole „gotowe”: poprawna cyfra albo oflagowana mina. */
  isDone(i: number) { return this.isMine(i) ? this.isFlagged(i) : this.state.values[i] === this.state.solution[i]; }
  isWrong(i: number) { const v = this.state.values[i]; return v !== 0 && v !== this.state.solution[i]; }

  /** Ile razy każda cyfra stoi poprawnie na planszy (do licznika na klawiaturze). */
  digitCounts(): number[] {
    const counts = new Array(10).fill(0);
    this.state.values.forEach((v, i) => { if (v && v === this.state.solution[i]) counts[v]++; });
    return counts;
  }

  private snapshot() {
    this.history.push({ values: this.state.values.slice(), notes: this.state.notes.slice() });
    if (this.history.length > 300) this.history.shift();
  }

  private get playable() { return this.state.status === 'playing'; }

  toggleNote(i: number, d: number): MoveResult {
    if (!this.playable || !this.notesAllowed || this.isGiven(i) || this.state.values[i]) return { changed: false };
    this.snapshot();
    this.state.notes[i] ^= bit(d);
    return { changed: true };
  }

  place(i: number, d: number): MoveResult {
    const s = this.state;
    if (!this.playable || this.isGiven(i) || s.values[i] === d || this.isFlagged(i)) return { changed: false };
    if (s.saper && this.isMine(i)) return this.boom(i);
    this.snapshot();
    s.values[i] = d;
    s.notes[i] = 0;
    if (d !== s.solution[i]) {
      if (!this.checking) return { changed: true };
      s.mistakes++;
      const limit = this.mistakeLimit;
      if (limit !== null && s.mistakes >= limit) { s.status = 'lost'; return { changed: true, wrong: true, lost: true }; }
      return { changed: true, wrong: true };
    }
    if (this.options.autoClearNotes) for (const p of PEERS[i]) s.notes[p] &= ~bit(d);
    return this.afterCorrect(i);
  }

  /** Saperdoku: cyfra w minie. Wybuch zawsze liczy się jako błąd, a mina zostaje odsłonięta (oflagowana). */
  private boom(i: number): MoveResult {
    const s = this.state, sp = s.saper!;
    sp.flags.push(i);
    sp.exploded.push(i);
    s.notes[i] = 0;
    s.mistakes++;
    const limit = this.baseLimit;
    if (limit !== null && s.mistakes >= limit) { s.status = 'lost'; return { changed: true, wrong: true, boom: true, lost: true }; }
    return { ...this.afterCorrect(i), wrong: true, boom: true };
  }

  /** Saperdoku: flaga na polu. Na minie zostaje na stałe, na zwykłym polu to błąd i flaga nie zostaje. */
  flag(i: number): MoveResult {
    const s = this.state, sp = s.saper;
    if (!sp || !this.playable || this.isGiven(i) || this.isFlagged(i) || s.values[i] === s.solution[i]) return { changed: false };
    if (!this.isMine(i)) {
      s.mistakes++;
      const limit = this.baseLimit;
      if (limit !== null && s.mistakes >= limit) { s.status = 'lost'; return { changed: true, wrong: true, lost: true }; }
      return { changed: true, wrong: true };
    }
    sp.flags.push(i);
    s.values[i] = 0;
    s.notes[i] = 0;
    return this.afterCorrect(i);
  }

  private afterCorrect(i: number): MoveResult {
    const s = this.state;
    const completedUnits = UNITS_OF[i].filter((u) => UNITS[u].every((j) => this.isDone(j)));
    const won = s.values.every((_, j) => this.isDone(j));
    if (won) s.status = 'won';
    return { changed: true, completedUnits, won };
  }

  erase(i: number): MoveResult {
    const s = this.state;
    if (!this.playable || this.isGiven(i) || (!s.values[i] && !s.notes[i])) return { changed: false };
    if (s.tetroku && s.values[i]) return { changed: false }; // położonych klocków się nie zmazuje
    this.snapshot();
    s.values[i] = 0;
    s.notes[i] = 0;
    return { changed: true };
  }

  undo(): boolean {
    if (this.state.tetroku || this.state.siege) return false; // cofanie rozwaliłoby kolejkę klocków / wystrzelone strzały
    const snap = this.history.pop();
    if (!snap || !this.playable) return false;
    this.state.values = snap.values;
    this.state.notes = snap.notes;
    return true;
  }

  /** Podpowiedź: zaznaczona komórka, jeśli jest pusta lub błędna; inaczej najprostszy możliwy ruch. */
  hint(selected: number | null): { index: number; result: MoveResult } | null {
    const s = this.state;
    if (!this.playable) return null;
    if (this.hintsLeft === 0) return null;
    let target = -1;
    if (selected !== null && !this.isGiven(selected) && !this.isDone(selected)) target = selected;
    if (target < 0 && s.saper) target = saperHint(this);
    if (target < 0) {
      const correctOnly = s.values.map((v, j) => (v === s.solution[j] ? v : 0));
      target = findEasyMove(correctOnly)?.index ?? s.values.findIndex((v, j) => v !== s.solution[j]);
    }
    if (target < 0) return null;
    if (this.isMine(target)) {
      s.hints++;
      s.saper!.flags.push(target);
      s.notes[target] = 0;
      return { index: target, result: this.afterCorrect(target) };
    }
    this.snapshot();
    s.hints++;
    const d = s.solution[target];
    s.values[target] = d;
    s.notes[target] = 0;
    if (this.options.autoClearNotes) for (const p of PEERS[target]) s.notes[p] &= ~bit(d);
    return { index: target, result: this.afterCorrect(target) };
  }

  /** Gracz się poddaje: gra przegrana, na planszy ląduje rozwiązanie. */
  resign(): boolean {
    const s = this.state;
    if (s.status !== 'playing') return false;
    s.status = 'lost';
    s.values = s.solution.map((v, i) => (this.isMine(i) ? 0 : v));
    if (s.saper) s.saper.flags = s.saper.mines.slice();
    s.notes = new Array(CELLS).fill(0);
    this.history = [];
    return true;
  }

  /** Po przegranej: kasujemy limit i gramy dalej. */
  continueAfterLoss() {
    if (this.state.status !== 'lost') return;
    this.state.unlimited = true;
    this.state.status = 'playing';
  }
}

/** Podpowiedź w Saperdoku: pole, o którym gracz już może wiedzieć (bezpieczne albo mina) z liczników. */
function saperHint(game: Game): number {
  const s = game.state, sp = s.saper!;
  const mines = new Set(sp.mines);
  const k = {
    safe: s.values.map((v, i) => s.puzzle[i] !== 0 || (v !== 0 && v === s.solution[i])),
    mine: s.values.map((_, i) => sp.flags.includes(i)),
  };
  const ds = deduce(s.solution, mines, k, sp.showList);
  return ds.length ? ds[0].index : -1;
}

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { LEVELS, createSaper, solvable } from '../src/modes/saperdoku/engine';

describe('Saperdoku', () => {
  it('generuje plansze do przejścia bez zgadywania na każdym poziomie', () => {
    for (const l of LEVELS) {
      const { puzzle, solution, mines } = createSaper(l.id, 42);
      expect(puzzle.filter(Boolean).length).toBe(l.clues);
      expect(mines.length).toBe(l.mines);
      expect(mines.every((i) => !puzzle[i])).toBe(true);
      expect(solvable(puzzle, solution, new Set(mines), l.showList)).toBe(true);
    }
  });

  it('cyfra w minie wybucha, flaga na zwykłym polu to błąd, wygrana po flagach i cyfrach', () => {
    const g = Game.create('minesweeper', 'm1', 7);
    const s = g.state, sp = s.saper!;
    const mine = sp.mines[0];
    const r = g.place(mine, s.solution[mine]);
    expect(r.boom).toBe(true);
    expect(s.mistakes).toBe(1);
    expect(g.isFlagged(mine)).toBe(true);
    const safe = s.puzzle.findIndex((v, i) => !v && !sp.mines.includes(i));
    expect(g.flag(safe).wrong).toBe(true);
    expect(g.isFlagged(safe)).toBe(false);
    for (const i of sp.mines) g.flag(i);
    let last;
    for (let i = 0; i < 81; i++) if (!s.puzzle[i] && !sp.mines.includes(i)) last = g.place(i, s.solution[i]);
    expect(last?.won).toBe(true);
    expect(s.status).toBe('won');
  });

  it('podpowiedź flaguje albo wpisuje pole, które da się wydedukować', () => {
    const g = Game.create('minesweeper', 'm3', 11);
    const h = g.hint(null)!;
    expect(h).not.toBeNull();
    expect(g.isDone(h.index)).toBe(true);
  });
});

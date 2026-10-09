import { describe, expect, it } from 'vitest';
import { Game, HINT_LIMIT } from '../src/game/game';
import { LEVELS, findFits, hintFor, place, rotate, swapHold, tick } from '../src/modes/tetroku/engine';

describe('tetroku', () => {
  it('obrót czterokrotny wraca do punktu wyjścia', () => {
    const cells = [{ r: 0, c: 0, d: 1 }, { r: 0, c: 1, d: 2 }, { r: 0, c: 2, d: 3 }, { r: 1, c: 0, d: 4 }];
    expect(rotate(rotate(rotate(rotate(cells))))).toEqual(cells);
    expect(rotate(cells)).not.toEqual(cells);
  });

  for (const lv of LEVELS) {
    it(`da się ułożyć całą planszę: ${lv.label}`, () => {
      const g = Game.create('tetris', lv.id, 777 + lv.clues).state;
      const t = g.tetroku!;
      expect(g.values.filter(Boolean).length).toBeLessThanOrEqual(lv.clues + 2);
      let moves = 0;
      while (!g.values.every(Boolean)) {
        expect(t.queue.length + (t.hold ? 1 : 0)).toBeGreaterThan(0);
        expect(t.queue.length).toBeLessThanOrEqual(lv.visible);
        // Każdy klocek w grze musi gdzieś pasować i mieć rozmiar z drabinki (mniejszy tylko z braku miejsca).
        for (const p of [...t.queue, ...(t.hold ? [t.hold] : [])]) {
          expect(findFits(g, p.cells).length).toBeGreaterThan(0);
          expect(p.cells.length).toBeLessThanOrEqual(lv.maxSize);
        }
        if (lv.hold && moves % 5 === 1 && t.queue.length) swapHold(g, t.queue[0].id);
        const piece = t.queue[0] ?? t.hold!;
        const fit = findFits(g, piece.cells)[0];
        const r = place(g, piece, fit.cells, fit.r, fit.c);
        expect(r.kind).toBe('ok');
        if (++moves > 200) throw new Error('za dużo ruchów');
      }
      expect(g.mistakes).toBe(0);
      expect(t.score).toBeGreaterThan(0);
    });
  }

  it('zły klocek kosztuje życie i nie zmienia planszy', () => {
    const g = Game.create('tetris', 't30', 4242).state;
    const piece = g.tetroku!.queue[0];
    const before = g.values.slice();
    const empty = g.values.findIndex((v, i) => !v && g.solution[i] !== piece.cells[0].d);
    const wrong = [{ r: 0, c: 0, d: piece.cells[0].d }];
    const r = place(g, piece, wrong, Math.floor(empty / 9), empty % 9);
    expect(r.kind).toBe('wrong');
    expect(g.mistakes).toBe(1);
    expect(g.values).toEqual(before);
  });

  it('klocek spada po upływie paska', () => {
    const g = Game.create('tetris', 't23', 99).state;
    const first = g.tetroku!.queue[0].id;
    expect(tick(g, 1000)).toBeNull();
    expect(tick(g, 25000)?.id).toBe(first);
    expect(g.mistakes).toBe(1);
    expect(g.tetroku!.queue.length).toBe(1);
  });
});

describe('limit podpowiedzi', () => {
  it('daje najwyżej 3 podpowiedzi w Tetroku i w zwykłym sudoku', () => {
    const t = Game.create('tetris', 't30', 5).state;
    const used = [0, 1, 2, 3].map(() => hintFor(t, t.tetroku!.queue[0], HINT_LIMIT));
    expect(used.filter(Boolean).length).toBe(3);
    expect(t.hints).toBe(3);
    const g = Game.create('clues', 'c42', 5);
    expect([0, 1, 2, 3].map(() => g.hint(null)).filter(Boolean).length).toBe(3);
    expect(g.hintsLeft).toBe(0);
  });
});

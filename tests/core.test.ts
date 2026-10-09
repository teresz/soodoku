import { describe, expect, it } from 'vitest';
import { conflicts, fromString } from '../src/core/board';
import { DIFFICULTIES, generate, generateByClues } from '../src/core/generator';
import { Technique, rate } from '../src/core/logic';
import { countSolutions, solve } from '../src/core/solver';

const CLASSIC = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';

describe('solver', () => {
  it('rozwiązuje klasyczną planszę jednoznacznie', () => {
    const g = fromString(CLASSIC);
    expect(countSolutions(g)).toBe(1);
    const s = solve(g)!;
    expect(s.join('').slice(0, 9)).toBe('534678912');
    expect(conflicts(s).size).toBe(0);
  });
  it('wykrywa wiele rozwiązań', () => {
    expect(countSolutions(new Array(81).fill(0))).toBe(2);
  });
  it('ocenia łatwą planszę jako same pojedyncze', () => {
    expect(rate(fromString(CLASSIC)).hardest).toBeLessThanOrEqual(Technique.HiddenSingle);
  });
});

describe('generator', () => {
  for (const { id } of DIFFICULTIES) {
    it(`generuje jednoznaczną planszę: ${id}`, () => {
      const t = performance.now();
      const p = generate(id, 12345);
      const ms = performance.now() - t;
      const clues = p.puzzle.filter(Boolean).length;
      console.log(id, 'clues', clues, 'rating', rate(p.puzzle).hardest, Math.round(ms) + 'ms');
      expect(countSolutions(p.puzzle)).toBe(1);
      expect(p.puzzle.every((v, i) => !v || v === p.solution[i])).toBe(true);
    });
  }
  it('ten sam seed = ta sama plansza', () => {
    expect(generate('medium', 7).puzzle).toEqual(generate('medium', 7).puzzle);
  });
});

describe('generator wg liczby pól', () => {
  for (const clues of [50, 36, 26, 23]) {
    it(`daje dokładnie ${clues} cyfr i jedno rozwiązanie`, () => {
      const t = performance.now();
      const p = generateByClues(clues, 99);
      console.log('clues', clues, Math.round(performance.now() - t) + 'ms');
      expect(p.puzzle.filter(Boolean).length).toBe(clues);
      expect(countSolutions(p.puzzle)).toBe(1);
    });
  }
});

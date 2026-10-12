import { describe, expect, it } from 'vitest';
import { carveFree, fullGrid, generateImpossible, generateImpossibleClues, IMPOSSIBLE_CLUES } from '../src/core/generator';
import { rateDeep } from '../src/core/deep';
import { rate } from '../src/core/logic';
import { countSolutions } from '../src/core/solver';
import { makeRng } from '../src/core/rng';

describe('Niemożliwy', () => {
  it('mocny solver nie skreśla prawdziwych cyfr (zawsze dochodzi do jedynego rozwiązania)', () => {
    const rng = makeRng(2024);
    for (let k = 0; k < 40; k++) {
      const solution = fullGrid(rng);
      const r = rateDeep(carveFree(solution, 17, rng));
      if (r.solved) expect(r.grid).toEqual(solution);
      else expect(r.grid.every((v, i) => !v || v === solution[i])).toBe(true);
    }
  });

  it('Logika: plansza jednoznaczna, nie do zrobienia prostymi technikami, ale do zrobienia logiką', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = generateImpossible(seed);
      expect(countSolutions(p.puzzle, 2)).toBe(1);
      expect(p.puzzle.every((v, i) => !v || v === p.solution[i])).toBe(true);
      expect(rate(p.puzzle).solved).toBe(false);
      const r = rateDeep(p.puzzle);
      expect(r.solved).toBe(true);
      expect(r.forced).toBeGreaterThanOrEqual(3);
    }
  });

  it('Logika: ta sama plansza z tego samego seeda', () => {
    expect(generateImpossible(77).puzzle).toEqual(generateImpossible(77).puzzle);
  });

  it(`Standard: ${IMPOSSIBLE_CLUES} cyfry na start, jednoznaczna i do zrobienia logiką`, () => {
    for (const seed of [1, 2, 3]) {
      const p = generateImpossibleClues(seed);
      expect(p.puzzle.filter(Boolean).length).toBe(IMPOSSIBLE_CLUES);
      expect(countSolutions(p.puzzle, 2)).toBe(1);
      expect(rateDeep(p.puzzle).solved).toBe(true);
    }
  });
});

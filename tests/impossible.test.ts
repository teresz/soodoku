import { describe, expect, it } from 'vitest';
import { carveFree, fullGrid } from '../src/core/generator';
import { HARDEST, generateHardest } from '../src/core/hardest';
import { rateDeep } from '../src/core/deep';
import { conflicts, fromString } from '../src/core/board';
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

  it('każda plansza z banku ma jedno rozwiązanie i jest poza zasięgiem mocnego solvera', () => {
    for (const s of HARDEST) {
      const g = fromString(s);
      expect(s).toHaveLength(81);
      expect(countSolutions(g, 2)).toBe(1);
      expect(rateDeep(g).solved).toBe(false);
    }
  });

  it('przebrana plansza: jednoznaczna, dalej za trudna dla solvera, ta sama z tego samego seeda', () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const p = generateHardest(seed);
      expect(countSolutions(p.puzzle, 2)).toBe(1);
      expect(conflicts(p.solution).size).toBe(0);
      expect(p.puzzle.every((v, i) => !v || v === p.solution[i])).toBe(true);
      expect(rateDeep(p.puzzle).solved).toBe(false);
      expect(generateHardest(seed).puzzle).toEqual(p.puzzle);
    }
    expect(generateHardest(1).puzzle).not.toEqual(generateHardest(2).puzzle);
  });
});

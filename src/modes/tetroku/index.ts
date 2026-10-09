import { fullGrid } from '../../core/generator';
import { makeRng } from '../../core/rng';
import { t } from '../../i18n';
import { GameMode } from '../types';
import { LEVELS, carvePieces, createTetroku, levelOf } from './engine';

const LEVEL_NAMES = ['lvl.start', 'lvl.easy', 'lvl.medium', 'lvl.hard', 'lvl.expert', 'lvl.master'] as const;

// Plan cięcia z ostatniego createPuzzle; setup zabiera go do stanu gry.
let lastPlan: number[][] = [];

/** Tetroku: sudoku + tetris. Zamiast wpisywać cyfry, kładziesz klocki wycięte z rozwiązania. */
export const tetroku: GameMode = {
  id: 'tetris',
  get name() { return t('tetris.name'); },
  get tagline() { return t('tetris.tagline'); },
  get ladder() { return t('tetris.ladder'); },
  available: true,
  mistakeLimit: 3,
  get difficulties() {
    return LEVELS.map((l, k) => ({
      id: l.id,
      label: t(LEVEL_NAMES[k]),
      hint: t('tetris.hint', { n: l.clues, time: l.fallMs ? `${l.fallMs / 1000} s` : t('tetris.noTime') }),
    }));
  },
  createPuzzle: (difficulty, seed) => {
    const rng = makeRng(seed);
    const solution = fullGrid(rng);
    const { puzzle, plan } = carvePieces(solution, levelOf(difficulty), rng);
    lastPlan = plan;
    return { puzzle, solution, difficulty, seed };
  },
  setup: (state) => { state.tetroku = createTetroku(state, state.difficulty, lastPlan); lastPlan = []; },
};

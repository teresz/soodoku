import './saperdoku.css';
import { t } from '../../i18n';
import { GameMode } from '../types';
import { LEVELS, createSaper, levelOf } from './engine';
import { saperdokuRules } from './rules';

const LEVEL_NAMES = ['lvl.easy', 'lvl.medium', 'lvl.hard', 'lvl.expert', 'lvl.master'] as const;

// Miny z ostatniego createPuzzle; setup zabiera je do stanu gry (jak plan klocków w Tetroku).
let lastMines: number[] = [];

/** Saperdoku: sudoku + saper. Część pustych pól to miny, które trzeba oflagować zamiast wpisać. */
export const saperdoku: GameMode = {
  id: 'minesweeper',
  get name() { return t('minesweeper.name'); },
  get tagline() { return t('minesweeper.tagline'); },
  get ladder() { return t('minesweeper.ladder'); },
  available: true,
  mistakeLimit: 3,
  get difficulties() {
    return LEVELS.map((l, k) => ({
      id: l.id,
      label: t(LEVEL_NAMES[k]),
      hint: t(l.showList ? 'minesweeper.hint' : 'minesweeper.hintBlind', { n: l.clues, m: l.mines }),
    }));
  },
  createPuzzle: (difficulty, seed) => {
    const { puzzle, solution, mines } = createSaper(difficulty, seed);
    lastMines = mines;
    return { puzzle, solution, difficulty, seed };
  },
  rules: saperdokuRules,
  setup: (state) => {
    state.saper = { mines: lastMines, flags: [], exploded: [], showList: levelOf(state.difficulty).showList };
    lastMines = [];
  },
};

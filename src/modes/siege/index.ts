import './siege.css';
import { generate } from '../../core/generator';
import { t } from '../../i18n';
import { GameMode } from '../types';
import { LEVELS, createSiege, levelOf } from './engine';
import { siegeRules } from './rules';

const LEVEL_NAMES = ['lvl.easy', 'lvl.medium', 'lvl.hard', 'lvl.expert'] as const;

/** Oblężenie: sudoku + tower defense. Kwadraty to zamki, cyfry to strzały. */
export const siege: GameMode = {
  id: 'siege',
  get name() { return t('siege.name'); },
  get tagline() { return t('siege.tagline'); },
  get ladder() { return t('siege.ladder'); },
  available: true,
  mistakeLimit: null, // błędy kosztują mur, a nie osobny limit
  get difficulties() {
    return LEVELS.map((l, k) => ({
      id: l.id,
      label: t(LEVEL_NAMES[k]),
      hint: t('siege.hint', { s: Math.round(l.chargeMs / 1000), w: l.wall, puzzle: t(`siege.puzzle.${l.puzzle}`) }),
    }));
  },
  // Plansza z klasycznego generatora: rozwiązywalna samą logiką, bez zgadywania.
  createPuzzle: (difficulty, seed) => ({ ...generate(levelOf(difficulty).puzzle, seed), difficulty }),
  rules: siegeRules,
  setup: (state) => { state.siege = createSiege(state.difficulty); },
};

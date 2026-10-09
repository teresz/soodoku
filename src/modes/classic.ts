import { Difficulty, generate } from '../core/generator';
import { t } from '../i18n';
import { GameMode } from './types';

/** Klasyczne sudoku, trudność wg technik potrzebnych do rozwiązania. */
export const classic: GameMode = {
  id: 'classic',
  get name() { return t('classic.name'); },
  get tagline() { return t('classic.tagline'); },
  get ladder() { return t('classic.ladder'); },
  available: true,
  mistakeLimit: 3,
  get difficulties() {
    return (['easy', 'medium', 'hard', 'expert'] as const).map((id) => ({ id, label: t(`lvl.${id}`), hint: t(`classic.${id}`) }));
  },
  createPuzzle: (difficulty, seed) => generate(difficulty as Difficulty, seed),
};

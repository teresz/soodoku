import { IMPOSSIBLE_CLUES, generateByClues, generateImpossibleClues } from '../core/generator';
import { t } from '../i18n';
import { GameMode } from './types';

// Poziom = liczba cyfr wpisanych na start. Techniki nie mają znaczenia.
const LEVELS = [
  ['start', 50],
  ['easy', 42],
  ['medium', 36],
  ['hard', 30],
  ['expert', 26],
  ['master', 23],
] as const;

export const cluesMode: GameMode = {
  id: 'clues',
  get name() { return t('clues.name'); },
  get tagline() { return t('clues.tagline'); },
  get ladder() { return t('clues.ladder'); },
  available: true,
  mistakeLimit: 3,
  get difficulties() {
    return [
      ...LEVELS.map(([lvl, n]) => ({ id: `c${n}`, label: t(`lvl.${lvl}`), hint: t('lvl.digits', { n }) })),
      // Niemożliwy: najmniej cyfr i do tego plansza, której nie da się zrobić bez ciężkich technik.
      { id: 'impossible', label: t('lvl.impossible'), hint: t('lvl.digits', { n: IMPOSSIBLE_CLUES }) },
    ];
  },
  createPuzzle: (difficulty, seed) => (difficulty === 'impossible' ? generateImpossibleClues(seed) : generateByClues(Number(difficulty.slice(1)) || 36, seed)),
};

import { classic } from './classic';
import { cluesMode } from './clues';
import { saperdoku } from './saperdoku';
import { siege } from './siege';
import { sabotage } from './sabotage';
import { tetroku } from './tetroku';
import { tk } from '../i18n';
import { GameMode } from './types';

// Zapowiedzi kolejnych trybów: na razie tylko wizytówki w menu.
export const comingSoon = (id: string): GameMode => ({
  id,
  get name() { return tk(`${id}.name`); },
  get tagline() { return tk(`${id}.tagline`); },
  get ladder() { return tk('mode.soon'); },
  available: false, mistakeLimit: null, difficulties: [],
  createPuzzle: () => { throw new Error(`Tryb ${id} jeszcze nie istnieje`); },
});

export const MODES: GameMode[] = [
  classic,
  cluesMode,
  tetroku,
  saperdoku,
  siege,
  sabotage,
];

export const getMode = (id: string) => MODES.find((m) => m.id === id && m.available) ?? classic;
export const difficultyLabel = (modeId: string, diffId: string) =>
  getMode(modeId).difficulties.find((d) => d.id === diffId)?.label ?? diffId;
export type { GameMode };

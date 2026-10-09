// Notatka „Dlaczego to wyzwanie”: składana z tego, co w danym dniu jest wyjątkowe
// (dzień tygodnia, tryb i poziom, technika potrzebna do planszy, haczyk). Warianty tekstu wybiera liczba dnia.
import { rate } from '../core/logic';
import type { SavedGame } from '../game/game';
import { difficultyLabel } from '../modes';
import { tk } from '../i18n';
import type { Challenge } from './daily';

const ab = (n: number) => (n % 2 ? 'b' : 'a');

export function buildNote(ch: Challenge, s: SavedGame): string[] {
  const f = ch.flavor;
  const level = difficultyLabel(ch.modeId, ch.difficulty).toLowerCase();
  const clues = s.puzzle.filter(Boolean).length;
  return [
    tk(`daily.wd.${ch.weekday}.${ab(f)}`),
    tk(`daily.mode.${ch.modeId}.${ab(f >> 1)}`, { level, clues }),
    tk(`daily.tech.${rate(s.puzzle).hardest}`),
    tk(`daily.mod.${ch.mod}.${ab(f >> 2)}`),
  ];
}

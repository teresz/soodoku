// Notatka „Dlaczego to wyzwanie”: składana z tego, co w danym dniu jest wyjątkowe
// (dzień tygodnia, tryb i poziom, technika potrzebna do planszy, haczyk). Warianty tekstu wybiera liczba dnia.
import { rate } from '../core/logic';
import type { SavedGame } from '../game/game';
import { difficultyLabel } from '../modes';
import { levelOf as siegeLevel } from '../modes/siege/engine';
import { levelOf as tetLevel } from '../modes/tetroku/engine';
import { tk } from '../i18n';
import type { Challenge } from './daily';

const ab = (n: number) => (n % 2 ? 'b' : 'a');

export function buildNote(ch: Challenge, s: SavedGame): string[] {
  const f = ch.flavor;
  const level = difficultyLabel(ch.modeId, ch.difficulty).toLowerCase();
  const clues = s.puzzle.filter(Boolean).length;
  const vars: Record<string, string | number> = { level, clues };
  const out = [tk(`daily.wd.${ch.weekday}.${ab(f)}`)];

  if (ch.modeId === 'tetris') {
    const ms = tetLevel(ch.difficulty).fallMs;
    vars.fall = ms ? tk('daily.fall', { s: ms / 1000 }) : tk('daily.noFall');
  }
  if (ch.modeId === 'minesweeper') vars.mines = s.saper?.mines.length ?? 0;
  if (ch.modeId === 'siege') {
    const l = siegeLevel(ch.difficulty);
    vars.wall = l.wall;
    vars.s = Math.round(l.chargeMs / 1000);
  }
  out.push(tk(`daily.mode.${ch.modeId}.${ab(f >> 1)}`, vars));

  // Technika tylko tam, gdzie plansza to zwykłe sudoku (w Tetroku i Saperdoku decyduje co innego).
  if (ch.modeId === 'classic' || ch.modeId === 'clues' || ch.modeId === 'siege') out.push(tk(`daily.tech.${rate(s.puzzle).hardest}`));
  if (ch.modeId === 'minesweeper' && s.saper && !s.saper.showList) out.push(tk('daily.blind'));

  out.push(tk(`daily.mod.${ch.mod}.${ab(f >> 2)}`));
  return out;
}

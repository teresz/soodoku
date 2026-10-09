import { Puzzle } from '../core/generator';
import type { SavedGame } from '../game/game';

export interface DifficultyLevel {
  id: string;
  label: string;
  hint: string;
}

/**
 * Tryb gry. Każdy tryb ma własną drabinkę poziomów trudności i sam generuje plansze;
 * UI, zapis gry i statystyki są wspólne. Kolejne tryby (sudoku+tetris, sudoku+saper…) dokładają się tutaj.
 */
export interface GameMode {
  id: string;
  name: string;
  tagline: string;
  /** Krótko: od czego zależy trudność w tym trybie. */
  ladder: string;
  /** false = pokazujemy w menu jako „wkrótce”. */
  available: boolean;
  /** Ile błędów kończy grę; null = bez limitu. */
  mistakeLimit: number | null;
  difficulties: DifficultyLevel[];
  createPuzzle(difficultyId: string, seed: number): Puzzle;
  /** Instrukcja trybu (HTML) do arkusza „Jak grać”; brak = tryb nie potrzebuje tłumaczenia. */
  rules?(): string;
  /** Dodatkowy stan trybu dokładany do świeżej gry (np. kolejka klocków w Tetroku). */
  setup?(state: SavedGame): void;
}

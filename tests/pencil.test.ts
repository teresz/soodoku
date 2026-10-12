import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { candidates } from '../src/core/board';

describe('Szybki ołówek', () => {
  it('wpisuje kandydatów do pustych pól, nie rusza wypełnionych i da się go cofnąć', () => {
    const g = Game.create('classic', 'easy', 7);
    const s = g.state;
    expect(g.fillNotes()).toBe(true);
    for (let i = 0; i < 81; i++) {
      if (s.values[i]) expect(s.notes[i]).toBe(0);
      else expect(s.notes[i]).toBe(candidates(s.values, i));
    }
    expect(g.fillNotes()).toBe(false); // nic się nie zmieniło
    expect(g.undo()).toBe(true);
    expect(s.notes.every((m) => m === 0)).toBe(true);
  });
});

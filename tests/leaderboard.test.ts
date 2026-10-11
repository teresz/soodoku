import { describe, expect, it } from 'vitest';
import { RANKED_MODES, byScore, submitScore } from '../src/net/leaderboard';
import { playerName } from '../src/ui/leaderboard';
import { setLang } from '../src/i18n';

// setLang odświeża teksty strony, więc w testach bez DOM wystarczy pusta atrapa dokumentu.
(globalThis as { document?: unknown }).document ??= { documentElement: {}, querySelectorAll: () => [] };

describe('ranking globalny', () => {
  it('gracz bez konta to Gość albo Guest, zależnie od języka oglądającego', () => {
    setLang('pl');
    expect(playerName(null)).toBe('Gość');
    expect(playerName('  ')).toBe('Gość');
    setLang('en');
    expect(playerName(null)).toBe('Guest');
    expect(playerName('ania')).toBe('ania');
    setLang('pl');
  });
  it('Sabotaż nie ma rankingu, Tetroku liczy punkty', () => {
    expect(RANKED_MODES).not.toContain('sabotage');
    expect(byScore('tetris')).toBe(true);
    expect(byScore('classic')).toBe(false);
  });
  it('poza zwykłą stroną nic nie wysyła', async () => {
    expect(await submitScore('classic', 'easy', 60000)).toBeNull();
  });
});

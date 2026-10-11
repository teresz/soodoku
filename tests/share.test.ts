import { describe, expect, it } from 'vitest';
import { shareText } from '../src/daily/share';

const labels = { title: 'Wyzwanie dnia', time: (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}` };

describe('shareText', () => {
  it('numeruje wyzwania od 1 października i pokazuje streak w terminie', () => {
    const txt = shareText({ day: '2026-10-11', ms: 252000, mistakes: 1, hints: 0, streak: 5, onTime: true }, labels);
    expect(txt).toBe('soodoku · Wyzwanie dnia #11\n⏱ 4:12 · ❌ 1 · 💡 0 · 🔥 5\nhttps://soodoku.org');
  });
  it('bez streaka przy nadrabianiu', () => {
    const txt = shareText({ day: '2026-10-01', ms: 60000, mistakes: 0, hints: 2, streak: 3, onTime: false }, labels);
    expect(txt.split('\n')[0]).toBe('soodoku · Wyzwanie dnia #1');
    expect(txt).not.toContain('🔥');
  });
});

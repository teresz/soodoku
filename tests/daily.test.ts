import { describe, expect, it } from 'vitest';
import {
  DAILY_MODES, DAILY_START, DailyProgress, addDays, bestStreak, challengeFor, currentStreak, dayState, recordDaily,
} from '../src/daily/daily';
import { buildNote } from '../src/daily/note';
import { Game } from '../src/game/game';
import { setLang } from '../src/i18n';

(globalThis as any).document ??= { documentElement: {}, querySelectorAll: () => [] };

const rec = { ms: 1000, mistakes: 0, hints: 0 };
const done = (days: string[], today: (d: string) => string = (d) => d): DailyProgress =>
  days.reduce((p, d) => recordDaily(p, d, today(d), rec).progress, {} as DailyProgress);

describe('wyzwanie dnia', () => {
  it('ten sam dzień = to samo wyzwanie, różne dni = różne plansze', () => {
    expect(challengeFor('2026-10-09')).toEqual(challengeFor('2026-10-09'));
    expect(challengeFor('2026-10-09').seed).not.toBe(challengeFor('2026-10-10').seed);
  });

  it('tryby rotują: w każdym bloku pięciu dni każdy tryb raz, bez dwóch takich samych dni pod rząd', () => {
    let prev = '';
    for (let k = 0; k < 200; k++) {
      const ch = challengeFor(addDays(DAILY_START, k));
      expect(ch.modeId).not.toBe(prev);
      expect(DAILY_MODES.find((m) => m.id === ch.modeId)!.levels).toContain(ch.difficulty);
      expect(ch.modeId).not.toBe('sabotage');
      if (ch.modeId === 'siege') expect(ch.mod).not.toBe('strict'); // Oblężenie nie ma limitu błędów
      prev = ch.modeId;
    }
  });

  it('streak rośnie tylko za wyzwania zrobione w swoim dniu', () => {
    const p = done(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(currentStreak(p, '2026-10-07')).toBe(3);
    expect(currentStreak(p, '2026-10-08')).toBe(3); // dziś jeszcze można zdążyć
    expect(currentStreak(p, '2026-10-09')).toBe(0); // dzień przerwy zrywa
    // Nadrobienie 8 października dziewiątego nie skleja streaka.
    const late = recordDaily(p, '2026-10-08', '2026-10-09', rec).progress;
    expect(late['2026-10-08'].onTime).toBe(false);
    expect(currentStreak(late, '2026-10-09')).toBe(0);
    expect(dayState(late, '2026-10-08', '2026-10-09')).toBe('late');
    expect(bestStreak(late)).toBe(3);
  });

  it('powtórka po terminie nie zabiera zdobytego „w terminie”', () => {
    const p = done(['2026-10-05']);
    const again = recordDaily(p, '2026-10-05', '2026-10-09', { ms: 500, mistakes: 1, hints: 0 });
    expect(again.first).toBe(false);
    expect(again.progress['2026-10-05']).toMatchObject({ onTime: true, ms: 500 });
  });

  it('stany dni w kalendarzu', () => {
    const p = done(['2026-10-02']);
    expect(dayState(p, '2026-09-30', '2026-10-09')).toBe('before');
    expect(dayState(p, '2026-10-02', '2026-10-09')).toBe('onTime');
    expect(dayState(p, '2026-10-03', '2026-10-09')).toBe('missed');
    expect(dayState(p, '2026-10-09', '2026-10-09')).toBe('today');
    expect(dayState(p, '2026-10-10', '2026-10-09')).toBe('future');
  });

  it('notatka jest dla każdego trybu, w obu językach, bez surowych kluczy i różna z dnia na dzień', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 5; k++) {
      const ch = challengeFor(addDays(DAILY_START, k));
      const g = Game.create(ch.modeId, ch.difficulty, ch.seed);
      g.state.daily = { day: ch.day, mod: ch.mod };
      for (const lang of ['pl', 'en'] as const) {
        setLang(lang);
        const note = buildNote(ch, g.state);
        expect(note.length).toBeGreaterThanOrEqual(3);
        for (const line of note) expect(line, `${ch.day}/${lang}`).not.toMatch(/daily\.|\{\w+\}/);
        if (lang === 'pl') seen.add(note.join(' '));
      }
    }
    setLang('pl');
    expect(seen.size).toBe(5);
  }, 30000);

  it('haczyki działają w grze', () => {
    const g = Game.create('classic', 'easy', 7);
    g.state.daily = { day: '2026-10-09', mod: 'noHints' };
    expect(g.hintsLeft).toBe(0);
    g.state.daily.mod = 'strict';
    g.options.checkMistakes = false;
    expect(g.mistakeLimit).toBe(1);
    const i = g.state.puzzle.findIndex((v) => !v);
    expect(g.place(i, (g.state.solution[i] % 9) + 1).lost).toBe(true);
    const n = Game.create('classic', 'easy', 7);
    n.state.daily = { day: '2026-10-09', mod: 'noNotes' };
    expect(n.toggleNote(i, 1).changed).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { cleanEmail, mergeMatches, rivals, toMatchRow, type MatchRecord } from '../src/modes/sabotage/matches';

const m = (id: string, opp: string | null, won: boolean, owner: string | null = 'u1', at = '2026-10-09T10:00:00Z', synced = false): MatchRecord =>
  ({ id, at, opp, won, ms: 1000, level: 'easy', owner, synced });

describe('statystyki Sabotażu z rywalami', () => {
  it('bilans per rywal, gość na końcu, tylko mecze bieżącego konta', () => {
    const list = [
      m('1', 'ola@x.pl', true), m('2', 'ola@x.pl', false), m('3', 'ola@x.pl', true, 'u1', '2026-10-09T12:00:00Z'),
      m('4', null, true), m('5', 'bob@x.pl', false),
      m('6', 'ola@x.pl', true, 'u2'), m('7', null, false, null),
    ];
    const r = rivals(list, 'u1');
    expect(r.map((x) => x.opp)).toEqual(['ola@x.pl', 'bob@x.pl', null]);
    expect(r[0]).toMatchObject({ played: 3, won: 2, lost: 1, lastAt: '2026-10-09T12:00:00Z' });
    expect(rivals(list, null)).toEqual([{ opp: null, played: 1, won: 0, lost: 1, lastAt: '2026-10-09T10:00:00Z' }]);
  });

  it('łączy mecze z serwera z telefonem i wysyła tylko brakujące', () => {
    const local = [m('a', 'ola@x.pl', true), m('b', null, false, 'u1', '2026-10-09T10:00:00Z', true), m('c', 'ola@x.pl', true, 'u2')];
    const remote = [toMatchRow(m('b', null, false)), toMatchRow(m('z', 'BOB@x.pl', true))];
    const { merged, upload } = mergeMatches(local, 'u1', remote);
    expect(upload.map((u) => u.id)).toEqual(['a']);
    expect(merged.find((x) => x.id === 'z')).toMatchObject({ opp: 'bob@x.pl', owner: 'u1', synced: true });
    expect(merged.filter((x) => x.id === 'b')).toHaveLength(1);
    // Drugi raz nic nowego.
    const again = mergeMatches(merged.map((x) => (x.id === 'a' ? { ...x, synced: true } : x)), 'u1', [...remote, toMatchRow(m('a', 'ola@x.pl', true))]);
    expect(again.upload).toEqual([]);
    expect(again.merged).toHaveLength(merged.length);
  });

  it('mail od rywala przechodzi tylko, gdy wygląda na mail', () => {
    expect(cleanEmail('  Ola@X.pl ')).toBe('ola@x.pl');
    expect(cleanEmail('<script>@x.pl')).toBeNull();
    expect(cleanEmail('bez-malpy')).toBeNull();
    expect(cleanEmail(42)).toBeNull();
    expect(cleanEmail(`${'a'.repeat(250)}@x.pl`)).toBeNull();
  });
});

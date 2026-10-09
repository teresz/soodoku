import { describe, expect, it } from 'vitest';
import { currentStreak, mergeProgress, type DailyProgress } from '../src/daily/daily';
import { fromRows, plan, toRow } from '../src/daily/sync';

const r = (onTime: boolean, ms = 1000, doneOn = '2026-10-05') => ({ ms, mistakes: 0, hints: 0, onTime, doneOn });

describe('synchronizacja postępu wyzwań', () => {
  it('dwa telefony sklejają się w jeden streak', () => {
    const phone: DailyProgress = { '2026-10-05': r(true, 1000, '2026-10-05'), '2026-10-07': r(true, 1000, '2026-10-07') };
    const tablet: DailyProgress = { '2026-10-06': r(true, 1000, '2026-10-06') };
    expect(currentStreak(phone, '2026-10-07')).toBe(1);
    expect(currentStreak(mergeProgress(phone, tablet), '2026-10-07')).toBe(3);
  });

  it('„w terminie” nie ginie, czas bierze się najlepszy, data ukończenia najwcześniejsza', () => {
    const m = mergeProgress({ d: r(true, 900, '2026-10-05') }, { d: r(false, 500, '2026-10-08') })['d'];
    expect(m).toEqual({ ms: 500, mistakes: 0, hints: 0, onTime: true, doneOn: '2026-10-05' });
  });

  it('wysyła tylko dni, których serwer nie ma albo ma gorsze', () => {
    const remote = fromRows([toRow('2026-10-05', r(true)), toRow('2026-10-06', r(false, 800, '2026-10-07'))]);
    const local: DailyProgress = { '2026-10-05': r(true), '2026-10-06': r(true, 1200, '2026-10-06'), '2026-10-07': r(true, 1000, '2026-10-07') };
    const { merged, upload } = plan(local, remote);
    expect(upload.map((u) => u.day).sort()).toEqual(['2026-10-06', '2026-10-07']);
    expect(merged['2026-10-06']).toMatchObject({ onTime: true, ms: 800, doneOn: '2026-10-06' });
    expect(plan(merged, fromRows(upload.concat(toRow('2026-10-05', r(true))))).upload).toEqual([]);
  });

  it('wiersze dla bazy mają całkowite milisekundy', () => {
    expect(toRow('2026-10-05', r(true, 2243.19)).ms).toBe(2243);
  });
});

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { AttackQueue, DURATION, ROTATE_GUARD_MS, attacksFor, decideWinner, makeCode, normalizeCode, pickBanDigit } from '../src/modes/sabotage/engine';

const counts = (full: number[] = []) => [0, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (full.includes(d) ? 9 : 3))];

describe('Sabotaż', () => {
  it('kwadrat daje obrót, wiersz i kolumna proste ataki', () => {
    const a = attacksFor([2, 11, 20], makeRng(1));
    expect(a[2]).toBe('rotate');
    expect(['ban', 'blur']).toContain(a[0]);
    expect(['ban', 'blur']).toContain(a[1]);
  });

  it('zakaz tylko na cyfrę, której jeszcze brakuje', () => {
    const rng = makeRng(5);
    for (let k = 0; k < 50; k++) expect(pickBanDigit(counts([1, 2, 3, 4, 5, 6, 7, 8]), rng)).toBe(9);
    expect(pickBanDigit(counts([1, 2, 3, 4, 5, 6, 7, 8, 9]), rng)).toBeNull();
  });

  it('ataki idą po kolei', () => {
    const q = new AttackQueue(), rng = makeRng(2);
    q.push('blur'); q.push('blur');
    expect(q.tick(0, counts(), rng)?.kind).toBe('blur');
    expect(q.tick(100, counts(), rng)).toBeNull();
    expect(q.blurred(100)).toBe(true);
    expect(q.tick(DURATION.blur, counts(), rng)?.kind).toBe('blur');
    expect(q.pending).toBe(0);
  });

  it('dwa obroty pod rząd: drugi zamienia się w zamazanie', () => {
    const q = new AttackQueue(), rng = makeRng(3);
    q.push('rotate'); q.push('rotate');
    expect(q.tick(0, counts(), rng)?.kind).toBe('rotate');
    expect(q.tick(DURATION.rotate, counts(), rng)?.kind).toBe('blur');
    expect(q.rotation).toBe(1);
    q.push('rotate');
    expect(q.tick(ROTATE_GUARD_MS + 1, counts(), rng)?.kind).toBe('rotate');
    expect(q.rotation).toBe(2);
  });

  it('zakaz bez wolnych cyfr staje się zamazaniem', () => {
    const q = new AttackQueue();
    q.push('ban');
    expect(q.tick(0, counts([1, 2, 3, 4, 5, 6, 7, 8, 9]), makeRng(1))?.kind).toBe('blur');
  });

  it('remis wygrywa gospodarz, inaczej krótszy czas', () => {
    expect(decideWinner(100, 200, false)).toBe(true);
    expect(decideWinner(200, 100, true)).toBe(false);
    expect(decideWinner(100, 100, true)).toBe(true);
    expect(decideWinner(100, 100, false)).toBe(false);
  });

  it('kody pokoi mają 4 znaki bez mylących liter', () => {
    const c = makeCode(makeRng(9));
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(normalizeCode(' ab-c d9 ')).toBe('ABCD');
  });
});

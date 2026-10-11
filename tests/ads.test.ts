import { describe, expect, it } from 'vitest';
import { adsMode } from '../src/ads/ads';

describe('adsMode', () => {
  it('bez ca-pub reklam nie ma nawet na soodoku.org', () => {
    expect(adsMode('soodoku.org', '')).toBe('off');
  });
  it('podgląd PR-a i localhost nie dostają reklam', () => {
    expect(adsMode('soodoku.teresz.workers.dev', '')).toBe('off');
    expect(adsMode('localhost', '')).toBe('off');
  });
  it('?ads=demo pokazuje ramki gdziekolwiek', () => {
    expect(adsMode('localhost', '?ads=demo')).toBe('demo');
  });
});

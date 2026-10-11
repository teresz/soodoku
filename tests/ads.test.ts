import { describe, expect, it } from 'vitest';
import { adsMode } from '../src/ads/ads';

describe('adsMode', () => {
  it('na soodoku.org reklamy są włączone', () => {
    expect(adsMode('soodoku.org', '')).toBe('live');
    expect(adsMode('www.soodoku.org', '')).toBe('live');
  });
  it('podgląd PR-a i localhost nie dostają reklam', () => {
    expect(adsMode('soodoku.teresz.workers.dev', '')).toBe('off');
    expect(adsMode('localhost', '')).toBe('off');
  });
  it('?ads=demo pokazuje ramki gdziekolwiek', () => {
    expect(adsMode('localhost', '?ads=demo')).toBe('demo');
  });
});

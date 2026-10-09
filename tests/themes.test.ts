import { describe, expect, it } from 'vitest';
import { hslToHex, THEMES, themeVars } from '../src/ui/themes';

describe('kolor paska stanu', () => {
  it('zamienia hsl() na hex', () => {
    expect(hslToHex('hsl(232 30% 96%)')).toBe('#f2f3f8');
    expect(hslToHex('hsl(232 24% 6%)')).toBe('#0c0d13');
    expect(hslToHex('hsl(220 0% 50%)')).toBe('#808080');
  });
  it('każdy motyw daje poprawny hex w obu trybach', () => {
    for (const t of THEMES) for (const dark of [false, true]) expect(hslToHex(themeVars(t, dark)['--bg'])).toMatch(/^#[0-9a-f]{6}$/);
  });
});

import { describe, expect, it } from 'vitest';
import { MODES } from '../src/modes';
import { setLang } from '../src/i18n';

// setLang odświeża teksty w DOM; w testach wystarczy pusty dokument.
(globalThis as any).document ??= { documentElement: {}, querySelectorAll: () => [] };

// Klasyczne tryby nie potrzebują instrukcji; każdy niestandardowy musi mieć arkusz „Jak grać”.
const CLASSIC = ['classic', 'clues'];

describe('Jak grać', () => {
  it('każdy niestandardowy tryb ma instrukcję po polsku i angielsku', () => {
    for (const m of MODES.filter((x) => !CLASSIC.includes(x.id))) {
      for (const lang of ['pl', 'en'] as const) {
        setLang(lang);
        const html = m.rules?.() ?? '';
        expect(html, `${m.id}/${lang}`).toContain('sr-lead');
        expect(html, `${m.id}/${lang}`).not.toMatch(/\b[a-z]+\.r\.[a-zA-Z0-9.]+/); // brak surowych kluczy
      }
    }
    setLang('pl');
  });

  it('klasyczne tryby zostają bez instrukcji', () => {
    for (const id of CLASSIC) expect(MODES.find((m) => m.id === id)?.rules).toBeUndefined();
  });
});

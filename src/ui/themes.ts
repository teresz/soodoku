// Palety kolorów. Każda ma wersję jasną i ciemną; neutralne kolory są podbarwione odcieniem palety.
export interface Theme {
  id: string;
  name: string;
  hue: number; // odcień neutralnych tła i tekstu
  sat: number; // jak mocno podbarwić neutralne (0 = czysta szarość)
  accent: [light: string, dark: string];
  onAccent: [light: string, dark: string];
  glow: [string, string]; // dwa kolory „żywego” tła
}

export const THEMES: Theme[] = [
  { id: 'volt', name: 'Wolt', hue: 232, sat: 30, accent: ['#3b4cff', '#7c8cff'], onAccent: ['#ffffff', '#0b0e24'], glow: ['#5b6cff', '#00d1ff'] },
  { id: 'lime', name: 'Limonka', hue: 85, sat: 18, accent: ['#4c8a00', '#c8f53a'], onAccent: ['#ffffff', '#16210a'], glow: ['#b6ff3b', '#2ee6a6'] },
  { id: 'coral', name: 'Koral', hue: 12, sat: 30, accent: ['#e8432f', '#ff7a5c'], onAccent: ['#ffffff', '#2a0d07'], glow: ['#ff6b4a', '#ffb23f'] },
  { id: 'iris', name: 'Irys', hue: 268, sat: 30, accent: ['#7a3cf0', '#b28cff'], onAccent: ['#ffffff', '#1a0d33'], glow: ['#9a5bff', '#ff5bd1'] },
  { id: 'lagoon', name: 'Laguna', hue: 186, sat: 30, accent: ['#008f86', '#3ee0cf'], onAccent: ['#ffffff', '#04211f'], glow: ['#16d6c1', '#3b8bff'] },
  { id: 'neon', name: 'Neon', hue: 296, sat: 34, accent: ['#c0139f', '#ff4fd8'], onAccent: ['#ffffff', '#2a0423'], glow: ['#ff2bd6', '#22e8ff'] },
  { id: 'gold', name: 'Złoto', hue: 42, sat: 34, accent: ['#8f5d00', '#ffc83d'], onAccent: ['#ffffff', '#251800'], glow: ['#ffc83d', '#ff7a1a'] },
  { id: 'sakura', name: 'Sakura', hue: 340, sat: 32, accent: ['#c42a68', '#ff8fbd'], onAccent: ['#ffffff', '#2e0717'], glow: ['#ff9ec7', '#ffcf8a'] },
  { id: 'coffee', name: 'Kawa', hue: 26, sat: 20, accent: ['#7b4a26', '#e0aa78'], onAccent: ['#ffffff', '#24140a'], glow: ['#c98a55', '#f2cf8f'] },
  { id: 'aurora', name: 'Zorza', hue: 165, sat: 30, accent: ['#00855f', '#45f5b0'], onAccent: ['#ffffff', '#032619'], glow: ['#2ef5a3', '#8f5bff'] },
  { id: 'glacier', name: 'Lodowiec', hue: 204, sat: 38, accent: ['#0069a8', '#8fdcff'], onAccent: ['#ffffff', '#06202e'], glow: ['#8fdcff', '#e3f6ff'] },
  { id: 'mono', name: 'Mono', hue: 220, sat: 0, accent: ['#111111', '#f2f2f2'], onAccent: ['#ffffff', '#111111'], glow: ['#9a9a9a', '#d4d4d4'] },
];

export type Appearance = 'auto' | 'light' | 'dark';

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** Czy w trybie auto wypada ciemny: najpierw wybór podglądu (data-theme), potem system. */
function systemDark(): boolean {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'dark') return true;
  if (forced === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function themeVars(t: Theme, dark: boolean): Record<string, string> {
  const k = dark ? 1 : 0;
  const h = t.hue, s = t.sat;
  const hsl = (sat: number, l: number) => `hsl(${h} ${sat}% ${l}%)`;
  return dark
    ? {
        '--bg': hsl(s * 0.8, 6), '--surface': hsl(s * 0.6, 10), '--cell': hsl(s * 0.5, 14), '--cell-given': hsl(s * 0.5, 17),
        '--text': hsl(s * 0.3, 95), '--muted': hsl(s * 0.4, 62), '--line': hsl(s * 0.4, 22),
        '--accent': t.accent[k], '--on-accent': t.onAccent[k], '--glow-a': t.glow[0], '--glow-b': t.glow[1],
        '--glow-alpha': '0.22', '--danger': '#ff6b6b', '--color-scheme': 'dark',
      }
    : {
        '--bg': hsl(s, 96), '--surface': hsl(s * 0.6, 99.5), '--cell': hsl(s * 0.9, 94), '--cell-given': hsl(s * 0.9, 90),
        '--text': hsl(s * 0.6, 11), '--muted': hsl(s * 0.4, 42), '--line': hsl(s * 0.5, 86),
        '--accent': t.accent[k], '--on-accent': t.onAccent[k], '--glow-a': t.glow[0], '--glow-b': t.glow[1],
        '--glow-alpha': '0.28', '--danger': '#e5383b', '--color-scheme': 'light',
      };
}

export function applyTheme(themeId: string, appearance: Appearance) {
  const dark = appearance === 'dark' || (appearance === 'auto' && systemDark());
  const vars = themeVars(getTheme(themeId), dark);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg']);
}

/** Odświeżaj motyw, gdy zmieni się systemowy tryb albo przełącznik podglądu. */
export function watchSystemTheme(onChange: () => void) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onChange);
  new MutationObserver(onChange).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

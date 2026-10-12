// Notatka „Dlaczego to wyzwanie”: tylko zdanie o dniu tygodnia i, jeśli jest, haczyk.
// Warianty tekstu wybiera liczba dnia.
import { tk } from '../i18n';
import type { Challenge } from './daily';

const ab = (n: number) => (n % 2 ? 'b' : 'a');

export function buildNote(ch: Challenge): string[] {
  const f = ch.flavor;
  const lines = [tk(`daily.wd.${ch.weekday}.${ab(f)}`)];
  if (ch.mod !== 'none') lines.push(tk(`daily.mod.${ch.mod}.${ab(f >> 2)}`));
  return lines;
}

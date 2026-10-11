// Tekst do udostępnienia po wyzwaniu dnia (jak w Wordle): numer wyzwania, czas, błędy, podpowiedzi i streak.
import { dayNumber, DAILY_START } from './daily';

export interface ShareInput { day: string; ms: number; mistakes: number; hints: number; streak: number; onTime: boolean }

export const SHARE_URL = 'https://soodoku.org';

export function shareText(r: ShareInput, labels: { title: string; time: (ms: number) => string }): string {
  const n = dayNumber(r.day) - dayNumber(DAILY_START) + 1;
  const stats = [`⏱ ${labels.time(r.ms)}`, `❌ ${r.mistakes}`, `💡 ${r.hints}`];
  if (r.onTime && r.streak > 1) stats.push(`🔥 ${r.streak}`);
  return `soodoku · ${labels.title} #${n}\n${stats.join(' · ')}\n${SHARE_URL}`;
}

/** Systemowe „Udostępnij” na telefonie, a gdzie go nie ma, kopiowanie do schowka. Zwraca, co się stało. */
export async function shareResult(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'shared'; // użytkownik zamknął okno: nic nie mówimy
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

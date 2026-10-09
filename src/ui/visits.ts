// Panel „Odwiedziny” w Statystykach, tylko dla admina: dziś, łącznie i słupki z ostatnich 14 dni.
import './visits.css';
import { locale, num, t } from '../i18n';
import { addDays, dayKey, parseDay } from '../daily/daily';
import type { VisitStats } from '../net/visits';

/** 0 min / 42 min / 3 h 05 min / 2 d 4 h */
export function duration(secs: number) {
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${String(m % 60).padStart(2, '0')} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export function renderVisits(s: VisitStats | null): string {
  if (!s) return '';
  const today = dayKey();
  const byDay = new Map(s.days.map((d) => [d.day.slice(0, 10), d]));
  const days = [...Array(14)].map((_, k) => addDays(today, k - 13));
  const max = Math.max(1, ...days.map((d) => Number(byDay.get(d)?.visits ?? 0)));
  const bars = days.map((d) => {
    const v = Number(byDay.get(d)?.visits ?? 0), p = Number(byDay.get(d)?.devices ?? 0), m = duration(Number(byDay.get(d)?.seconds ?? 0));
    const label = parseDay(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
    return `<span class="vs-bar${d === today ? ' now' : ''}" title="${label}: ${t('visits.tip', { v, p, m })}"><i style="height:${Math.max(4, Math.round((v / max) * 100))}%"></i><small>${parseDay(d).getDate()}</small></span>`;
  }).join('');
  const tile = (label: string, c: { visits: number; devices: number; seconds?: number }, cls = '') =>
    `<div class="vs-tile ${cls}"><small>${label}</small><b>${num(Number(c.visits))}</b><span>${t('visits.devices', { n: num(Number(c.devices)) })}</span>`
    + `<em class="vs-time">⏱ ${duration(Number(c.seconds ?? 0))}</em></div>`;
  return `<div class="visits-box">
    <p class="sheet-label">${t('visits.title')}</p>
    <div class="vs-tiles">${tile(t('visits.today'), s.today, 'hot')}${tile(t('visits.total'), s.total)}</div>
    <div class="vs-chart" aria-hidden="true">${bars}</div>
  </div>`;
}

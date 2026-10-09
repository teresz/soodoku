// Statystyki multiplayer w arkuszu Statystyki: karta na każdego rywala z bilansem i paskiem wygrane/porażki.
import './rivals.css';
import { locale, t } from '../i18n';
import type { Account } from '../net/account';
import { accountsAvailable } from '../net/account';
import { loadMatches, newMatchId, rivals, saveMatches } from '../modes/sabotage/matches';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function addMatchRecord(m: { won: boolean; ms: number; level: string; opp: string | null; owner: string | null }) {
  saveMatches([...loadMatches(), { id: newMatchId(), at: new Date().toISOString(), ...m, ms: Math.round(m.ms) }]);
}

const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
};

export function renderRivals(acc: Account | null, sync: 'off' | 'ok' | 'error'): string {
  const list = rivals(loadMatches(), acc?.id ?? null);
  const total = list.reduce((a, r) => ({ won: a.won + r.won, lost: a.lost + r.lost }), { won: 0, lost: 0 });
  const cards = list.map((r, k) => {
    const name = r.opp ? r.opp.split('@')[0] : t('stats.rivals.guest');
    const pct = Math.round((r.won / r.played) * 100);
    const lead = r.won > r.lost ? 'up' : r.won < r.lost ? 'down' : 'even';
    return `<li class="rival ${lead}${r.opp ? '' : ' guest'}" style="--k:${k}">
      <span class="rv-avatar" aria-hidden="true">${r.opp ? esc(name[0]?.toUpperCase() ?? '?') : '?'}</span>
      <span class="rv-who"><b>${esc(name)}</b><small>${r.opp ? esc(r.opp) : t('stats.rivals.guestSub')}</small></span>
      <span class="rv-score" aria-label="${t('stats.rivals.score', { w: r.won, l: r.lost })}"><b>${r.won}</b><i>:</i><b>${r.lost}</b></span>
      <span class="rv-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <small class="rv-line">${t('stats.rivals.line', { n: r.played, p: pct, date: date(r.lastAt) })}</small>
    </li>`;
  }).join('');
  const hint = !accountsAvailable() ? '' : acc ? t('stats.rivals.hintIn') : t('stats.rivals.hintGuest');
  return `<div class="rivals-box">
    <p class="sheet-label">${t('stats.rivals')}</p>
    ${list.length ? `<p class="rv-total"><span>${t('stats.rivals.total')}</span><b>${total.won}</b><i>:</i><b>${total.lost}</b></p>
    <ul class="rivals">${cards}</ul>` : `<p class="rv-empty">${t('stats.rivals.empty')}</p>`}
    ${sync === 'error' ? `<p class="rv-note bad">${t('stats.rivals.error')}</p>` : ''}
    ${hint ? `<p class="rv-note">${hint}</p>` : ''}
  </div>`;
}

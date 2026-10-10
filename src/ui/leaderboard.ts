// „Ranking globalny” w Statystykach: wybór trybu i poziomu, podium z medalami, reszta dziesiątki i Twoje miejsce.
import './leaderboard.css';
import { num, t } from '../i18n';
import { MODES } from '../modes';
import { accountsAvailable } from '../net/account';
import { RANKED_MODES, BoardResult, byScore, cachedBoard, fetchBoard } from '../net/leaderboard';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Nazwa w rankingu: część maila przed @ albo „Gość” / „Guest” w języku oglądającego. */
export const playerName = (name: string | null | undefined) => (name && name.trim() ? name.trim() : t('lb.guest'));

export interface LeaderboardDeps {
  formatTime: (ms: number) => string;
  signedIn: () => boolean;
  isAdmin: () => boolean;
}

export function createLeaderboard(deps: LeaderboardDeps) {
  let mode = RANKED_MODES[0];
  let level = '';
  let slot: HTMLElement | null = null;
  const errors = new Map<string, 'missing' | 'network'>();

  const modes = () => MODES.filter((m) => m.available && RANKED_MODES.includes(m.id));
  const current = () => modes().find((m) => m.id === mode) ?? modes()[0];
  const levelOk = () => current().difficulties.some((d) => d.id === level);
  const key = () => `${mode}:${level}`;

  const value = (ms: number, score: number | null) => byScore(mode)
    ? `<b>${num(score ?? 0)}</b><small>${t('lb.pts')}</small>`
    : `<b>${deps.formatTime(ms)}</b>`;

  function listHtml(): string {
    const board = cachedBoard(mode, level);
    const err = errors.get(key());
    if (!board && err) {
      const msg = err === 'missing' && deps.isAdmin() ? t('lb.missingSql') : t('lb.offline');
      return `<p class="lb-empty bad">${msg}</p>`;
    }
    if (!board) return `<ol class="lb-list loading" aria-busy="true">${'<li class="lb-row ghost"><i></i></li>'.repeat(5)}</ol>`;
    if (!board.top.length) return `<p class="lb-empty">${t('lb.empty')}</p>`;
    const rows = board.top.map((r, k) => {
      const guest = !r.name;
      const name = playerName(r.name);
      const medal = r.pos <= 3 ? ` medal m${r.pos}` : '';
      return `<li class="lb-row${medal}${r.me ? ' me' : ''}${guest ? ' guest' : ''}" style="--k:${k}">
        <span class="lb-pos">${r.pos <= 3 ? `<i aria-hidden="true"></i><span>${r.pos}</span>` : r.pos}</span>
        <span class="lb-who"><b>${esc(name)}</b>${r.me ? `<em>${t('lb.you')}</em>` : ''}</span>
        <span class="lb-val">${value(r.ms, r.score)}</span>
      </li>`;
    }).join('');
    const me = board.me && !board.top.some((r) => r.me)
      ? `<p class="lb-mine"><span>${t('lb.yourPlace')}</span><b>#${num(board.me.pos)}</b><span class="lb-val">${value(board.me.ms, board.me.score)}</span></p>` : '';
    return `<ol class="lb-list">${rows}</ol>${me}<p class="lb-count">${t('lb.players', { n: num(board.players) })}</p>`;
  }

  function html(): string {
    const m = current();
    const chips = modes().map((x) => `<button type="button" class="lb-chip${x.id === m.id ? ' on' : ''}" data-lb-mode="${x.id}" aria-pressed="${x.id === m.id}">${esc(x.name)}</button>`).join('');
    const lvls = m.difficulties.map((d) => `<button type="button" class="lb-lvl${d.id === level ? ' on' : ''}" data-lb-level="${d.id}" aria-pressed="${d.id === level}">${esc(d.label)}</button>`).join('');
    const hint = deps.signedIn() ? '' : `<p class="lb-note">${t('lb.hintGuest')}</p>`;
    return `<div class="lb-box">
      <div class="lb-head">
        <span class="lb-globe" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9M12 3C9.4 5.6 8.1 8.6 8.1 12s1.3 6.4 3.9 9"/></svg></span>
        <span class="lb-title"><b>${t('lb.title')}</b><small>${t(byScore(mode) ? 'lb.subScore' : 'lb.subTime')}</small></span>
      </div>
      <div class="lb-modes">${chips}</div>
      <div class="lb-levels">${lvls}</div>
      <div class="lb-body" aria-live="polite">${listHtml()}</div>
      ${hint}
    </div>`;
  }

  function draw() {
    if (!slot?.isConnected) return;
    slot.innerHTML = html();
  }

  async function load() {
    const k = key();
    const res: BoardResult = await fetchBoard(mode, level);
    if ('error' in res) errors.set(k, res.error); else errors.delete(k);
    if (k === key()) draw();
  }

  function pick(m: string, l?: string) {
    mode = m;
    level = l ?? '';
    if (!levelOk()) level = current().difficulties[0]?.id ?? '';
  }

  return {
    /** Ustawia ranking na tryb i poziom (np. po wygranej, żeby w Statystykach od razu był „Twój”). */
    focus(m: string, l: string) { if (RANKED_MODES.includes(m)) pick(m, l); },
    /** Rysuje ranking w `el` i dociąga świeże wyniki. Poza zwykłą stroną (Artifact) nie rysuje nic. */
    mount(el: HTMLElement) {
      if (!accountsAvailable() || !modes().length) return;
      pick(mode, level);
      slot = el;
      el.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lb-mode], [data-lb-level]');
        if (!b) return;
        if (b.dataset.lbMode) pick(b.dataset.lbMode); else pick(mode, b.dataset.lbLevel);
        draw();
        void load();
      });
      draw();
      void load();
    },
  };
}

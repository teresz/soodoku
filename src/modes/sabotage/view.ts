import type { Game, MoveResult } from '../../game/game';
import { makeRng } from '../../core/rng';
import { t } from '../../i18n';
import { Room, RoomMsg, joinRoom } from '../../net/room';
import { currentAccount, onSyncChange } from '../../daily/sync';
import { cleanEmail } from './matches';
import {
  AttackKind, AttackQueue, COUNTDOWN_MS, LEVELS, Level, WALKOVER_MS, selfPenalty,
  attacksFor, decideWinner, makeCode, normalizeCode,
} from './engine';

// Sabotaż: lobby (pokój z kodem), pasek postępu rywala, ataki i odliczanie.
// Plansza, klawiatura i arkusz końca gry są wspólne z resztą gry (ui/app.ts).

export interface SabotageDeps {
  game: () => Game;
  board: HTMLElement;
  keys: HTMLButtonElement[];
  keypad: HTMLElement;
  /** Nowa plansza z seeda od gospodarza, od razu na ekranie gry (bez zapisu). */
  startGame: (difficulty: string, seed: number) => void;
  /** Rywal skończył pierwszy albo się poddał / uciekł. */
  onRemoteEnd: (won: boolean, why: 'faster' | 'resigned' | 'left') => void;
  render: () => void;
  toHome: () => void;
}

type Phase = 'idle' | 'connecting' | 'waiting' | 'countdown' | 'playing' | 'over';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement) => {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
};

const ICON: Record<AttackKind, string> = { ban: '⛔', blur: '🌫️', rotate: '🔄' };

export function createSabotageView(deps: SabotageDeps) {
  const rng = makeRng(Date.now() & 0x7fffffff);
  let room: Room | null = null;
  let host = false;
  let code = '';
  let level: Level = 'medium';
  let phase: Phase = 'idle';
  let round = 0;
  let lastStart: RoomMsg | null = null;
  let startAt = 0;
  let myWonMs: number | null = null;
  let theirWonMs: number | null = null;
  let opp: string | null = null; // peer rywala
  let oppProgress = 0;
  // Kto jest po drugiej stronie (do statystyk z rywalami). Mail wysyłamy dopiero, gdy rywal też ma konto.
  let oppAcct = false;
  let oppEmail: string | null = null;
  let sentId = false;
  let goneTimer = 0;
  let readyTimer = 0;
  let frozenUntil = 0;
  let selfBlurUntil = 0;
  let mistakes = 0; // błędy w tej rundzie, kara rośnie i już nie spada
  let turns = 0; // obroty planszy (rosną, żeby animacja zawsze kręciła w tę samą stronę)
  const queue = new AttackQueue();

  // --- lobby: arkusz budowany raz ---
  const sheet = el('div', 'overlay sb-overlay');
  sheet.hidden = true;
  const box = el('div', 'sheet sb-lobby', sheet);
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  document.body.appendChild(sheet);

  // --- warstwa w grze: pasek postępu, odliczanie, komunikaty ---
  const wrap = deps.board.parentElement!;
  const hud = el('div', 'sb-hud');
  hud.hidden = true;
  hud.innerHTML = `
    <div class="sb-side me"><span class="sb-who"></span><span class="sb-bar"><i></i></span><b class="sb-pct"></b></div>
    <div class="sb-side opp"><span class="sb-who"></span><span class="sb-bar"><i></i></span><b class="sb-pct"></b></div>`;
  wrap.before(hud);
  const countdown = el('div', 'sb-countdown', wrap);
  countdown.hidden = true;
  const toasts = el('div', 'sb-toasts', wrap);
  toasts.setAttribute('aria-live', 'assertive');
  const freezeEl = el('div', 'sb-freeze', deps.keypad);
  freezeEl.hidden = true;

  const g = () => deps.game();
  const inGame = () => g().state.modeId === 'sabotage';
  const now = () => performance.now();

  function toast(text: string, cls = '') {
    const e = el('div', `sb-toast ${cls}`, toasts);
    e.textContent = text;
    window.setTimeout(() => e.remove(), 1900);
  }

  // --- sieć ---
  async function connect(roomCode: string, asHost: boolean) {
    leave();
    host = asHost;
    code = roomCode;
    phase = 'connecting';
    drawLobby();
    try {
      const r = await joinRoom(`sabotage-${roomCode}`);
      if (phase !== 'connecting' || code !== roomCode) { r.leave(); return; }
      room = r;
    } catch {
      phase = 'idle';
      drawLobby(t('sab.err.connect'));
      return;
    }
    phase = 'waiting';
    room.onMessage(onMessage);
    room.onPeers(onPeers);
    if (!host) {
      // Gość puka do gospodarza, aż dostanie start.
      const knock = () => room?.send({ t: 'ready', acct: hasAcct() });
      knock();
      readyTimer = window.setInterval(() => {
        if (phase !== 'waiting') return window.clearInterval(readyTimer);
        knock();
      }, 1500);
      window.setTimeout(() => { if (phase === 'waiting' && !opp && room) drawLobby(t('sab.err.empty')); }, 12000);
    }
    drawLobby();
  }

  function onPeers(others: string[]) {
    if (phase === 'waiting' && others.length >= 2 && !host) {
      leave();
      drawLobby(t('sab.err.full'));
      return;
    }
    if (opp && !others.includes(opp)) {
      // Rywal zniknął: chwila na powrót (telefon mógł zgasić ekran), potem walkower.
      if ((phase === 'playing' || phase === 'countdown') && !goneTimer) {
        toast(t('sab.oppGone'), 'warn');
        goneTimer = window.setTimeout(() => { goneTimer = 0; finishRemote(true, 'left'); }, WALKOVER_MS);
      }
      if (phase === 'waiting' || phase === 'over') { opp = null; oppAcct = false; oppEmail = null; sentId = false; drawLobby(); renderHud(); }
    } else if (opp && others.includes(opp) && goneTimer) {
      window.clearTimeout(goneTimer);
      goneTimer = 0;
      toast(t('sab.oppBack'));
    }
    if (!opp && others.length && phase === 'waiting') drawLobby();
  }

  function onMessage(m: RoomMsg, from: string) {
    if (opp && from !== opp && m.t !== 'ready') return; // trzeci w pokoju nie ma głosu
    switch (m.t) {
      case 'ready':
        if (!host) return;
        if (!opp) opp = from;
        if (from !== opp) return;
        oppAcct = m.acct === true;
        if (phase === 'waiting') newRound();
        else if (phase === 'countdown' && lastStart) room?.send(lastStart);
        sendId();
        return;
      case 'rematch':
        if (m.acct !== undefined) { oppAcct = m.acct === true; sendId(); }
        if (host && phase === 'over') newRound();
        return;
      case 'start': {
        if (host) return;
        const r = Number(m.round), seed = Number(m.seed);
        if (r <= round || !LEVELS.includes(m.level as Level) || !Number.isFinite(seed)) return;
        opp = from;
        oppAcct = m.acct === true;
        level = m.level as Level;
        beginRound(r, seed);
        sendId();
        return;
      }
      case 'acct': // rywal zalogował się już w pokoju (konto wczytuje się chwilę po starcie strony)
        if (from !== opp) return;
        oppAcct = true;
        sendId();
        return;
      case 'id':
        if (from !== opp) return;
        oppEmail = cleanEmail(m.who);
        oppAcct = true; // przysłał mail, czyli ma konto: odsyłamy swój
        sendId();
        renderHud();
        return;
    }
    if (Number(m.round) !== round) return;
    switch (m.t) {
      case 'progress':
        oppProgress = Math.max(0, Math.min(1, Number(m.p) || 0));
        renderHud();
        return;
      case 'atk': {
        if (phase !== 'playing') return;
        const kinds = (Array.isArray(m.k) ? m.k : []).filter((k): k is AttackKind => k === 'ban' || k === 'blur' || k === 'rotate').slice(0, 6);
        kinds.forEach((k) => queue.push(k));
        tickAttacks();
        return;
      }
      case 'won': {
        const ms = Number(m.ms);
        if (!Number.isFinite(ms)) return;
        theirWonMs = ms;
        if (phase === 'playing') finishRemote(false, 'faster');
        return;
      }
      case 'resign':
        if (phase === 'playing' || phase === 'countdown') finishRemote(true, 'resigned');
        return;
    }
  }

  const hasAcct = () => !!currentAccount();

  // Konto mogło się wczytać już po wejściu do pokoju: wtedy dajemy rywalowi znać.
  let announced = false;
  onSyncChange(() => {
    if (!room || !opp || !hasAcct()) return;
    if (!announced) { announced = true; room.send({ t: 'acct' }); }
    sendId();
  });

  /** Mój mail do rywala: raz na pokój i tylko, gdy obaj jesteśmy zalogowani. */
  function sendId() {
    const me = currentAccount();
    if (!room || sentId || !oppAcct || !me?.email) return;
    sentId = true;
    room.send({ t: 'id', who: me.email });
  }

  function newRound() {
    const r = round + 1, seed = Math.floor(rng() * 2 ** 31);
    lastStart = { t: 'start', round: r, seed, level, acct: hasAcct() };
    room?.send(lastStart);
    beginRound(r, seed);
  }

  function beginRound(r: number, seed: number) {
    window.clearInterval(readyTimer);
    window.clearTimeout(goneTimer);
    goneTimer = 0;
    round = r;
    phase = 'countdown';
    myWonMs = theirWonMs = null;
    oppProgress = 0;
    frozenUntil = selfBlurUntil = mistakes = 0;
    queue.clear();
    turns = 0;
    sheet.hidden = true;
    deps.startGame(level, seed);
    startAt = Date.now() + COUNTDOWN_MS;
    runCountdown();
  }

  function runCountdown() {
    countdown.hidden = false;
    const step = () => {
      if (phase !== 'countdown') { countdown.hidden = true; return; }
      const left = startAt - Date.now();
      if (left <= 0) {
        phase = 'playing';
        g().state.elapsedMs = 0; // zegar liczy od „Start!”, nie od odliczania
        countdown.textContent = t('sab.go');
        countdown.classList.add('go');
        window.setTimeout(() => { countdown.hidden = true; countdown.classList.remove('go'); }, 600);
        deps.render();
        return;
      }
      const n = String(Math.ceil(left / 1000));
      if (countdown.textContent !== n) {
        countdown.textContent = n;
        countdown.classList.remove('tick');
        void countdown.offsetWidth;
        countdown.classList.add('tick');
      }
      window.setTimeout(step, 100);
    };
    step();
    deps.render();
  }

  function finishRemote(won: boolean, why: 'faster' | 'resigned' | 'left') {
    if (phase === 'over' || phase === 'idle') return;
    phase = 'over';
    queue.clear();
    deps.onRemoteEnd(won, why);
    deps.render();
  }

  // --- ataki u mnie ---
  function tickAttacks() {
    if (phase !== 'playing') return;
    const started = queue.tick(now(), g().digitCounts(), rng);
    if (!started) return;
    if (started.kind === 'rotate') turns++;
    const label = started.kind === 'ban' ? t('sab.atk.ban', { d: started.digit! }) : t(`sab.atk.${started.kind}`);
    toast(`${ICON[started.kind]} ${label}`, 'hit');
    deps.render();
  }
  window.setInterval(() => {
    if (!inGame()) return;
    const wasActive = queue.active;
    tickAttacks();
    if (wasActive && !queue.active) deps.render();
    if (frozenUntil && now() >= frozenUntil) { frozenUntil = 0; deps.render(); }
    if (selfBlurUntil && now() >= selfBlurUntil) { selfBlurUntil = 0; deps.render(); }
    if (frozenUntil) freezeEl.textContent = `❄ ${Math.ceil((frozenUntil - now()) / 1000)}`;
  }, 150);

  // --- lobby ---
  function drawLobby(error = '') {
    const lv = LEVELS.map((id) => `<button type="button" class="sb-lvl" role="radio" data-lvl="${id}" aria-checked="${id === level}">${t(`lvl.${id}`)}</button>`).join('');
    let body: string;
    if (phase === 'idle') {
      body = `
        <p class="sheet-sub">${t('sab.lobby.sub')}</p>
        <p class="sheet-label">${t('new.level')}</p>
        <div class="segmented sb-lvls">${lv}</div>
        <button type="button" class="btn-accent sb-create">${t('sab.create')}</button>
        <p class="sheet-label">${t('sab.joinLabel')}</p>
        <form class="sb-join">
          <input class="sb-code-input" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" aria-label="${t('sab.joinLabel')}">
          <button type="submit" class="btn-accent">${t('sab.join')}</button>
        </form>`;
    } else if (phase === 'connecting') {
      body = `<p class="sb-status"><span class="spinner"></span>${t('sab.connecting')}</p>`;
    } else {
      const link = `${location.origin}${location.pathname}?pokoj=${code}${location.search.includes('net=local') ? '&net=local' : ''}`;
      body = host ? `
        <p class="sheet-sub">${t('sab.share')}</p>
        <div class="sb-code" aria-label="${t('sab.code')}">${[...code].map((c) => `<i>${c}</i>`).join('')}</div>
        <button type="button" class="btn-quiet sb-copy" data-link="${link}">${t('sab.copy')}</button>
        <p class="sb-status"><span class="spinner"></span>${opp ? t('sab.starting') : t('sab.waiting')}</p>` : `
        <div class="sb-code">${[...code].map((c) => `<i>${c}</i>`).join('')}</div>
        <p class="sb-status"><span class="spinner"></span>${t('sab.waitingHost')}</p>`;
    }
    box.innerHTML = `
      <button class="sheet-x" type="button" aria-label="${t('sheet.close')}" title="${t('sheet.close')}"></button>
      <p class="sheet-label">${t('sab.name')}</p>
      <h2>${phase === 'idle' || phase === 'connecting' ? t('sab.lobby.title') : t('sab.room')}</h2>
      ${error ? `<p class="sb-error">${error}</p>` : ''}
      ${body}
      <button type="button" class="btn-quiet btn-rules-link sb-rules"><span class="ico ico-help"></span><span>${t('new.rules')}</span></button>
      <button type="button" class="btn-quiet sb-close" data-x>${t(phase === 'idle' ? 'new.back' : 'sab.cancel')}</button>`;
    box.querySelectorAll<HTMLElement>('.sb-lvl').forEach((b) => b.addEventListener('click', () => { level = b.dataset.lvl as Level; drawLobby(); }));
    box.querySelector('.sb-create')?.addEventListener('click', () => void connect(makeCode(rng), true));
    const form = box.querySelector<HTMLFormElement>('.sb-join');
    const input = box.querySelector<HTMLInputElement>('.sb-code-input');
    input?.addEventListener('input', () => { input.value = normalizeCode(input.value); });
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = normalizeCode(input!.value);
      if (c.length === 4) void connect(c, false); else input!.focus();
    });
    box.querySelector('.sb-copy')?.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement, link = b.dataset.link!;
      try {
        if (navigator.share) await navigator.share({ title: 'soodoku', text: t('sab.invite', { code }), url: link });
        else { await navigator.clipboard.writeText(link); b.textContent = t('sab.copied'); }
      } catch { /* gracz zamknął okno udostępniania */ }
    });
    box.querySelector('.sb-rules')?.addEventListener('click', () => rulesHook?.());
    box.querySelector('.sb-close')?.addEventListener('click', () => { leave(); sheet.hidden = true; });
  }

  let rulesHook: (() => void) | null = null;

  function leave() {
    if (room && phase !== 'idle') room.send({ t: phase === 'playing' || phase === 'countdown' ? 'resign' : 'bye', round });
    room?.leave();
    room = null;
    window.clearInterval(readyTimer);
    window.clearTimeout(goneTimer);
    goneTimer = 0;
    phase = 'idle';
    opp = null;
    oppAcct = false;
    oppEmail = null;
    sentId = false;
    announced = false;
    round = 0;
    queue.clear();
    hud.hidden = true;
    countdown.hidden = true;
  }

  // --- HUD ---
  function myProgress() {
    const s = g().state;
    const empty = s.puzzle.filter((v) => !v).length;
    const done = s.values.filter((_, i) => !s.puzzle[i] && g().isDone(i)).length;
    return empty ? done / empty : 0;
  }
  function renderHud() {
    hud.hidden = !inGame() || phase === 'idle';
    if (hud.hidden) return;
    const set = (side: string, who: string, p: number) => {
      const s = hud.querySelector(`.${side}`)!;
      s.querySelector('.sb-who')!.textContent = who;
      (s.querySelector('.sb-bar i') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
      s.querySelector('.sb-pct')!.textContent = `${Math.round(p * 100)}%`;
    };
    set('me', t('sab.you'), myProgress());
    set('opp', oppEmail && hasAcct() ? oppEmail.split('@')[0] : t('sab.opp'), oppProgress);
  }

  return {
    openLobby(rules: () => void, preset?: string) {
      rulesHook = rules;
      if (phase === 'over' || phase === 'playing') leave();
      sheet.hidden = false;
      if (preset && phase === 'idle') void connect(normalizeCode(preset), false);
      else drawLobby();
    },
    /** Czy wolno teraz wpisać cyfrę d (odliczanie, zamrożenie, zakazana cyfra). */
    blocked(d: number | null): boolean {
      if (!inGame()) return false;
      if (phase === 'countdown') return true;
      if (frozenUntil && now() < frozenUntil) return true;
      return d !== null && queue.bannedDigit(now()) === d;
    },
    afterMove(_i: number, r: MoveResult) {
      if (!inGame() || phase !== 'playing' || !r.changed) return;
      if (r.wrong) {
        const pen = selfPenalty(++mistakes);
        frozenUntil = now() + pen.freeze;
        if (pen.blur) selfBlurUntil = Math.max(selfBlurUntil, now() + pen.blur);
        const s = pen.freeze / 1000, b = pen.blur / 1000;
        toast(`❄ ${b ? t('sab.frozenBlur', { s, b }) : t('sab.frozen', { s })}`, 'warn');
      }
      room?.send({ t: 'progress', round, p: myProgress() });
      const units = r.won ? [] : r.completedUnits ?? [];
      if (units.length) {
        const kinds = attacksFor(units, rng);
        room?.send({ t: 'atk', round, k: kinds });
        toast(`${t('sab.sent')} ${kinds.map((k) => ICON[k]).join(' ')}`, 'sent');
        hud.querySelector('.opp')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 400 });
      }
      if (r.won) {
        myWonMs = Date.now() - startAt;
        room?.send({ t: 'won', round, ms: myWonMs });
        phase = 'over';
        queue.clear();
      }
    },
    /** Po animacji wygranej: czy na pewno ja byłem pierwszy. */
    confirmWin(): boolean {
      if (myWonMs === null) return true;
      return theirWonMs === null || decideWinner(myWonMs, theirWonMs, host);
    },
    resign() {
      if (!inGame()) return;
      room?.send({ t: 'resign', round });
      phase = 'over';
      queue.clear();
    },
    rematch() {
      if (!room || !opp) { toast(t('sab.oppGone'), 'warn'); return false; }
      if (host) newRound(); else { room.send({ t: 'rematch', acct: hasAcct() }); toast(t('sab.rematchAsked')); }
      return true;
    },
    leave() { leave(); },
    /** Mail rywala do statystyk: tylko gdy obaj gramy zalogowani, inaczej null (= gość). */
    opponentEmail(): string | null { return hasAcct() && oppAcct ? oppEmail : null; },
    get playing() { return inGame() && (phase === 'playing' || phase === 'countdown'); },
    render() {
      const on = inGame();
      renderHud();
      const tn = now();
      deps.board.classList.toggle('sb-blur', on && (queue.blurred(tn) || tn < selfBlurUntil));
      deps.board.style.setProperty('--sb-turns', String(on ? turns : 0));
      deps.board.classList.toggle('sb-rot', on && turns > 0);
      const ban = on ? queue.bannedDigit(tn) : null;
      deps.keys.forEach((k, idx) => {
        k.classList.toggle('sb-ban', ban === idx + 1);
        if (ban === idx + 1) k.disabled = true;
      });
      const frozen = on && !!frozenUntil && tn < frozenUntil;
      deps.keypad.classList.toggle('sb-frozen', frozen);
      freezeEl.hidden = !frozen;
      wrap.classList.toggle('sb-wait', on && phase === 'countdown');
    },
  };
}

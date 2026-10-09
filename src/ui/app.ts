import { CELLS, PEERS, UNITS, colOf, conflicts, rowOf } from '../core/board';
import { randomSeed } from '../core/rng';
import { Game, HINT_LIMIT, MoveResult, SavedGame } from '../game/game';
import { loadGame, loadStats, recordResult, saveGame } from '../game/storage';
import { MODES, GameMode, difficultyLabel } from '../modes';
import { mineCount } from '../modes/saperdoku/engine';
import { createTetrokuView } from '../modes/tetroku/view';
import { createSiegeView } from '../modes/siege/view';
import { createSabotageView } from '../modes/sabotage/view';
import { createDailyView } from '../daily/view';
import { currentStreak, dayKey, loadProgress, markDone } from '../daily/daily';
import { onSyncChange, pushDay, startSync } from '../daily/sync';
import { renderAccountBanner, renderAccountSettings } from './account';
import { FLAGS, LANGS, Lang, applyStatic, getLang, num, onLangChange, setLang, t, tk } from '../i18n';
import { Settings, loadSettings, saveSettings } from './settings';
import { Appearance, THEMES, applyTheme, themeVars, watchSystemTheme } from './themes';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;


export const formatTime = (ms: number) => {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export function startApp(initial: SavedGame | null) {
  const saved = initial ?? loadGame();
  let game = new Game(saved ?? Game.blank());
  let selected: number | null = game.state.tetroku ? -1 : game.state.values.findIndex((v) => !v);
  if (selected < 0) selected = null;
  let notesMode = false;
  let flagMode = false; // Saperdoku: tap w pole stawia flagę
  let paused = false;
  let screen: 'home' | 'game' = 'home';
  let lastTick = performance.now();
  let settings: Settings = loadSettings();

  const applySettings = () => {
    applyTheme(settings.theme, settings.appearance);
    document.documentElement.classList.toggle('motion', settings.motion);
    game.options = { checkMistakes: settings.checkMistakes, autoClearNotes: settings.autoClearNotes };
  };
  applySettings();
  watchSystemTheme(() => { if (settings.appearance === 'auto') applyTheme(settings.theme, 'auto'); });

  const boardEl = $('board');
  const keypadEl = $('keypad');
  const cells: { el: HTMLButtonElement; val: HTMLSpanElement; notes: HTMLSpanElement[]; mc: HTMLSpanElement }[] = [];
  const LONG_PRESS_MS = 450;
  let pressTimer = 0;
  const DOUBLE_TAP_MS = 350;
  let lastTap = { i: -1, t: 0 };

  // --- budowa planszy i klawiatury (raz) ---
  const boxes = [...Array(9)].map(() => {
    const b = document.createElement('div');
    b.className = 'box';
    boardEl.appendChild(b);
    return b;
  });
  for (let i = 0; i < CELLS; i++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cell';
    el.setAttribute('role', 'gridcell');
    el.tabIndex = -1;
    const val = document.createElement('span');
    val.className = 'val';
    const notesEl = document.createElement('span');
    notesEl.className = 'notes';
    const notes = [...Array(9)].map(() => notesEl.appendChild(document.createElement('span')));
    const mc = document.createElement('span');
    mc.className = 'mc'; // Saperdoku: licznik min dookoła
    el.append(val, notesEl, mc);
    el.addEventListener('contextmenu', (e) => {
      if (!game.state.saper) return;
      e.preventDefault();
      select(i);
      flag();
    });
    const cancelPress = () => window.clearTimeout(pressTimer);
    el.addEventListener('pointerup', cancelPress);
    el.addEventListener('pointerleave', cancelPress);
    el.addEventListener('pointercancel', cancelPress);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (game.state.saper) {
        if (e.button === 2) return; // prawy klik obsługuje contextmenu
        if (flagMode) { select(i); flag(); return; }
        cancelPress();
        // Przytrzymanie pola na telefonie też stawia flagę.
        if (e.pointerType !== 'mouse') pressTimer = window.setTimeout(() => { lastTap = { i: -1, t: 0 }; select(i); flag(); }, LONG_PRESS_MS);
      }
      // Szybkie podwójne kliknięcie we wpisaną cyfrę = gumka.
      const now = performance.now();
      const isDouble = lastTap.i === i && now - lastTap.t < DOUBLE_TAP_MS;
      lastTap = { i, t: isDouble ? 0 : now };
      select(i);
      if (isDouble && !game.isGiven(i) && (game.state.values[i] || game.state.notes[i])) erase();
    });
    boxes[Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)].appendChild(el);
    cells.push({ el, val, notes, mc });
  }
  const keys = [...Array(9)].map((_, k) => {
    const d = k + 1;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key';
    b.innerHTML = `<b>${d}</b><small></small>`;
    b.addEventListener('click', () => { input(d); animate(b, 'hit', 0, 180); });
    keypadEl.appendChild(b);
    return b;
  });

  // Tetroku ma własną tackę z klockami zamiast klawiatury; reszta (plansza, notatki, zegar) jest wspólna.
  const tet = createTetrokuView({
    game: () => game, cells, board: boardEl, after: keypadEl, animate,
    commit: () => { persist(); render(); },
    onWin: () => celebrateWin(),
    onLoss: () => lose(),
    running: () => screen === 'game' && !paused && !document.hidden && !document.querySelector('.overlay:not([hidden])'),
    notesMode: () => notesMode,
  });

  // Oblężenie: warstwa z wrogami i murami nad wspólną planszą.
  const siege = createSiegeView({
    game: () => game, cells, board: boardEl, animate,
    persist: () => persist(),
    commit: () => { persist(); render(); },
    onWin: () => celebrateWin(),
    onLoss: () => lose(),
    running: () => screen === 'game' && !paused && !document.hidden && !document.querySelector('.overlay:not([hidden])'),
    selected: () => selected,
  });

  // Sabotaż: pokój z kodem, pasek rywala i ataki. Gra we dwóch nie nadpisuje zapisanej gry solo.
  const sab = createSabotageView({
    game: () => game, board: boardEl, keys, keypad: keypadEl,
    startGame: (difficulty, seed) => startSeeded('sabotage', difficulty, seed),
    onRemoteEnd: (won, why) => remoteEnd(won, why),
    render: () => render(),
    toHome: () => showScreen('home'),
  });
  const isSab = () => game.state.modeId === 'sabotage';

  // Wyzwanie dnia: karta w menu, arkusz z notatką i kalendarz. Gra-wyzwanie siedzi w zwykłym zapisie gry.
  const daily = createDailyView({
    current: () => game,
    canContinue: () => canContinue(),
    launch: (g) => begin(g),
    resume: () => showScreen('game'),
    closeSheets: () => closeSheets(),
    busy: (on) => { $('busy').hidden = !on; },
    formatTime,
    accountBanner: renderAccountBanner,
  });

  // --- render ---
  function render() {
    const s = game.state;
    const selVal = selected !== null ? s.values[selected] : 0;
    const peers = new Set(selected !== null ? PEERS[selected] : []);
    // Czerwona ramka tylko na błędnej cyfrze; poprawna, z którą koliduje, zostaje czysta.
    const conf = settings.checkMistakes ? new Set([...conflicts(s.values)].filter((i) => game.isWrong(i))) : new Set<number>();
    boardEl.classList.toggle('hl-peers', settings.highlightPeers);
    boardEl.classList.toggle('hl-same', settings.highlightSame);
    const sp = s.saper;
    const mineSet = new Set(sp?.mines ?? []);
    for (let i = 0; i < CELLS; i++) {
      const c = cells[i], v = s.values[i];
      const given = game.isGiven(i);
      const flagged = !!sp && game.isFlagged(i);
      c.val.textContent = v ? String(v) : '';
      const cl = c.el.classList;
      cl.toggle('flag', flagged);
      cl.toggle('boom', flagged && sp!.exploded.includes(i));
      // Licznik min pokazują pola startowe i dobrze wpisane.
      const counted = !!sp && !flagged && (given || (v !== 0 && v === s.solution[i]));
      c.mc.textContent = counted ? String(mineCount(mineSet, i)) : '';
      c.mc.dataset.n = counted ? String(mineCount(mineSet, i)) : '';
      cl.toggle('given', given);
      cl.toggle('user', !given && v !== 0);
      cl.toggle('wrong', settings.checkMistakes && game.isWrong(i));
      cl.toggle('conflict', conf.has(i));
      cl.toggle('sel', i === selected);
      cl.toggle('peer', peers.has(i));
      cl.toggle('same', !!selVal && v === selVal && i !== selected);
      const m = v || flagged ? 0 : s.notes[i];
      for (let d = 1; d <= 9; d++) {
        const n = c.notes[d - 1];
        n.textContent = m & (1 << d) ? String(d) : '';
        n.classList.toggle('hit', settings.highlightSame && d === selVal);
      }
      c.el.setAttribute('aria-label', t('cell.label', { r: rowOf(i) + 1, c: colOf(i) + 1, v: flagged ? t('mine.cell') : v || t('cell.empty') }));
    }
    const counts = game.digitCounts();
    // Z widoczną listą min cyfry spod min się nie wpisuje, więc nie liczą się do „zostało”.
    if (sp?.showList) for (const j of sp.mines) counts[s.solution[j]]++;
    keys.forEach((k, idx) => {
      const d = idx + 1;
      k.disabled = counts[d] >= 9;
      k.classList.toggle('match', d === selVal);
      (k.querySelector('small') as HTMLElement).textContent = String(9 - counts[d]);
    });
    renderMines();
    keypadEl.classList.toggle('notes-on', notesMode);
    $('meta-diff').textContent = difficultyLabel(s.modeId, s.difficulty);
    const limit = game.mistakeLimit;
    const mEl = $('meta-mistakes');
    mEl.textContent = limit === null ? String(s.mistakes) : `${s.mistakes}/${limit}`;
    mEl.classList.toggle('bad', s.mistakes > 0);
    // W Oblężeniu błędy kosztują mur, więc osobny licznik tylko zabiera miejsce.
    $('chip-mistakes').hidden = (limit === null && !settings.checkMistakes) || !!s.siege;
    $('chip-timer').classList.toggle('time-hidden', !settings.showTimer);
    $('meta-time').hidden = !settings.showTimer;
    $('meta-mode').textContent = s.daily ? `★ ${game.mode.name}` : game.mode.name;
    $('btn-rules').hidden = !game.mode.rules;
    $('tool-notes').setAttribute('aria-pressed', String(notesMode));
    $('tool-notes').hidden = !game.notesAllowed;
    $('tool-flag').setAttribute('aria-pressed', String(flagMode));
    $<HTMLButtonElement>('tool-undo').disabled = !game.canUndo || s.status !== 'playing';
    const hintBtn = $<HTMLButtonElement>('tool-hint');
    hintBtn.disabled = game.hintsLeft === 0 || s.status !== 'playing' || isSab();
    hintBtn.dataset.left = String(game.hintsLeft);
    hintBtn.title = t('tool.hintsLeft', { n: game.hintsLeft, max: HINT_LIMIT });
    renderTime();
    $('paused').hidden = !paused;
    $('btn-pause').setAttribute('aria-pressed', String(paused));
    $('btn-pause').hidden = isSab();
    $<HTMLButtonElement>('btn-resign').disabled = s.status !== 'playing';
    tet.render();
    siege.render();
    if (sp) $('keys-help').textContent = t('mine.help');
    if (s.siege) $('keys-help').textContent = t('siege.help');
    sab.render();
    if (isSab()) $('keys-help').textContent = t('sab.help');
  }

  /** Saperdoku: licznik min, przełącznik flagi i lista cyfr spod min. */
  function renderMines() {
    const sp = game.state.saper;
    $('chip-mines').hidden = !sp;
    $('tool-flag').hidden = !sp;
    $('tools').classList.toggle('five', !!sp);
    const list = $('mine-list');
    list.hidden = !sp?.showList;
    if (!sp) return;
    $('meta-mines').textContent = String(sp.mines.length - sp.flags.length);
    if (!sp.showList) return;
    // Cyfry spod min rosnąco; oflagowane wygaszone (po jednej sztuce na flagę).
    const found = sp.flags.map((j) => game.state.solution[j]);
    const digits = sp.mines.map((j) => game.state.solution[j]).sort((a, b) => a - b);
    list.innerHTML = `<span>${t('mine.list')}</span>` + digits.map((d) => {
      const k = found.indexOf(d);
      if (k >= 0) found.splice(k, 1);
      return `<b class="${k >= 0 ? 'off' : ''}">${d}</b>`;
    }).join('');
  }
  const renderTime = () => { $('meta-time').textContent = formatTime(game.state.elapsedMs); };

  // --- efekty ---
  function animate(target: number | HTMLElement, cls: string, delay = 0, duration = 750) {
    const el = typeof target === 'number' ? cells[target].el : target;
    el.classList.remove(cls);
    void el.offsetWidth; // restart animacji
    el.style.setProperty('--d', `${delay}ms`);
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), duration + delay);
  }

  function handleResult(i: number, r: MoveResult) {
    if (!r.changed) return;
    if (game.state.siege) siege.afterMove(i, r);
    if (isSab()) sab.afterMove(i, r);
    if (r.boom) animate(i, 'blast', 0, 600);
    else if (r.wrong) animate(i, 'shake'); else animate(i, 'pop');
    for (const u of r.completedUnits ?? []) UNITS[u].forEach((j, k) => animate(j, 'flash', k * 45));
    persist();
    render();
    if (r.won) celebrateWin();
    if (r.lost) lose();
  }

  function celebrateWin() {
    for (let j = 0; j < CELLS; j++) animate(j, 'flash', (rowOf(j) + colOf(j)) * 45);
    window.setTimeout(showWin, settings.motion ? 1100 : 100);
  }

  function lose() {
    recordResult(game.state.modeId, game.state.difficulty, false, game.state.elapsedMs, game.state.tetroku?.score);
    window.setTimeout(showLoss, 350);
  }

  // --- akcje ---
  function select(i: number) {
    if (paused || screen !== 'game') return;
    selected = i;
    render();
  }

  function input(d: number, forceNote = false) {
    if (selected === null || paused) return;
    const i = selected;
    if (sab.blocked(notesMode || forceNote ? null : d)) { animate(keypadEl, 'shake', 0, 400); return; }
    if (notesMode || forceNote || game.state.tetroku) {
      if (game.toggleNote(i, d).changed) { persist(); render(); }
      return;
    }
    handleResult(i, game.place(i, d));
  }

  function erase() {
    if (selected === null || paused) return;
    if (game.erase(selected).changed) { persist(); render(); }
  }

  function undo() {
    if (paused || !game.undo()) return;
    persist();
    render();
  }

  function hint() {
    if (paused || isSab() || game.hintsLeft === 0) return;
    if (game.state.tetroku) { tet.hint(); return; }
    const h = game.hint(selected);
    if (!h) return;
    selected = h.index;
    handleResult(h.index, h.result);
  }

  function toggleNotes() { if (!game.notesAllowed) return; notesMode = !notesMode; if (notesMode) flagMode = false; render(); }
  function toggleFlagMode() { if (!game.state.saper) return; flagMode = !flagMode; if (flagMode) notesMode = false; render(); }

  function flag() {
    if (selected === null || paused || !game.state.saper) return;
    handleResult(selected, game.flag(selected));
  }

  function setPaused(p: boolean) {
    if (game.state.status !== 'playing' || isSab()) p = false;
    paused = p;
    lastTick = performance.now();
    persist();
    render();
  }

  function persist() { if (game.state.puzzle.some(Boolean) && !isSab()) saveGame(game.state); }

  /** Plansza z seeda od gospodarza pokoju (Sabotaż): ta sama u obu graczy. */
  function startSeeded(modeId: string, difficulty: string, seed: number) {
    closeSheets();
    game = Game.create(modeId, difficulty, seed);
    applySettings();
    selected = game.state.values.findIndex((v) => !v);
    notesMode = false;
    flagMode = false;
    paused = false;
    lastTick = performance.now();
    showScreen('game');
  }

  /** Sabotaż: rywal skończył pierwszy, poddał się albo zniknął. */
  function remoteEnd(won: boolean, why: 'faster' | 'resigned' | 'left') {
    const s = game.state;
    if (s.status !== 'playing') return;
    s.status = won ? 'won' : 'lost';
    recordResult(s.modeId, s.difficulty, won, s.elapsedMs);
    closeSheets();
    render();
    showEnd(won, t(`sab.end.${why}`));
  }

  function newGame(modeId: string, difficulty: string) {
    closeSheets();
    $('busy').hidden = false;
    // Daj przeglądarce narysować „Generuję…” zanim zablokujemy ją generatorem.
    window.setTimeout(() => {
      $('busy').hidden = true;
      begin(Game.create(modeId, difficulty, randomSeed()));
    }, 40);
  }

  /** Start świeżej gry (zwykłej albo wyzwania dnia). */
  function begin(next: Game) {
    closeSheets();
    game = next;
    applySettings();
    // W Tetroku nic nie zaznaczamy na start: plansza ma być czysta pod klocki.
    selected = game.state.tetroku ? null : game.state.values.findIndex((v) => !v);
    if (selected !== null && selected < 0) selected = null;
    notesMode = false;
    flagMode = false;
    paused = false;
    lastTick = performance.now();
    persist();
    showScreen('game');
    // Pierwsza gra w trybie z instrukcją: najpierw „Jak grać”.
    if (game.mode.rules && !rulesSeen().includes(game.mode.id)) openRules(game.mode);
  }

  // --- ekrany: menu i gra ---
  const canContinue = () => game.state.status === 'playing' && game.state.puzzle.some(Boolean) && !isSab();

  function showScreen(next: 'home' | 'game') {
    if (next === 'home' && isSab()) {
      // Wyjście z gry we dwóch: opuszczamy pokój i wracamy do zapisanej gry solo.
      sab.leave();
      game = new Game(loadGame() ?? Game.blank());
      applySettings();
      selected = game.state.tetroku ? null : game.state.values.findIndex((v) => !v);
      if (selected !== null && selected < 0) selected = null;
    }
    screen = next;
    $('home').hidden = next !== 'home';
    $('app').hidden = next !== 'game';
    lastTick = performance.now();
    persist();
    if (next === 'home') renderHome(); else render();
    window.scrollTo(0, 0);
  }

  function renderHome() {
    const s = game.state;
    const cont = $<HTMLButtonElement>('btn-continue');
    cont.hidden = !canContinue();
    if (canContinue()) {
      const empty = s.puzzle.filter((v) => !v).length;
      const done = s.values.filter((_, i) => !s.puzzle[i] && game.isDone(i)).length;
      $('continue-what').textContent = `${s.daily ? `★ ${t('daily.title')}: ` : ''}${game.mode.name} · ${difficultyLabel(s.modeId, s.difficulty)}`;
      $('continue-progress').style.width = `${Math.round((done / Math.max(1, empty)) * 100)}%`;
      $('continue-meta').textContent = `${formatTime(s.elapsedMs)} · ${t('home.progress', { p: Math.round((done / Math.max(1, empty)) * 100) })}`;
    }
    daily.renderCard();
    const list = $('mode-cards');
    list.innerHTML = '';
    for (const m of MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mode-card';
      b.disabled = !m.available;
      b.innerHTML = `<span class="mc-top"><strong></strong><em></em></span><span class="mc-desc"></span>${
        m.available ? `<span class="mc-levels">${m.difficulties.map(() => '<i></i>').join('')}</span>` : ''}`;
      (b.querySelector('strong') as HTMLElement).textContent = m.name;
      (b.querySelector('em') as HTMLElement).textContent = m.available ? m.ladder : t('mode.soon');
      (b.querySelector('.mc-desc') as HTMLElement).textContent = m.tagline;
      b.addEventListener('click', () => openNew(m));
      list.appendChild(b);
    }
  }

  // Logo w menu: 3x3 kafelki, akcent przeskakuje po polach.
  const heroMark = $('hero-mark');
  const heroTiles = [...Array(9)].map(() => heroMark.appendChild(document.createElement('i')));
  let heroOn = 4;
  heroTiles[heroOn].className = 'on';
  window.setInterval(() => {
    if (screen !== 'home' || !settings.motion) return;
    heroTiles[heroOn].className = '';
    let next = heroOn;
    while (next === heroOn) next = Math.floor(Math.random() * 9);
    heroOn = next;
    heroTiles[heroOn].className = 'on';
  }, 1400);

  // --- arkusze ---
  function closeSheets() { document.querySelectorAll<HTMLElement>('.overlay').forEach((o) => (o.hidden = true)); }

  function openNew(m: GameMode) {
    if (!m.available) return;
    if (m.id === 'sabotage') { closeSheets(); sab.openLobby(() => openRules(m)); return; }
    $('new-title').textContent = m.name;
    $('new-title').dataset.mode = m.id;
    $('new-sub').textContent = m.tagline;
    const diffList = $('diff-list');
    diffList.innerHTML = '';
    diffList.classList.toggle('three', m.difficulties.length % 3 === 0);
    m.difficulties.forEach((d, level) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'diff';
      const bars = m.difficulties.map((_, n) => `<i${n <= level ? ' class="on"' : ''}></i>`).join('');
      b.innerHTML = `<span class="bars">${bars}</span><b></b><small></small>`;
      (b.querySelector('b') as HTMLElement).textContent = d.label;
      (b.querySelector('small') as HTMLElement).textContent = d.hint;
      b.addEventListener('click', () => newGame(m.id, d.id));
      diffList.appendChild(b);
    });
    $('btn-new-rules').hidden = !m.rules;
    $('sheet-new').hidden = false;
  }

  // --- arkusz „Jak grać” (leży nad innymi arkuszami i zamyka tylko siebie) ---
  const RULES_KEY = 'kratka.rules.v1';
  function rulesSeen(): string[] {
    try { return JSON.parse(localStorage.getItem(RULES_KEY) ?? '[]') as string[]; } catch { return []; }
  }
  function openRules(m: GameMode) {
    if (!m.rules) return;
    const sheet = $('sheet-rules');
    sheet.dataset.mode = m.id;
    $('rules-mode').textContent = m.name;
    $('rules-body').innerHTML = m.rules();
    sheet.hidden = false;
    (sheet.querySelector('.sheet') as HTMLElement).scrollTop = 0;
  }
  function closeRules() {
    const sheet = $('sheet-rules');
    if (sheet.hidden) return;
    sheet.hidden = true;
    const seen = rulesSeen();
    if (sheet.dataset.mode && !seen.includes(sheet.dataset.mode)) {
      try { localStorage.setItem(RULES_KEY, JSON.stringify([...seen, sheet.dataset.mode])); } catch { /* trudno */ }
    }
    lastTick = performance.now();
  }

  function showEnd(won: boolean, sub: string, newBest = false, resigned = false) {
    const s = game.state;
    const sheet = $('sheet-end');
    (sheet.firstElementChild as HTMLElement).classList.toggle('lost', !won);
    $('end-title').textContent = s.modeId === 'sabotage' ? t(won ? 'sab.end.winTitle' : 'sab.end.loseTitle')
      : s.daily && !resigned ? t(won ? 'daily.end.wonTitle' : 'daily.end.lostTitle')
      : t(resigned ? 'end.over' : won ? (newBest ? 'end.record' : 'end.solved') : 'end.lost');
    $('end-sub').textContent = sub;
    $('end-stats').innerHTML = [
      [t('end.time'), formatTime(s.elapsedMs)],
      [t('end.mistakes'), String(s.mistakes)],
      s.tetroku ? [t('end.score'), num(s.tetroku.score)] : [t('end.hints'), String(s.hints)],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const actions = $('end-actions');
    actions.innerHTML = '';
    const add = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.textContent = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
    };
    const label = difficultyLabel(s.modeId, s.difficulty);
    if (s.daily) {
      const day = s.daily.day;
      if (!won && !resigned) add(t('end.continueUnlimited'), 'btn-accent', () => { game.continueAfterLoss(); closeSheets(); persist(); render(); });
      if (won) add(t('daily.end.calendar'), 'btn-accent', () => { showScreen('home'); daily.openCalendar(day); });
      else add(t('daily.retry'), resigned ? 'btn-accent' : 'btn-quiet', () => { showScreen('home'); daily.openDay(day); });
      add(t('end.menu'), 'btn-quiet', () => { closeSheets(); showScreen('home'); });
    } else if (s.modeId === 'sabotage') {
      add(t('sab.end.rematch'), 'btn-accent', () => { sab.rematch(); });
      add(t('end.menu'), 'btn-quiet', () => { closeSheets(); showScreen('home'); });
    } else if (won || resigned) {
      add(t(won ? 'end.again' : 'end.newGame', { level: label }), 'btn-accent', () => newGame(s.modeId, s.difficulty));
      add(t('end.menu'), 'btn-quiet', () => { closeSheets(); showScreen('home'); });
    } else {
      add(t('end.continueUnlimited'), 'btn-accent', () => { game.continueAfterLoss(); closeSheets(); persist(); render(); });
      add(t('end.menu'), 'btn-quiet', () => { closeSheets(); showScreen('home'); });
    }
    sheet.hidden = false;
  }

  function showWin() {
    const s = game.state;
    if (s.daily) {
      if (s.unlimited) return showEnd(true, t('daily.end.unlimited'));
      recordResult(s.modeId, s.difficulty, true, s.elapsedMs, s.tetroku?.score);
      const res = markDone(s.daily.day, dayKey(), { ms: s.elapsedMs, mistakes: s.mistakes, hints: s.hints });
      pushDay(s.daily.day);
      const rec = res.progress[s.daily.day];
      const sub = !res.first ? t('daily.end.replay', { time: formatTime(rec.ms) })
        : res.onTime ? t('daily.end.onTime', { n: currentStreakNow() }) : t('daily.end.late');
      return showEnd(true, sub);
    }
    if (s.unlimited) return showEnd(true, t('end.unlimitedWin'));
    if (s.modeId === 'sabotage') {
      // Obaj skończyli prawie naraz: rozstrzyga czas od startu.
      const won = sab.confirmWin();
      if (!won) s.status = 'lost';
      recordResult(s.modeId, s.difficulty, won, s.elapsedMs);
      return showEnd(won, t(won ? 'sab.end.won' : 'sab.end.faster'));
    }
    const { stats, newBest } = recordResult(s.modeId, s.difficulty, true, s.elapsedMs, s.tetroku?.score);
    if (s.tetroku) {
      const sub = newBest ? t('end.bestScoreTetroku', { level: difficultyLabel(s.modeId, s.difficulty).toLowerCase() }) : t('end.recordScore', { score: num(stats.bestScore ?? 0) });
      return showEnd(true, sub, newBest);
    }
    const best = stats.bestMs !== null ? formatTime(stats.bestMs) : '–';
    showEnd(true, newBest ? t('end.bestTime', { mode: game.mode.name, level: difficultyLabel(s.modeId, s.difficulty).toLowerCase() }) : t('end.recordTime', { time: best }), newBest);
  }
  const currentStreakNow = () => currentStreak(loadProgress(), dayKey());
  const showLoss = () => showEnd(false, game.state.daily ? t('daily.end.loss') : t(game.state.tetroku ? 'end.lossTetroku' : game.state.saper ? 'end.lossSaper' : game.state.siege ? 'end.lossSiege' : 'end.loss'));

  function askResign() {
    if (game.state.status !== 'playing' || screen !== 'game') return;
    closeSheets();
    $('sheet-resign').hidden = false;
  }

  function resign() {
    const s = game.state;
    const counted = !s.unlimited; // po „graj dalej bez limitu” przegrana już się policzyła
    const score = s.tetroku?.score;
    if (isSab()) sab.resign();
    if (!game.resign()) return;
    closeSheets();
    paused = false;
    if (counted) recordResult(s.modeId, s.difficulty, false, s.elapsedMs, score);
    persist();
    render();
    for (let j = 0; j < CELLS; j++) if (!s.puzzle[j]) animate(j, 'pop', (rowOf(j) + colOf(j)) * 20, 400);
    window.setTimeout(() => showEnd(false, t(s.daily ? 'daily.end.resigned' : 'end.resigned'), false, true), settings.motion ? 700 : 100);
  }

  function updateSettings(patch: Partial<Settings>) {
    settings = { ...settings, ...patch };
    saveSettings(settings);
    applySettings();
    if (screen === 'game') render(); else renderHome();
    renderSettings();
  }

  // Etykiety w i18n: toggle.<klucz> i toggle.<klucz>.hint.
  const TOGGLES: (keyof Settings)[] = ['checkMistakes', 'highlightPeers', 'highlightSame', 'autoClearNotes', 'showTimer', 'motion'];

  function renderSettings() {
    renderAccountSettings($('account-label'), $('account-box'));
    const dark = document.documentElement.style.colorScheme === 'dark';
    const themeList = $('theme-list');
    themeList.innerHTML = '';
    for (const t of THEMES) {
      const v = themeVars(t, dark);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('aria-pressed', String(t.id === settings.theme));
      b.style.cssText = `--sw-bg:${v['--surface']};--sw-text:${v['--text']};--sw-cell:${v['--cell']};--sw-accent:${v['--accent']};--sw-g1:${v['--glow-a']};--sw-g2:${v['--glow-b']}`;
      b.innerHTML = `<span class="mini">${['', 'a', '', '', 'g', '', '', '', 'a'].map((c) => `<i class="${c}"></i>`).join('')}</span><span></span>`;
      (b.lastElementChild as HTMLElement).textContent = tk(`theme.${t.id}`);
      b.addEventListener('click', () => updateSettings({ theme: t.id }));
      themeList.appendChild(b);
    }
    const seg = $('appearance');
    seg.innerHTML = '';
    for (const id of ['auto', 'light', 'dark'] as Appearance[]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(settings.appearance === id));
      b.textContent = t(`appearance.${id}`);
      b.addEventListener('click', () => updateSettings({ appearance: id }));
      seg.appendChild(b);
    }
    const list = $('toggle-list');
    list.innerHTML = '';
    for (const key of TOGGLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toggle';
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', String(settings[key]));
      b.innerHTML = `<span>${tk(`toggle.${key}`)}<small>${tk(`toggle.${key}.hint`)}</small></span><i class="switch"></i>`;
      b.addEventListener('click', () => updateSettings({ [key]: !settings[key] } as Partial<Settings>));
      list.appendChild(b);
    }
  }

  function openSettings() {
    renderSettings();
    $('sheet-settings').hidden = false;
  }

  function openStats() {
    const all = loadStats();
    const cell = (v: string) => `<td>${v}</td>`;
    $('stats-body').innerHTML = MODES.filter((m) => m.available).map((m) => {
      const rows = m.difficulties.map((d) => {
        const st = all[`${m.id}:${d.id}`];
        const pct = st && st.played ? Math.round((st.won / st.played) * 100) + '%' : '–';
        const best = m.id === 'tetris' ? (st?.bestScore != null ? num(st.bestScore) : '–') : (st?.bestMs != null ? formatTime(st.bestMs) : '–');
        return `<tr>${cell(d.label)}${cell(String(st?.played ?? 0))}${cell(String(st?.won ?? 0))}${cell(pct)}${cell(best)}</tr>`;
      }).join('');
      return `<p class="sheet-label">${m.name} · ${m.ladder}</p><table class="stats-table"><thead><tr><th>${t('stats.level')}</th><th>${t('stats.played')}</th><th>${t('stats.won')}</th><th>%</th><th>${t('stats.best')}</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join('');
    $('sheet-stats').hidden = false;
  }

  // --- podpięcie przycisków ---
  $('tool-undo').addEventListener('click', undo);
  $('tool-erase').addEventListener('click', erase);
  $('tool-notes').addEventListener('click', toggleNotes);
  $('tool-hint').addEventListener('click', hint);
  $('tool-flag').addEventListener('click', toggleFlagMode);
  $('btn-pause').addEventListener('click', () => setPaused(!paused));
  $('btn-resume').addEventListener('click', () => setPaused(false));
  $('btn-resign').addEventListener('click', askResign);
  $('btn-rules').addEventListener('click', () => openRules(game.mode));
  $('btn-new-rules').addEventListener('click', () => {
    const m = MODES.find((x) => x.id === $('new-title').dataset.mode);
    if (m) openRules(m);
  });
  $('btn-rules-ok').addEventListener('click', closeRules);
  $('btn-resign-paused').addEventListener('click', askResign);
  $('btn-resign-yes').addEventListener('click', resign);
  $('btn-menu').addEventListener('click', () => { if (sab.playing) askResign(); else showScreen('home'); });
  $('btn-continue').addEventListener('click', () => showScreen('game'));
  $('home-stats').addEventListener('click', openStats);
  $('home-settings').addEventListener('click', openSettings);
  $('btn-settings').addEventListener('click', openSettings);
  document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
  document.querySelectorAll<HTMLElement>('.overlay').forEach((o) =>
    o.addEventListener('click', (e) => {
      if (e.target !== o || o.id === 'sheet-end') return;
      if (o.id === 'sheet-rules') closeRules(); else closeSheets();
    }));

  // --- klawiatura ---
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.overlay:not([hidden])')) {
      if (e.key === 'Escape') { if (!$('sheet-rules').hidden) closeRules(); else closeSheets(); }
      return;
    }
    if (screen !== 'game') return;
    if (tet.onKey(e)) return;
    if (e.key === 'Escape') { if (sab.playing) askResign(); else showScreen('home'); return; }
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const digit = /^Digit([1-9])$/.exec(e.code)?.[1] ?? /^Numpad([1-9])$/.exec(e.code)?.[1] ?? (/^[1-9]$/.test(k) ? k : null);
    if (digit) { e.preventDefault(); input(+digit, e.shiftKey); return; }
    const move = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number]>)[k];
    if (move) {
      e.preventDefault();
      const cur = selected ?? 40;
      const r = (rowOf(cur) + move[0] + 9) % 9, c = (colOf(cur) + move[1] + 9) % 9;
      select(r * 9 + c);
      return;
    }
    switch (k.toLowerCase()) {
      case 'backspace': case 'delete': case '0': e.preventDefault(); erase(); break;
      case 'n': toggleNotes(); break;
      case 'h': hint(); break;
      case 'f': flag(); break;
      case 'p': setPaused(!paused); break;
    }
  });

  // Światło za planszą lekko idzie za kursorem/palcem.
  window.addEventListener('pointermove', (e) => {
    if (!settings.motion) return;
    const root = document.documentElement.style;
    root.setProperty('--mx', ((e.clientX / innerWidth) - 0.5).toFixed(3));
    root.setProperty('--my', ((e.clientY / innerHeight) - 0.5).toFixed(3));
  }, { passive: true });

  // --- zegar ---
  window.setInterval(() => {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;
    if (screen !== 'game' || paused || game.state.status !== 'playing' || document.hidden || !$('sheet-rules').hidden) return;
    game.state.elapsedMs += Math.min(dt, 2000);
    renderTime();
    if (Math.floor(game.state.elapsedMs / 5000) !== Math.floor((game.state.elapsedMs - dt) / 5000)) persist();
  }, 500);
  document.addEventListener('visibilitychange', () => {
    lastTick = performance.now();
    if (document.hidden && screen === 'game' && game.state.status === 'playing' && !isSab()) setPaused(true);
  });

  // --- język: dwie flagi w menu i w ustawieniach ---
  function renderLang() {
    for (const box of [$('lang-home'), $('lang-settings')]) {
      box.innerHTML = '';
      for (const l of LANGS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lang-btn';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(getLang() === l));
        b.setAttribute('aria-label', t(`lang.${l}`));
        b.title = t(`lang.${l}`);
        b.innerHTML = `${FLAGS[l]}<span>${l.toUpperCase()}</span>`;
        b.addEventListener('click', () => setLang(l as Lang));
        box.appendChild(b);
      }
    }
  }
  onLangChange(() => {
    renderLang();
    if (!$('sheet-settings').hidden) renderSettings();
    if (!$('sheet-stats').hidden) openStats();
    if (!$('sheet-rules').hidden) openRules(MODES.find((m) => m.id === $('sheet-rules').dataset.mode) ?? game.mode);
    daily.refresh();
    if (!$('sheet-new').hidden && $('new-title').dataset.mode) openNew(MODES.find((m) => m.id === $('new-title').dataset.mode)!);
    if (screen === 'game') render(); else renderHome();
  });
  applyStatic();
  renderLang();

  // Konto Google (opcjonalne): po zalogowaniu postęp wyzwań się synchronizuje, więc odświeżamy, co widać.
  onSyncChange(() => {
    if (!$('sheet-settings').hidden) renderAccountSettings($('account-label'), $('account-box'));
    daily.refresh();
    if (screen === 'home') renderHome();
  });
  startSync();

  showScreen('home');
  // Link z zaproszeniem (?pokoj=KOD) od razu otwiera pokój Sabotażu.
  const invite = new URLSearchParams(location.search).get('pokoj');
  const sabMode = MODES.find((m) => m.id === 'sabotage');
  if (invite && sabMode) sab.openLobby(() => openRules(sabMode), invite);
  return { snapshot: () => game.state };
}

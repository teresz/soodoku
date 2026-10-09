import './tetroku.css';
import { CELLS, UNITS, colOf, rowOf } from '../../core/board';
import { HINT_LIMIT, type Game } from '../../game/game';
import { locale, num, t as tr } from '../../i18n';
import {
  Piece, PieceCell, fallTotal, footprint, hintFor, levelOf, multiplier, place, rotate, setCells, swapHold, tick,
} from './engine';

// Widok Tetroku: kolejka klocków pod planszą, przeciąganie palcem/myszą, klawiatura, pasek opadania.
// Plansza, notatki, zegar i arkusze są wspólne z resztą gry (ui/app.ts).

export interface TetrokuDeps {
  game: () => Game;
  cells: { el: HTMLElement; val: HTMLElement }[];
  board: HTMLElement;
  /** Element, za którym wstawiamy tackę z klockami (klawiatura cyfr). */
  after: HTMLElement;
  animate: (target: number | HTMLElement, cls: string, delay?: number, duration?: number) => void;
  commit: () => void; // zapis + render
  onWin: () => void;
  onLoss: () => void;
  /** Czy gra właśnie się toczy (ekran gry, bez pauzy, bez arkusza, karta widoczna). */
  running: () => boolean;
  notesMode: () => boolean;
}

interface Ghost { piece: Piece; cells: PieceCell[]; r: number; c: number }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement) => {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
};

export function createTetrokuView(deps: TetrokuDeps) {
  const tray = el('div', 'tet-tray');
  tray.hidden = true;
  deps.after.after(tray);
  const fall = el('div', 'tet-fall', tray);
  const fallBar = el('i', '', fall);
  const row = el('div', 'tet-row', tray);
  const queueEl = el('div', 'tet-queue', row);
  const holdEl = el('div', 'tet-hold', row);
  const holdLabel = el('span', 'tet-hold-label', holdEl);
  const holdSlot = el('div', 'tet-slot', holdEl);

  const scoreChip = el('span', 'chip tet-score');
  scoreChip.hidden = true;
  scoreChip.innerHTML = '<span class="tet-score-label"></span> <b>0</b><span class="tet-mult"></span><span class="tet-lives"></span>';
  const mistakesChip = document.getElementById('chip-mistakes');
  mistakesChip?.before(scoreChip);
  const pop = el('div', 'tet-pop', deps.board.parentElement!);

  const help = document.querySelector<HTMLElement>('.keys-help');

  let active = false;
  let ghost: Ghost | null = null;
  let ghostCells: number[] = [];
  let ghostCls = '';
  let kbPiece = 0; // wybrany klocek z klawiatury (indeks w kolejce, -1 = schowek)
  let kbAnchor: { r: number; c: number } | null = null;
  let drag: {
    piece: Piece; pointerId: number; x0: number; y0: number; moved: boolean; touch: boolean;
    float?: HTMLElement; tile: number; overHold: boolean;
  } | null = null;
  let hintTimer = 0;

  const g = () => deps.game();
  const t = () => g().state.tetroku!;
  const allPieces = () => [...t().queue, ...(t().hold ? [t().hold!] : [])];
  const pieceById = (id: number) => allPieces().find((p) => p.id === id) ?? null;
  const playing = () => active && deps.running() && g().state.status === 'playing';

  // --- rysowanie klocków ---

  function drawPiece(p: Piece, into: HTMLElement, cls = '') {
    const { h, w } = { h: Math.max(...p.cells.map((q) => q.r)) + 1, w: Math.max(...p.cells.map((q) => q.c)) + 1 };
    const box = el('div', `tet-piece hue${p.id % 4} ${cls}`, into);
    box.style.setProperty('--w', String(w));
    box.style.setProperty('--h', String(h));
    box.style.setProperty('--m', String(Math.max(w, h, 2)));
    box.dataset.id = String(p.id);
    for (const q of p.cells) {
      const tile = el('span', 'tet-tile', box);
      tile.style.gridRow = String(q.r + 1);
      tile.style.gridColumn = String(q.c + 1);
      tile.textContent = String(q.d);
    }
    box.addEventListener('pointerdown', (e) => startDrag(e, p.id));
    box.addEventListener('contextmenu', (e) => { e.preventDefault(); spin(p.id); });
    return box;
  }

  function renderTray() {
    const s = t();
    const lv = levelOf(s.level);
    queueEl.innerHTML = '';
    queueEl.style.setProperty('--n', String(lv.visible));
    for (let k = 0; k < lv.visible; k++) {
      const slot = el('div', 'tet-slot', queueEl);
      const p = s.queue[k];
      if (p) {
        const box = drawPiece(p, slot, k === 0 && lv.fallMs ? 'front' : '');
        if (kbAnchor && kbPiece === k) box.classList.add('picked');
        if (drag?.piece.id === p.id && drag.moved) box.classList.add('lifted');
      }
    }
    holdEl.hidden = !lv.hold;
    holdSlot.innerHTML = '';
    if (s.hold) {
      const box = drawPiece(s.hold, holdSlot);
      if (kbAnchor && kbPiece === -1) box.classList.add('picked');
      if (drag?.piece.id === s.hold.id && drag.moved) box.classList.add('lifted');
    }
    holdEl.classList.toggle('used', s.holdUsed);
    fall.hidden = lv.fallMs === null;
    holdLabel.textContent = tr('tet.hold');
    (scoreChip.querySelector('.tet-score-label') as HTMLElement).textContent = tr('tet.score');
    (scoreChip.querySelector('b') as HTMLElement).textContent = num(s.score);
    const m = multiplier(s.streak);
    (scoreChip.querySelector('.tet-mult') as HTMLElement).textContent = m > 1 ? `×${m.toLocaleString(locale())}` : '';
    // Życia jako kropki zamiast osobnego licznika błędów (mniej miejsca w pasku na telefonie).
    const limit = g().mistakeLimit;
    const lives = scoreChip.querySelector('.tet-lives') as HTMLElement;
    lives.hidden = limit === null;
    lives.setAttribute('aria-label', tr('tet.lives'));
    if (limit !== null) lives.innerHTML = [...Array(limit)].map((_, k) => `<i${k < limit - g().state.mistakes ? '' : ' class="off"'}></i>`).join('');
    renderFall();
  }

  function renderFall() {
    const total = fallTotal(t());
    if (total === null) return;
    const left = Math.max(0, t().fallLeftMs / total);
    fallBar.style.transform = `scaleX(${left})`;
    fall.classList.toggle('low', left < 0.25);
  }

  // --- cień na planszy ---

  function clearGhost() {
    for (const i of ghostCells) {
      const c = deps.cells[i];
      c.el.classList.remove('tet-ghost', 'tet-hint', 'tet-blocked');
      if (!g().state.values[i]) c.val.textContent = '';
    }
    ghostCells = [];
  }

  function paintGhost(gh: Ghost | null, cls = '') {
    clearGhost();
    ghost = gh;
    ghostCls = cls;
    if (!gh) return;
    const f = footprint(gh.cells, gh.r, gh.c);
    if (!f || f.some((i) => g().state.values[i])) { ghost = null; return; }
    f.forEach((i, k) => {
      const c = deps.cells[i];
      c.el.classList.add('tet-ghost');
      if (cls) c.el.classList.add(cls);
      c.val.textContent = String(gh.cells[k].d);
    });
    ghostCells = f;
  }

  // --- ruchy ---

  function spin(id: number, turns = 1) {
    const p = pieceById(id);
    if (!p || !playing()) return;
    let cells = p.cells;
    for (let k = 0; k < turns; k++) cells = rotate(cells);
    setCells(t(), id, cells);
    deps.commit();
    if (drag?.float && drag.piece.id === id) { drag.piece = pieceById(id)!; buildFloat(); }
    if (kbAnchor) showKbGhost();
  }

  function flyText(text: string, cls = '') {
    pop.textContent = text;
    pop.className = `tet-pop ${cls}`;
    void pop.offsetWidth;
    pop.classList.add('show');
  }

  function drop(p: Piece, cells: PieceCell[], r: number, c: number) {
    clearGhost();
    const res = place(g().state, p, cells, r, c);
    if (res.kind === 'invalid') return;
    if (res.kind === 'wrong') {
      res.cells.forEach((i) => deps.animate(i, 'shake'));
      flyText(tr('tet.miss'), 'bad');
      checkLoss();
      deps.commit();
      return;
    }
    if (kbPiece >= t().queue.length) kbPiece = Math.max(0, t().queue.length - 1);
    if (res.won) g().state.status = 'won';
    deps.commit();
    res.cells.forEach((i) => deps.animate(i, 'pop'));
    // Linie i kwadraty błyskają po kolei; combo dostaje napis.
    const units = res.units;
    units.forEach((u, n) => UNITS[u].forEach((j, k) => deps.animate(j, 'flash', n * 120 + k * 40)));
    if (units.length >= 4) flyText(`TETROKU! +${res.gained}`, 'big');
    else if (units.length >= 2) flyText(tr('tet.combo', { n: units.length, p: res.gained }), 'big');
    else flyText(`+${res.gained}`);
    if (res.won) deps.onWin();
  }

  function checkLoss() {
    const limit = g().mistakeLimit;
    if (limit !== null && g().state.mistakes >= limit && g().state.status === 'playing') {
      g().state.status = 'lost';
      deps.commit();
      deps.onLoss();
    }
  }

  function hold(id: number) {
    if (!playing() || !swapHold(g().state, id)) return;
    deps.commit();
  }

  // --- przeciąganie ---

  function cellSize() {
    return deps.cells[0].el.getBoundingClientRect().width;
  }

  function buildFloat() {
    if (!drag) return;
    drag.float?.remove();
    const f = el('div', 'tet-float', document.body);
    drawPiece(drag.piece, f);
    f.style.setProperty('--float-tile', `${drag.tile}px`);
    drag.float = f;
  }

  function startDrag(e: PointerEvent, id: number) {
    if (!playing() || e.button > 0) return;
    const p = pieceById(id);
    if (!p) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag = { piece: p, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, touch: e.pointerType !== 'mouse', tile: cellSize(), overHold: false };
    kbAnchor = null;
  }

  /** Pole planszy pod punktem (x, y), albo -1. */
  function cellAt(x: number, y: number) {
    for (let i = 0; i < CELLS; i++) {
      const r = deps.cells[i].el.getBoundingClientRect();
      if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) return i;
    }
    return -1;
  }

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
    if (!drag.moved) { drag.moved = true; buildFloat(); renderTray(); }
    const f = drag.float!;
    const p = drag.piece;
    const w = Math.max(...p.cells.map((q) => q.c)) + 1, h = Math.max(...p.cells.map((q) => q.r)) + 1;
    const step = drag.tile * 1.06;
    // Na dotyku klocek wisi nad palcem, żeby go było widać.
    const left = e.clientX - (w * step) / 2;
    const top = e.clientY - (h * step) / 2 - (drag.touch ? h * step / 2 + drag.tile * 1.1 : 0);
    f.style.transform = `translate(${left}px, ${top}px)`;
    const hb = holdEl.getBoundingClientRect();
    drag.overHold = !holdEl.hidden && e.clientX >= hb.left && e.clientX <= hb.right && e.clientY >= hb.top && e.clientY <= hb.bottom;
    holdEl.classList.toggle('over', drag.overHold);
    // Kotwica: środek pierwszego pola klocka.
    const q0 = p.cells[0];
    const i = cellAt(left + (q0.c + 0.5) * step, top + (q0.r + 0.5) * step);
    paintGhost(i < 0 || drag.overHold ? null : { piece: p, cells: p.cells, r: rowOf(i) - q0.r, c: colOf(i) - q0.c });
  });

  const endDrag = (e: PointerEvent, cancel = false) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    d.float?.remove();
    holdEl.classList.remove('over');
    if (cancel) { clearGhost(); renderTray(); return; }
    if (!d.moved) { spin(d.piece.id); return; }
    if (d.overHold) { clearGhost(); hold(d.piece.id); renderTray(); return; }
    const gh = ghost;
    if (gh && playing()) drop(gh.piece, gh.cells, gh.r, gh.c);
    else { clearGhost(); renderTray(); }
  };
  window.addEventListener('pointerup', (e) => endDrag(e));
  window.addEventListener('pointercancel', (e) => endDrag(e, true));
  window.addEventListener('wheel', (e) => { if (drag?.moved) { e.preventDefault(); spin(drag.piece.id, e.deltaY > 0 ? 1 : 3); } }, { passive: false });

  // --- klawiatura ---

  function kbSelected(): Piece | null {
    return kbPiece === -1 ? t().hold : t().queue[kbPiece] ?? t().queue[0] ?? t().hold;
  }

  function showKbGhost() {
    const p = kbSelected();
    if (!p || !kbAnchor) { paintGhost(null); renderTray(); return; }
    const { h, w } = { h: Math.max(...p.cells.map((q) => q.r)) + 1, w: Math.max(...p.cells.map((q) => q.c)) + 1 };
    kbAnchor.r = Math.min(Math.max(0, kbAnchor.r), 9 - h);
    kbAnchor.c = Math.min(Math.max(0, kbAnchor.c), 9 - w);
    clearGhost();
    paintGhost({ piece: p, cells: p.cells, ...kbAnchor });
    // Na zajętych polach cienia nie ma, ale ramkę wyboru pokazujemy zawsze.
    if (!ghost) footprint(p.cells, kbAnchor.r, kbAnchor.c)?.forEach((i) => { deps.cells[i].el.classList.add('tet-ghost', 'tet-blocked'); ghostCells.push(i); });
    renderTray();
  }

  function onKey(e: KeyboardEvent): boolean {
    if (!active || deps.notesMode() || !playing()) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key.toLowerCase();
    const n = /^Digit([1-9])$/.exec(e.code)?.[1] ?? (/^[1-9]$/.test(k) ? k : null);
    if (n && +n <= levelOf(t().level).visible) {
      kbPiece = +n - 1;
      kbAnchor ??= { r: 3, c: 3 };
      showKbGhost();
      return true;
    }
    const move = ({ arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] } as Record<string, [number, number]>)[k];
    if (move) {
      e.preventDefault();
      if (!kbAnchor) kbAnchor = { r: 3, c: 3 };
      else { kbAnchor.r += move[0]; kbAnchor.c += move[1]; }
      showKbGhost();
      return true;
    }
    const p = kbSelected();
    switch (k) {
      case 'x': case 'r': if (p) spin(p.id); return true;
      case 'z': if (p) spin(p.id, 3); return true;
      case 'c':
        if (p && kbPiece !== -1) hold(p.id);
        else if (t().hold) kbPiece = -1;
        if (kbAnchor) showKbGhost();
        return true;
      case 'tab': {
        e.preventDefault();
        const max = t().queue.length - 1;
        kbPiece = kbPiece === -1 ? 0 : kbPiece >= max ? (t().hold ? -1 : 0) : kbPiece + 1;
        kbAnchor ??= { r: 3, c: 3 };
        showKbGhost();
        return true;
      }
      case ' ': case 'enter':
        e.preventDefault();
        if (ghost && kbAnchor) drop(ghost.piece, ghost.cells, ghost.r, ghost.c);
        return true;
      case 'escape':
        if (kbAnchor) { kbAnchor = null; clearGhost(); renderTray(); return true; }
        return false;
    }
    return false;
  }

  // --- podpowiedź ---

  function hint(): boolean {
    if (!playing()) return false;
    const p = kbAnchor ? kbSelected() : t().queue[0] ?? t().hold;
    if (!p) return false;
    const fit = hintFor(g().state, p, HINT_LIMIT);
    if (!fit) return false;
    setCells(t(), p.id, fit.cells);
    deps.commit();
    paintGhost({ piece: p, cells: fit.cells, r: fit.r, c: fit.c }, 'tet-hint');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { if (ghost?.piece.id === p.id && !drag) clearGhost(); }, 1600);
    return true;
  }

  // --- czas ---

  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(now - last, 250);
    last = now;
    if (playing() && !drag?.moved && fallTotal(t()) !== null) {
      const fallen = tick(g().state, dt);
      if (fallen) {
        flyText(tr('tet.fell'), 'bad');
        deps.board.classList.remove('tet-hit');
        void deps.board.offsetWidth;
        deps.board.classList.add('tet-hit');
        if (kbPiece >= t().queue.length) kbPiece = 0;
        deps.commit();
        checkLoss();
      } else renderFall();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    get active() { return active; },
    /** Wołane na końcu render() aplikacji. */
    render() {
      active = !!g().state.tetroku;
      const notes = deps.notesMode();
      tray.hidden = !active || notes;
      deps.after.hidden = active && !notes;
      scoreChip.hidden = !active;
      if (active && mistakesChip) mistakesChip.hidden = true;
      document.body.classList.toggle('tetroku', active);
      if (help) help.textContent = tr(active ? 'tet.help' : 'help.keys');
      if (!active) { clearGhost(); return; }
      renderTray();
      // render() aplikacji wyczyścił cyfry pustych pól, więc cień malujemy od nowa.
      if (ghost) paintGhost(ghost, ghostCls);
    },
    onKey,
    hint,
  };
}

export type TetrokuView = ReturnType<typeof createTetrokuView>;

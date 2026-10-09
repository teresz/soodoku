import { CELLS, UNITS } from '../../core/board';
import type { Game, MoveResult } from '../../game/game';
import { t as tr } from '../../i18n';
import { FALLS_TO_LOSE, Foe, ShotEvent, SiegeEvent, levelOf, onMove, tick, waveOf } from './engine';

// Widok Oblężenia: warstwa nad planszą z wrogami, murami, strzałami i laserami.
// Plansza, klawiatura, notatki, zegar i arkusze są wspólne z resztą gry (ui/app.ts).

export interface SiegeDeps {
  game: () => Game;
  cells: { el: HTMLElement }[];
  board: HTMLElement;
  animate: (target: number | HTMLElement, cls: string, delay?: number, duration?: number) => void;
  persist: () => void;
  commit: () => void; // zapis + render
  onWin: () => void;
  onLoss: () => void;
  /** Czy gra właśnie się toczy (ekran gry, bez pauzy, bez arkusza, karta widoczna). */
  running: () => boolean;
  selected: () => number | null;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement) => {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
};

// Miejsca na górnej krawędzi kwadratu (na liniach siatki, żeby jak najmniej zasłaniać cyfry).
const SLOTS = [1 / 3, 2 / 3, 1 / 6, 5 / 6, 1 / 2, 0.04];

export function createSiegeView(deps: SiegeDeps) {
  const wrap = deps.board.parentElement!;
  const layer = el('div', 'sg-layer');
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  deps.board.after(layer);
  const boxes = [...Array(9)].map((_, b) => {
    const box = el('div', 'sg-box', layer);
    box.style.setProperty('--r', String(Math.floor(b / 3)));
    box.style.setProperty('--c', String(b % 3));
    const wall = el('span', 'sg-wall', box);
    const badge = el('span', 'sg-badge', box);
    return { box, wall, badge };
  });
  const fx = el('div', 'sg-fx', layer);

  const chip = el('span', 'chip sg-chip');
  chip.hidden = true;
  chip.innerHTML = '<span class="sg-wave-label"></span> <b class="sg-wave">1</b><span class="sg-castles"></span>';
  document.getElementById('chip-mistakes')?.before(chip);

  const foeEls = new Map<number, HTMLElement>();
  let active = false;
  let last = performance.now();
  let sinceSave = 0;

  const g = () => deps.game();
  const st = () => g().state;
  const sg = () => st().siege!;
  const motion = () => document.documentElement.classList.contains('motion');
  const playing = () => active && deps.running() && st().status === 'playing';

  // --- geometria: wszystko w pikselach względem warstwy ---
  const rectIn = (e: Element) => {
    const a = e.getBoundingClientRect(), b = layer.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, h: a.height };
  };
  const cellCenter = (i: number) => rectIn(deps.cells[i].el);
  const foeCenter = (f: Foe) => { const e = foeEls.get(f.id); return e ? rectIn(e) : rectIn(boxes[f.box].box); };

  // --- wrogowie ---
  function foeEl(f: Foe) {
    let e = foeEls.get(f.id);
    if (e) return e;
    e = el('div', `sg-foe hp${f.maxHp}`, layer);
    e.innerHTML = '<i class="sg-ring"></i><span class="sg-body"><i class="sg-eye"></i><i class="sg-eye"></i><i class="sg-mouth"></i></span><span class="sg-hp"></span>';
    foeEls.set(f.id, e);
    if (motion()) e.animate(
      [{ transform: 'translate(-50%, -160%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: .7 }, { transform: 'translate(-50%, -50%) scale(1)' }],
      { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.3)' },
    );
    return e;
  }

  function placeFoes() {
    const s = sg();
    const byBox = new Map<number, Foe[]>();
    for (const f of s.foes) byBox.set(f.box, [...(byBox.get(f.box) ?? []), f]);
    for (const [box, foes] of byBox) {
      foes.sort((a, b) => a.id - b.id).forEach((f, k) => {
        const e = foeEl(f);
        e.style.setProperty('--r', String(Math.floor(box / 3)));
        e.style.setProperty('--c', String(box % 3));
        e.style.setProperty('--x', String(SLOTS[k % SLOTS.length]));
        e.querySelector('.sg-hp')!.innerHTML = '<i></i>'.repeat(f.hp);
        // Potwór siedzi na linii między kwadratami: blednie, gdy zaznaczone pole leży tuż pod nim albo nad nim.
        const sel = deps.selected();
        const r0 = Math.floor(box / 3) * 3, cx = (box % 3) * 3 + SLOTS[k % SLOTS.length] * 3;
        const near = sel !== null && sel >= 0 && Math.abs(Math.floor(sel / 9) + 0.5 - r0) <= 1 && Math.abs((sel % 9) + 0.5 - cx) <= 1.2;
        e.classList.toggle('peek', near);
      });
    }
    // Wrogowie, których już nie ma w stanie (np. po upadku zamku albo poddaniu), znikają po cichu.
    for (const [id, e] of foeEls) if (!s.foes.some((f) => f.id === id) && !e.classList.contains('dying')) { e.remove(); foeEls.delete(id); }
  }

  /** Co klatkę: pierścienie szturmu i poświata zagrożenia na kwadratach. */
  function paintProgress() {
    const s = sg();
    const threat = new Array(9).fill(0);
    for (const f of s.foes) {
      const p = 1 - Math.max(0, f.leftMs) / f.chargeMs;
      threat[f.box] = Math.max(threat[f.box], p);
      const e = foeEls.get(f.id);
      if (!e) continue;
      e.style.setProperty('--p', p.toFixed(3));
      e.classList.toggle('angry', p > 0.72);
    }
    boxes.forEach((b, k) => { b.box.style.setProperty('--threat', threat[k].toFixed(3)); b.box.classList.toggle('danger', threat[k] > 0.85); });
    wrap.classList.toggle('sg-danger', threat.some((p) => p > 0.8));
  }

  // --- efekty ---
  function particles(x: number, y: number, n: number, cls: string, spread = 1) {
    if (!motion()) return;
    for (let k = 0; k < n; k++) {
      const p = el('i', `sg-spark ${cls}`, fx);
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      const a = (Math.PI * 2 * k) / n + Math.random() * 0.6, d = (18 + Math.random() * 26) * spread;
      p.animate(
        [{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
        { duration: 420 + Math.random() * 260, easing: 'cubic-bezier(.1,.7,.3,1)' },
      ).onfinish = () => p.remove();
    }
  }

  function floatText(x: number, y: number, text: string, cls: string) {
    if (!motion()) return;
    const f = el('span', `sg-float ${cls}`, fx);
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.animate(
      [{ transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -110%) scale(1.1)', opacity: 1, offset: .25 }, { transform: 'translate(-50%, -220%) scale(1)', opacity: 0 }],
      { duration: 900, easing: 'ease-out' },
    ).onfinish = () => f.remove();
  }

  function killFoe(f: Foe, delay = 0) {
    const e = foeEls.get(f.id);
    if (!e) return;
    foeEls.delete(f.id);
    e.classList.add('dying');
    const go = () => {
      const c = rectIn(e);
      particles(c.x, c.y, 12, `hp${f.maxHp}`, 1.3);
      if (!motion()) { e.remove(); return; }
      e.animate(
        [{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(1.6) rotate(-12deg)', opacity: 0 }],
        { duration: 280, easing: 'ease-out' },
      ).onfinish = () => e.remove();
    };
    if (delay) window.setTimeout(go, delay); else go();
  }

  function bolt(from: number, to: { x: number; y: number }, onHit: () => void) {
    const a = cellCenter(from);
    if (!motion()) { onHit(); return; }
    const b = el('i', 'sg-bolt', fx);
    b.style.left = `${a.x}px`;
    b.style.top = `${a.y}px`;
    const dx = to.x - a.x, dy = to.y - a.y;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    b.animate(
      [{ transform: `translate(-50%, -50%) rotate(${ang}deg) scale(.4, .4)` }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${ang}deg) scale(1.4, .8)` }],
      { duration: 230, easing: 'cubic-bezier(.5,0,.9,.6)' },
    ).onfinish = () => { b.remove(); onHit(); };
    particles(a.x, a.y, 5, 'muzzle', 0.5);
  }

  function laser(unit: number, onDone: () => void) {
    if (!motion()) { onDone(); return; }
    const row = unit < 9;
    const ref = cellCenter(row ? unit * 9 : unit - 9);
    const beam = el('i', `sg-laser ${row ? 'row' : 'col'}`, fx);
    if (row) beam.style.top = `${ref.y}px`; else beam.style.left = `${ref.x}px`;
    beam.animate(
      [{ transform: row ? 'translateY(-50%) scaleX(0)' : 'translateX(-50%) scaleY(0)', opacity: 1 },
        { transform: row ? 'translateY(-50%) scaleX(1)' : 'translateX(-50%) scaleY(1)', opacity: 1, offset: .35 },
        { transform: row ? 'translateY(-50%) scaleX(1) scaleY(.2)' : 'translateX(-50%) scaleY(1) scaleX(.2)', opacity: 0 }],
      { duration: 620, easing: 'ease-out' },
    ).onfinish = () => beam.remove();
    window.setTimeout(onDone, 200);
  }

  function banner(text: string, cls = '') {
    if (!motion()) return;
    const b = el('div', `sg-banner ${cls}`, fx);
    b.innerHTML = `<span></span>`;
    b.firstElementChild!.textContent = text;
    b.animate(
      [{ opacity: 0, transform: 'translate(-50%, -50%) scale(1.6)', letterSpacing: '.6em' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', letterSpacing: '.18em', offset: .2 },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .75 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(.9)' }],
      { duration: 1500, easing: 'ease-out' },
    ).onfinish = () => b.remove();
  }

  const quake = (strong = false) => { if (motion()) deps.animate(wrap, strong ? 'sg-quake-big' : 'sg-quake', 0, strong ? 600 : 400); };
  const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* bez wibracji */ } };

  // --- zdarzenia silnika ---
  function handleEvents(events: SiegeEvent[]) {
    let dirty = false;
    for (const ev of events) {
      if (ev.type === 'spawn') {
        placeFoes();
        if (ev.newWave) banner(tr('siege.wave', { n: ev.wave }));
        dirty = true;
      } else if (ev.type === 'strike') {
        const e = foeEls.get(ev.foe.id);
        const target = rectIn(boxes[ev.box].box);
        foeEls.delete(ev.foe.id);
        if (e && motion()) {
          const from = rectIn(e);
          e.classList.add('dying');
          e.animate(
            [{ transform: 'translate(-50%, -50%) scale(1)' }, { transform: 'translate(-50%, -80%) scale(1.25)', offset: .35 },
              { transform: `translate(calc(-50% + ${target.x - from.x}px), calc(-50% + ${target.y - from.y}px)) scale(.6)`, opacity: .9 }],
            { duration: 380, easing: 'cubic-bezier(.6,0,.9,.5)' },
          ).onfinish = () => { e.remove(); particles(target.x, target.y, 14, 'rubble', 1.6); };
        } else e?.remove();
        deps.animate(boxes[ev.box].box, 'hit', 300, 700);
        floatText(target.x, target.y, `−${ev.damage}`, ev.damage > 1 ? 'bad big' : 'bad');
        window.setTimeout(() => quake(ev.damage > 1), 300);
        buzz(60 * ev.damage);
        dirty = true;
      } else if (ev.type === 'fall') {
        const b = rectIn(boxes[ev.box].box);
        deps.animate(boxes[ev.box].box, 'crumble', 250, 1200);
        ev.cells.forEach((i, k) => deps.animate(i, 'sg-ruin-in', 300 + k * 60, 500));
        window.setTimeout(() => { particles(b.x, b.y, 22, 'rubble', 2.4); quake(true); }, 250);
        banner(tr('siege.fallen'), 'bad');
        buzz(250);
        dirty = true;
      } else if (ev.type === 'lost') {
        deps.commit();
        deps.onLoss();
        return;
      }
    }
    if (dirty) {
      // Upadek zamku mógł dopełnić ostatnie pola planszy.
      const s = st();
      if (s.status === 'playing' && s.values.every((v, i) => v === s.solution[i])) {
        s.status = 'won';
        deps.commit();
        deps.onWin();
        return;
      }
      deps.commit();
    }
  }

  function handleShots(shots: ShotEvent[]) {
    for (const s of shots) {
      if (s.type === 'shot') {
        const e = foeEls.get(s.foe.id);
        const to = foeCenter(s.foe);
        bolt(s.from, to, () => {
          particles(to.x, to.y, 7, 'hit', 0.8);
          if (s.killed) { killFoe(s.foe); floatText(to.x, to.y, '✦', 'good'); }
          else if (e) {
            e.querySelector('.sg-hp')!.innerHTML = '<i></i>'.repeat(s.foe.hp);
            deps.animate(e, 'ouch', 0, 300);
          }
        });
        if (!motion() && s.killed) killFoe(s.foe);
      } else if (s.type === 'laser') {
        laser(s.unit, () => s.foes.forEach((f, k) => killFoe(f, k * 70)));
      } else if (s.type === 'fortress') {
        const b = boxes[s.box].box;
        deps.animate(b, 'raise', 0, 900);
        const c = rectIn(b);
        particles(c.x, c.y, 16, 'gold', 2);
        s.foes.forEach((f, k) => killFoe(f, 150 + k * 80));
        floatText(c.x, c.y, tr('siege.fortress'), 'gold');
      } else if (s.type === 'backfire') {
        const b = boxes[s.box].box;
        deps.animate(b, 'hit', 0, 700);
        const c = cellCenter(s.from);
        particles(c.x, c.y, 8, 'rubble', 0.9);
        floatText(c.x, c.y, '−1', 'bad');
        quake();
        buzz(60);
      }
    }
  }

  // --- pętla czasu ---
  function frame(now: number) {
    const dt = Math.min(now - last, 100);
    last = now;
    if (playing()) {
      const events = tick(st(), dt);
      if (events.length) handleEvents(events);
      paintProgress();
      sinceSave += dt;
      if (sinceSave > 2000) { sinceSave = 0; deps.persist(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- render (wołany przez app.render) ---
  function render() {
    const s = st();
    active = !!s.siege;
    layer.hidden = !active;
    chip.hidden = !active;
    wrap.classList.toggle('siege', active);
    const ruins = new Set(active ? sg().ruins : []);
    for (let i = 0; i < CELLS; i++) deps.cells[i].el.classList.toggle('ruin', ruins.has(i));
    if (!active) {
      for (const e of foeEls.values()) e.remove();
      foeEls.clear();
      wrap.classList.remove('sg-danger');
      return;
    }
    const sgs = sg();
    const lv = levelOf(sgs.level);
    boxes.forEach((b, k) => {
      const fallen = sgs.fallen.includes(k);
      const fortress = !fallen && UNITS[18 + k].every((i) => s.values[i] === s.solution[i]);
      b.box.classList.toggle('fallen', fallen);
      b.box.classList.toggle('fortress', fortress);
      b.wall.innerHTML = fallen || fortress ? '' : [...Array(lv.wall)].map((_, n) => `<i class="${n < sgs.walls[k] ? 'on' : ''}"></i>`).join('');
      b.badge.textContent = fallen ? '✕' : fortress ? '★' : '';
    });
    (chip.querySelector('.sg-wave-label') as HTMLElement).textContent = tr('siege.waveLabel');
    (chip.querySelector('.sg-wave') as HTMLElement).textContent = String(Math.max(1, waveOf(sgs)));
    const left = FALLS_TO_LOSE - sgs.fallen.length;
    const castles = chip.querySelector('.sg-castles') as HTMLElement;
    castles.innerHTML = [...Array(FALLS_TO_LOSE)].map((_, n) => `<svg class="${n < left ? 'on' : ''}" viewBox="0 0 12 12"><path d="M1 1h2v1.5h1.5V1h3v1.5H9V1h2v4l-1.5 1v4H11v2H1v-2h1.5V6L1 5z"/></svg>`).join('');
    castles.title = tr('siege.castlesLeft', { n: Math.max(0, left) });
    if (s.status !== 'playing') for (const e of foeEls.values()) if (!e.classList.contains('dying')) e.classList.add('frozen');
    placeFoes();
    paintProgress();
  }

  return {
    render,
    /** Po każdym ruchu gracza w Oblężeniu (wpis, podpowiedź). */
    afterMove(i: number, r: MoveResult) {
      if (!active || !r.changed) return;
      const s = st();
      if (!s.values[i]) return;
      const correct = s.values[i] === s.solution[i];
      const { shots, events } = onMove(s, i, correct, r.completedUnits);
      handleShots(shots);
      if (events.length) handleEvents(events);
    },
  };
}

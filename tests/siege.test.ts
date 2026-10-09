import { describe, expect, it } from 'vitest';
import { boxOf } from '../src/core/board';
import { rate } from '../src/core/logic';
import { Game } from '../src/game/game';
import { BOX_CELLS, FALLS_TO_LOSE, LEVELS, boxesWithMove, onMove, tick } from '../src/modes/siege/engine';
import { siege } from '../src/modes/siege';

const empty = (g: Game, box: number) => BOX_CELLS[box].find((i) => !g.state.values[i])!;

describe('Oblężenie', () => {
  it('plansze da się rozwiązać samą logiką na każdym poziomie', () => {
    for (const l of LEVELS) {
      const g = Game.create('siege', l.id, 11);
      expect(g.state.siege!.walls).toEqual(new Array(9).fill(l.wall));
      expect(rate(g.state.puzzle).solved).toBe(true);
    }
  });

  it('wróg przychodzi tam, gdzie da się coś wpisać, i po szturmie zbija mur', () => {
    const g = Game.create('siege', 's1', 3);
    const s = g.state, sg = s.siege!;
    const ev = tick(s, 6000);
    expect(ev[0]?.type).toBe('spawn');
    const foe = sg.foes[0];
    expect(boxesWithMove(s).has(foe.box)).toBe(true);
    const out = tick(s, foe.chargeMs + 1);
    expect(out.some((e) => e.type === 'strike')).toBe(true);
    expect(sg.walls[foe.box]).toBe(LEVELS[0].wall - 1);
  });

  it('dobra cyfra strzela w szturmującego, zła rani własny mur', () => {
    const g = Game.create('siege', 's2', 5);
    const s = g.state, sg = s.siege!;
    tick(s, 6000);
    const foe = sg.foes[0];
    foe.hp = foe.maxHp = 1;
    const i = empty(g, foe.box);
    g.place(i, s.solution[i]);
    const { shots } = onMove(s, i, true);
    expect(shots[0]).toMatchObject({ type: 'shot', killed: true });
    expect(sg.foes).toHaveLength(0);
    expect(sg.killed).toBe(1);

    const j = empty(g, foe.box);
    const wrong = (s.solution[j] % 9) + 1;
    g.place(j, wrong);
    onMove(s, j, false);
    expect(sg.walls[boxOf(j)]).toBe(LEVELS[1].wall - 1);
  });

  it('upadły zamek zamienia się w ruiny, trzeci upadek to przegrana', () => {
    const g = Game.create('siege', 's4', 9);
    const s = g.state, sg = s.siege!;
    const open = [...Array(9).keys()].filter((b) => BOX_CELLS[b].some((i) => !s.values[i]));
    for (let k = 0; k < FALLS_TO_LOSE; k++) {
      const box = open[k];
      sg.walls[box] = 1;
      const i = empty(g, box);
      g.place(i, (s.solution[i] % 9) + 1);
      const { events } = onMove(s, i, false);
      expect(events.some((e) => e.type === 'fall')).toBe(true);
      expect(BOX_CELLS[box].every((c) => s.values[c] === s.solution[c])).toBe(true);
      expect(g.isGiven(i)).toBe(true);
    }
    expect(s.status).toBe('lost');
    g.continueAfterLoss();
    tick(s, 60000);
    expect(sg.foes).toHaveLength(0);
  });

  it('pełny kwadrat to twierdza: szturmujący giną, nikt go już nie atakuje', () => {
    const g = Game.create('siege', 's1', 21);
    const s = g.state, sg = s.siege!;
    const box = 0;
    sg.foes.push({ id: 99, box, hp: 3, maxHp: 3, chargeMs: 30000, leftMs: 30000 });
    const cells = BOX_CELLS[box].filter((i) => !s.values[i]);
    let last;
    for (const i of cells) { last = g.place(i, s.solution[i]); }
    const { shots } = onMove(s, cells[cells.length - 1], true, last!.completedUnits);
    expect(shots.some((x) => x.type === 'fortress')).toBe(true);
    expect(sg.foes.some((f) => f.box === box)).toBe(false);
  });

  it('twardszy potwór zbija tyle punktów muru, ile miał żyć', () => {
    const g = Game.create('siege', 's4', 13);
    const s = g.state, sg = s.siege!;
    sg.spawnLeftMs = 1e9;
    const box = 4;
    sg.walls[box] = 3;
    sg.foes.push({ id: 90, box, hp: 1, maxHp: 2, chargeMs: 1000, leftMs: 10 });
    const ev = tick(s, 50);
    expect(ev.find((e) => e.type === 'strike')).toMatchObject({ damage: 2, wall: 1 });
    expect(sg.walls[box]).toBe(1);
  });

  it('twardsi wrogowie ładują dłużej (średnio)', () => {
    const avg: Record<number, number[]> = { 1: [], 2: [], 3: [] };
    for (let seed = 1; seed < 40; seed++) {
      const g = Game.create('siege', 's4', seed);
      for (let k = 0; k < 6; k++) for (const e of tick(g.state, 9600)) if (e.type === 'spawn') avg[e.foe.maxHp].push(e.foe.chargeMs);
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(avg[2]) / mean(avg[1])).toBeGreaterThan(1.35);
    expect(mean(avg[3]) / mean(avg[1])).toBeGreaterThan(1.8);
  });

  it('ma instrukcję z legendą potworów', () => {
    expect(siege.rules!()).toContain('sg-foe');
  });
});

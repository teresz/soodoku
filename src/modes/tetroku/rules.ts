import { t } from '../../i18n';
import { RULE_ICONS, rulesSheet } from '../rules';

// Instrukcja Tetroku. Klocki, pasek opadania i schowek to te same klasy co w tacce pod planszą.

type Tile = [r: number, c: number, d: number];

const piece = (tiles: Tile[], hue = 0, cls = '') => {
  const w = Math.max(...tiles.map(([, c]) => c)) + 1;
  const h = Math.max(...tiles.map(([r]) => r)) + 1;
  const cells = tiles.map(([r, c, d]) => `<span class="tet-tile" style="grid-row:${r + 1};grid-column:${c + 1}">${d}</span>`).join('');
  return `<span class="tet-piece sr-piece hue${hue} ${cls}" style="--w:${w};--h:${h}">${cells}</span>`;
};

// Przykład z pierwszej sekcji: kwadrat z dziurą w kształcie L i klocek, który do niej pasuje (brakuje 2, 4, 9).
const L: Tile[] = [[0, 1, 4], [1, 0, 9], [1, 1, 2]];
const BOARD = [5, 0, 8, 0, 0, 3, 7, 1, 6];
const example = () => {
  const cells = BOARD.map((d, k) => (d ? `<span class="sr-cell given">${d}</span>` : `<span class="sr-cell sr-hole" style="--k:${k}"></span>`)).join('');
  return `<div class="sr-demo"><span class="sr-mini">${cells}</span><span class="sr-arrow">←</span>${piece(L, 0, 'front')}</div>`;
};

const ICONS = {
  drag: piece([[0, 0, 3], [0, 1, 8], [1, 1, 1], [0, 2, 6]], 1),
  spin: `<span class="sr-spin">${piece([[0, 0, 7], [1, 0, 2], [1, 1, 5]], 2)}</span>`,
  hold: `<span class="tet-hold sr-hold"><span class="tet-slot">${piece([[0, 0, 1], [0, 1, 9]], 3)}</span></span>`,
  fall: '<span class="tet-fall sr-fall"><i></i></span>',
  lives: RULE_ICONS.lives(2),
  line: '<span class="tet-pop sr-pop">+100</span>',
  combo: '<span class="tet-pop big sr-pop">TETROKU!</span>',
  streak: '<span class="sr-mult">×2</span>',
};

export function tetrokuRules(): string {
  return rulesSheet(t('tetris.r.goal'), [
    { title: t('tetris.r.howTitle'), text: t('tetris.r.how'), html: example() },
    {
      title: t('tetris.r.piecesTitle'),
      rows: [
        { icon: ICONS.drag, title: t('tetris.r.dragTitle'), text: t('tetris.r.drag') },
        { icon: ICONS.spin, title: t('tetris.r.spinTitle'), text: t('tetris.r.spin') },
        { icon: ICONS.hold, title: t('tetris.r.holdTitle'), text: t('tetris.r.hold') },
      ],
    },
    {
      title: t('tetris.r.dangerTitle'),
      rows: [
        { icon: ICONS.fall, title: t('tetris.r.fallTitle'), text: t('tetris.r.fall') },
        { icon: RULE_ICONS.wrong(), title: t('tetris.r.wrongTitle'), text: t('tetris.r.wrong') },
        { icon: ICONS.lives, title: t('tetris.r.livesTitle'), text: t('tetris.r.lives') },
      ],
    },
    {
      title: t('tetris.r.scoreTitle'),
      rows: [
        { icon: ICONS.line, title: t('tetris.r.lineTitle'), text: t('tetris.r.line') },
        { icon: ICONS.combo, title: t('tetris.r.comboTitle'), text: t('tetris.r.combo') },
        { icon: ICONS.streak, title: t('tetris.r.streakTitle'), text: t('tetris.r.streak') },
      ],
    },
    { title: t('tetris.r.tipsTitle'), tips: [t('tetris.r.tip1'), t('tetris.r.tip2'), t('tetris.r.tip3')] },
  ]);
}

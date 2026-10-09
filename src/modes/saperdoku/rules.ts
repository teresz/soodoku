import { t } from '../../i18n';
import { RULE_ICONS, rulesSheet } from '../rules';

// Instrukcja Saperdoku. Liczniki, flagi i wybuchy rysowane jak na planszy (te same kolory liczników).

const counted = (d: number, n: number) => `<span class="sr-cell given">${d}<i class="sr-mc" data-n="${n}">${n}</i></span>`;
const flag = '<span class="sr-cell sr-flag">🚩</span>';

// Przykład: 3×3 wokół pola z licznikiem 2; dwie flagi to dokładnie te dwie miny.
const example = () => {
  const cells = [
    counted(4, 1), flag, counted(6, 1),
    RULE_ICONS.cell(''), counted(8, 2), counted(3, 1),
    flag, RULE_ICONS.cell(''), counted(1, 0),
  ].join('');
  return `<div class="sr-demo"><span class="sr-mini">${cells}</span></div>`;
};

const ICONS = {
  count: counted(5, 2),
  flag,
  boom: '<span class="sr-cell bad sr-boom">💥</span>',
  badFlag: '<span class="sr-cell bad sr-flag sr-nope">🚩</span>',
  chip: '<span class="sr-chip">💣 8</span>',
  list: '<span class="mine-list sr-list"><b>3</b><b class="off">7</b><b>9</b></span>',
  win: RULE_ICONS.badge('★', 'gold'),
};

export function saperdokuRules(): string {
  return rulesSheet(t('minesweeper.r.goal'), [
    { title: t('minesweeper.r.howTitle'), text: t('minesweeper.r.how'), html: example() },
    {
      title: t('minesweeper.r.toolsTitle'),
      rows: [
        { icon: ICONS.count, title: t('minesweeper.r.countTitle'), text: t('minesweeper.r.count') },
        { icon: ICONS.flag, title: t('minesweeper.r.flagTitle'), text: t('minesweeper.r.flag') },
        { icon: ICONS.chip, title: t('minesweeper.r.chipTitle'), text: t('minesweeper.r.chip') },
        { icon: ICONS.list, title: t('minesweeper.r.listTitle'), text: t('minesweeper.r.list') },
      ],
    },
    {
      title: t('minesweeper.r.dangerTitle'),
      rows: [
        { icon: ICONS.boom, title: t('minesweeper.r.boomTitle'), text: t('minesweeper.r.boom') },
        { icon: ICONS.badFlag, title: t('minesweeper.r.badFlagTitle'), text: t('minesweeper.r.badFlag') },
        { icon: RULE_ICONS.lives(1), title: t('minesweeper.r.livesTitle'), text: t('minesweeper.r.lives') },
        { icon: ICONS.win, title: t('minesweeper.r.winTitle'), text: t('minesweeper.r.win') },
      ],
    },
    { title: t('minesweeper.r.tipsTitle'), tips: [t('minesweeper.r.tip1'), t('minesweeper.r.tip2'), t('minesweeper.r.tip3')] },
  ]);
}

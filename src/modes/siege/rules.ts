import { t, tk } from '../../i18n';
import { RULE_ICONS, rulesSheet } from '../rules';

// Instrukcja Oblężenia: arkusz „Jak grać” z legendą potworów. Rysunki to te same elementy co na planszy.

const foe = (hp: number) =>
  `<span class="sg-foe sg-static hp${hp}" style="--p:.62"><i class="sg-ring"></i><span class="sg-body"><i class="sg-eye"></i><i class="sg-eye"></i><i class="sg-mouth"></i></span><span class="sg-hp">${'<i></i>'.repeat(hp)}</span></span>`;

const castle = '<svg viewBox="0 0 12 12"><path d="M1 1h2v1.5h1.5V1h3v1.5H9V1h2v4l-1.5 1v4H11v2H1v-2h1.5V6L1 5z"/></svg>';

const ICONS = {
  wall: '<span class="sg-wall sg-static"><i class="on"></i><i class="on"></i><i></i></span>',
  shot: '<span class="sr-shot"><i class="sg-bolt sg-static"></i></span>',
  laser: '<span class="sr-laser"><i></i></span>',
  fortress: '<span class="sr-badge gold">★</span>',
  wrong: RULE_ICONS.wrong(),
  fall: '<span class="sr-badge bad">✕</span>',
  lose: `<span class="sr-castles">${castle}${castle}${castle}</span>`,
};

export function siegeRules(): string {
  const foes = [1, 2, 3].map((hp) =>
    `<div class="sr-foe"><span class="sr-foe-pic">${foe(hp)}</span><span><b>${tk(`siege.r.foe${hp}`)}</b><small>${tk(`siege.r.foe${hp}.desc`)}</small></span></div>`,
  ).join('');
  return rulesSheet(t('siege.r.goal'), [
    { title: t('siege.r.castleTitle'), rows: [{ icon: ICONS.wall, title: t('siege.r.wallTitle'), text: t('siege.r.wall') }] },
    { title: t('siege.r.foesTitle'), text: t('siege.r.foes'), html: `<div class="sr-foes">${foes}</div>` },
    {
      title: t('siege.r.weaponsTitle'),
      rows: [
        { icon: ICONS.shot, title: t('siege.r.shotTitle'), text: t('siege.r.shot') },
        { icon: ICONS.laser, title: t('siege.r.laserTitle'), text: t('siege.r.laser') },
        { icon: ICONS.fortress, title: t('siege.r.fortressTitle'), text: t('siege.r.fortress') },
      ],
    },
    {
      title: t('siege.r.dangerTitle'),
      rows: [
        { icon: ICONS.wrong, title: t('siege.r.wrongTitle'), text: t('siege.r.wrong') },
        { icon: ICONS.fall, title: t('siege.r.fallTitle'), text: t('siege.r.fall') },
        { icon: ICONS.lose, title: t('siege.r.loseTitle'), text: t('siege.r.lose') },
      ],
    },
    { title: t('siege.r.tipsTitle'), tips: [t('siege.r.tip1'), t('siege.r.tip2'), t('siege.r.tip3'), t('siege.r.tip4')] },
  ]);
}

import { t, tk } from '../../i18n';

// Instrukcja Oblężenia: arkusz „Jak grać” z legendą potworów. Rysunki to te same elementy co na planszy.

const foe = (hp: number) =>
  `<span class="sg-foe sg-static hp${hp}" style="--p:.62"><i class="sg-ring"></i><span class="sg-body"><i class="sg-eye"></i><i class="sg-eye"></i><i class="sg-mouth"></i></span><span class="sg-hp">${'<i></i>'.repeat(hp)}</span></span>`;

const castle = '<svg viewBox="0 0 12 12"><path d="M1 1h2v1.5h1.5V1h3v1.5H9V1h2v4l-1.5 1v4H11v2H1v-2h1.5V6L1 5z"/></svg>';

const ICONS = {
  wall: '<span class="sg-wall sg-static"><i class="on"></i><i class="on"></i><i></i></span>',
  shot: '<span class="sr-shot"><i class="sg-bolt sg-static"></i></span>',
  laser: '<span class="sr-laser"><i></i></span>',
  fortress: '<span class="sr-badge gold">★</span>',
  wrong: '<span class="sr-cell bad">7</span>',
  fall: '<span class="sr-badge bad">✕</span>',
  lose: `<span class="sr-castles">${castle}${castle}${castle}</span>`,
};

const row = (icon: string, title: string, text: string) =>
  `<div class="sr-row"><span class="sr-icon">${icon}</span><p><b>${title}</b> ${text}</p></div>`;

export function siegeRules(): string {
  const foes = [1, 2, 3].map((hp) =>
    `<div class="sr-foe"><span class="sr-foe-pic">${foe(hp)}</span><span><b>${tk(`siege.r.foe${hp}`)}</b><small>${tk(`siege.r.foe${hp}.desc`)}</small></span></div>`,
  ).join('');
  return `
    <p class="sr-lead">${t('siege.r.goal')}</p>
    <section>
      <h3>${t('siege.r.castleTitle')}</h3>
      ${row(ICONS.wall, t('siege.r.wallTitle'), t('siege.r.wall'))}
    </section>
    <section>
      <h3>${t('siege.r.foesTitle')}</h3>
      <p class="sr-text">${t('siege.r.foes')}</p>
      <div class="sr-foes">${foes}</div>
    </section>
    <section>
      <h3>${t('siege.r.weaponsTitle')}</h3>
      ${row(ICONS.shot, t('siege.r.shotTitle'), t('siege.r.shot'))}
      ${row(ICONS.laser, t('siege.r.laserTitle'), t('siege.r.laser'))}
      ${row(ICONS.fortress, t('siege.r.fortressTitle'), t('siege.r.fortress'))}
    </section>
    <section>
      <h3>${t('siege.r.dangerTitle')}</h3>
      ${row(ICONS.wrong, t('siege.r.wrongTitle'), t('siege.r.wrong'))}
      ${row(ICONS.fall, t('siege.r.fallTitle'), t('siege.r.fall'))}
      ${row(ICONS.lose, t('siege.r.loseTitle'), t('siege.r.lose'))}
    </section>
    <section>
      <h3>${t('siege.r.tipsTitle')}</h3>
      <ul class="sr-tips"><li>${t('siege.r.tip1')}</li><li>${t('siege.r.tip2')}</li><li>${t('siege.r.tip3')}</li><li>${t('siege.r.tip4')}</li></ul>
    </section>`;
}

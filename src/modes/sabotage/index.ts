import './sabotage.css';
import { generate } from '../../core/generator';
import { t } from '../../i18n';
import { GameMode } from '../types';
import { LEVELS } from './engine';

const ICONS = {
  line: '<span class="sr-badge sb-r">≡</span>',
  ban: '<span class="sr-badge sb-r sb-r-ban">7</span>',
  blur: '<span class="sr-badge sb-r sb-r-blur">5</span>',
  rotate: '<span class="sr-badge sb-r sb-r-rot">↻</span>',
  wrong: '<span class="sr-cell bad">7</span>',
  win: '<span class="sr-badge gold">★</span>',
};
const row = (icon: string, title: string, text: string) =>
  `<div class="sr-row"><span class="sr-icon">${icon}</span><p><b>${title}</b> ${text}</p></div>`;

/** Sabotaż: dwóch graczy, ta sama plansza, ukończone linie i kwadraty to ataki na rywala. */
export const sabotage: GameMode = {
  id: 'sabotage',
  get name() { return t('sab.name'); },
  get tagline() { return t('sab.tagline'); },
  get ladder() { return t('sab.ladder'); },
  available: true,
  mistakeLimit: null, // zła cyfra kosztuje 3 s blokady, a nie życie
  get difficulties() {
    return LEVELS.map((id) => ({ id, label: t(`lvl.${id}`), hint: t(`classic.${id}`) }));
  },
  createPuzzle: (difficulty, seed) => generate(difficulty as (typeof LEVELS)[number], seed),
  rules: () => `
    <p class="sr-lead">${t('sab.r.goal')}</p>
    <section>
      <h3>${t('sab.r.attacksTitle')}</h3>
      ${row(ICONS.ban, t('sab.r.banTitle'), t('sab.r.ban'))}
      ${row(ICONS.blur, t('sab.r.blurTitle'), t('sab.r.blur'))}
      ${row(ICONS.rotate, t('sab.r.rotTitle'), t('sab.r.rot'))}
    </section>
    <section>
      <h3>${t('sab.r.rulesTitle')}</h3>
      ${row(ICONS.wrong, t('sab.r.wrongTitle'), t('sab.r.wrong'))}
      ${row(ICONS.line, t('sab.r.queueTitle'), t('sab.r.queue'))}
      ${row(ICONS.win, t('sab.r.winTitle'), t('sab.r.win'))}
    </section>`,
};

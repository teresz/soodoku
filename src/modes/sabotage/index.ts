import './sabotage.css';
import { generate } from '../../core/generator';
import { t } from '../../i18n';
import { RULE_ICONS, rulesSheet } from '../rules';
import { GameMode } from '../types';
import { LEVELS, SELF_PENALTY } from './engine';

const ICONS = {
  line: RULE_ICONS.badge('≡', 'sb-r'),
  ban: RULE_ICONS.badge('7', 'sb-r sb-r-ban'),
  blur: RULE_ICONS.badge('5', 'sb-r sb-r-blur'),
  rotate: RULE_ICONS.badge('↻', 'sb-r sb-r-rot'),
  win: RULE_ICONS.badge('★', 'gold'),
  room: '<span class="sb-r-code"><i>K</i><i>T</i><i>8</i><i>R</i></span>',
  join: RULE_ICONS.badge('→', 'sb-r'),
  bar: '<span class="sb-r-bar"><i></i></span>',
  rematch: RULE_ICONS.badge('↺', 'sb-r sb-r-rot'),
};

/** Schodki kary za złą cyfrę, liczone z tej samej tabeli co w grze. */
const penaltySteps = () => `<div class="sb-steps">${SELF_PENALTY.map((p, k) => `
  <div class="sb-step"><small>${t(`sab.r.step${k + 1}` as 'sab.r.step1')}</small>
    <span class="sb-chip ice">❄ ${p.freeze / 1000} s</span>${p.blur ? `<span class="sb-chip fog">🌫 ${p.blur / 1000} s</span>` : ''}</div>`).join('')}</div>`;

/** Sabotaż: dwóch graczy, ta sama plansza, ukończone linie i kwadraty to ataki na rywala. */
export const sabotage: GameMode = {
  id: 'sabotage',
  get name() { return t('sab.name'); },
  get tagline() { return t('sab.tagline'); },
  get ladder() { return t('sab.ladder'); },
  available: true,
  mistakeLimit: null, // zła cyfra kosztuje rosnącą blokadę, a nie życie
  get difficulties() {
    return LEVELS.map((id) => ({ id, label: t(`lvl.${id}`), hint: t(`classic.${id}`) }));
  },
  createPuzzle: (difficulty, seed) => generate(difficulty as (typeof LEVELS)[number], seed),
  rules: () => rulesSheet(t('sab.r.goal'), [
    {
      title: t('sab.r.startTitle'),
      rows: [
        { icon: ICONS.room, title: t('sab.r.roomTitle'), text: t('sab.r.room') },
        { icon: ICONS.join, title: t('sab.r.joinTitle'), text: t('sab.r.join') },
        { icon: ICONS.bar, title: t('sab.r.barTitle'), text: t('sab.r.bar') },
      ],
    },
    {
      title: t('sab.r.attacksTitle'),
      rows: [
        { icon: ICONS.ban, title: t('sab.r.banTitle'), text: t('sab.r.ban') },
        { icon: ICONS.blur, title: t('sab.r.blurTitle'), text: t('sab.r.blur') },
        { icon: ICONS.rotate, title: t('sab.r.rotTitle'), text: t('sab.r.rot') },
      ],
    },
    {
      title: t('sab.r.rulesTitle'),
      rows: [
        { icon: ICONS.line, title: t('sab.r.queueTitle'), text: t('sab.r.queue') },
        { icon: ICONS.win, title: t('sab.r.winTitle'), text: t('sab.r.win') },
        { icon: ICONS.rematch, title: t('sab.r.rematchTitle'), text: t('sab.r.rematch') },
      ],
    },
    {
      title: t('sab.r.wrongTitle'),
      text: t('sab.r.wrong'),
      html: penaltySteps(),
    },
    { title: t('sab.r.tipsTitle'), tips: [t('sab.r.tip1'), t('sab.r.tip2'), t('sab.r.tip3')] },
  ]),
};

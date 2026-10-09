import './sabotage.css';
import { generate } from '../../core/generator';
import { t } from '../../i18n';
import { RULE_ICONS, rulesSheet } from '../rules';
import { GameMode } from '../types';
import { LEVELS } from './engine';

const ICONS = {
  line: RULE_ICONS.badge('≡', 'sb-r'),
  ban: RULE_ICONS.badge('7', 'sb-r sb-r-ban'),
  blur: RULE_ICONS.badge('5', 'sb-r sb-r-blur'),
  rotate: RULE_ICONS.badge('↻', 'sb-r sb-r-rot'),
  wrong: RULE_ICONS.wrong(),
  win: RULE_ICONS.badge('★', 'gold'),
};

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
  rules: () => rulesSheet(t('sab.r.goal'), [
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
        { icon: ICONS.wrong, title: t('sab.r.wrongTitle'), text: t('sab.r.wrong') },
        { icon: ICONS.line, title: t('sab.r.queueTitle'), text: t('sab.r.queue') },
        { icon: ICONS.win, title: t('sab.r.winTitle'), text: t('sab.r.win') },
      ],
    },
  ]),
};

import './rules.css';

// Wspólny arkusz „Jak grać” dla niestandardowych trybów. Tryb daje wstęp i sekcje, a ikony rysuje
// tymi samymi elementami co na planszy, żeby legenda wyglądała jak gra. Nowy tryb: rules: () => rulesSheet(...).

/** Wiersz legendy: ikona po lewej, pogrubiony tytuł i opis po prawej. */
export interface RuleRow { icon: string; title: string; text: string }

export interface RuleSection {
  title: string;
  /** Akapit pod nagłówkiem. */
  text?: string;
  rows?: RuleRow[];
  /** Dowolny HTML (np. kafelki potworów w Oblężeniu). */
  html?: string;
  tips?: string[];
}

export const ruleRow = ({ icon, title, text }: RuleRow) =>
  `<div class="sr-row"><span class="sr-icon">${icon}</span><p><b>${title}</b> ${text}</p></div>`;

export function rulesSheet(lead: string, sections: RuleSection[]): string {
  return `<p class="sr-lead">${lead}</p>` + sections.map((s) => `
    <section>
      <h3>${s.title}</h3>
      ${s.text ? `<p class="sr-text">${s.text}</p>` : ''}
      ${s.html ?? ''}
      ${(s.rows ?? []).map(ruleRow).join('')}
      ${s.tips ? `<ul class="sr-tips">${s.tips.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
    </section>`).join('');
}

/** Gotowe ikony wspólne dla wielu trybów. */
export const RULE_ICONS = {
  /** Zła cyfra w polu. */
  wrong: (d = 7) => `<span class="sr-cell bad">${d}</span>`,
  /** Pole z cyfrą (dobre, neutralne). */
  cell: (d: number | string, cls = '') => `<span class="sr-cell ${cls}">${d}</span>`,
  badge: (txt: string, cls = '') => `<span class="sr-badge ${cls}">${txt}</span>`,
  /** Kropki żyć, jak w pasku gry. */
  lives: (on: number, total = 3) =>
    `<span class="sr-lives">${Array.from({ length: total }, (_, k) => `<i class="${k < on ? '' : 'off'}"></i>`).join('')}</span>`,
};

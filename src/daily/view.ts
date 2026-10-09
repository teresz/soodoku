// Wyzwanie dnia w interfejsie: karta w menu, arkusz z notatką „dlaczego to wyzwanie” i kalendarz ze streakiem.
import './daily.css';
import { Game } from '../game/game';
import { createGame } from '../game/create';
import { difficultyLabel, getMode } from '../modes';
import { getLang, locale, t, tk } from '../i18n';
import {
  Challenge, DAILY_START, DailyProgress, DayState, addDays, bestStreak, challengeFor, currentStreak, dayKey, dayState,
  loadProgress, parseDay,
} from './daily';
import { buildNote } from './note';

export interface DailyDeps {
  current: () => Game;
  canContinue: () => boolean;
  /** Startuje nową grę-wyzwanie (porzuca bieżącą). */
  launch: (game: Game) => void;
  /** Wraca do bieżącej gry. */
  resume: () => void;
  closeSheets: () => void;
  busy: (on: boolean) => void;
  formatTime: (ms: number) => string;
  /** Pasek konta w kalendarzu (zachęta do konta albo „postęp w chmurze”). */
  accountBanner: (el: HTMLElement) => void;
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(), o).format(parseDay(day));

export function createDailyView(deps: DailyDeps) {
  const notes = new Map<string, string[]>(); // notatki liczymy raz na dzień (technika wymaga przejścia solvera)
  let pending: Game | null = null; // wygenerowana plansza czekająca na „Zaczynamy”
  let openDayKey: string | null = null;
  let month = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();

  const today = () => dayKey();
  /** Bieżąca gra, jeśli to rozgrywane wyzwanie z danego dnia. */
  const running = (day: string) => {
    const g = deps.current();
    // Tryb też musi się zgadzać: stara gra z wcześniejszej rotacji nie udaje dzisiejszego wyzwania.
    return deps.canContinue() && g.state.daily?.day === day && g.state.modeId === challengeFor(day).modeId ? g : null;
  };
  const stateOf = (p: DailyProgress, day: string): DayState | 'playing' => {
    const st = dayState(p, day, today());
    return (st === 'today' || st === 'missed') && running(day) ? 'playing' : st;
  };

  // --- karta w menu ---
  function renderCard() {
    const el = $('daily-card');
    const day = today();
    const ch = challengeFor(day);
    const p = loadProgress();
    const streak = currentStreak(p, day);
    const st = stateOf(p, day);
    const week = [...Array(7)].map((_, k) => addDays(day, k - 6));
    el.className = `daily-card st-${st}${streak ? ' hot' : ''}`;
    el.innerHTML = `
      <button class="dc-main" type="button" data-act="open">
        <span class="dc-date"><small>${esc(fmt(day, { month: 'short' }))}</small><b>${parseDay(day).getDate()}</b></span>
        <span class="dc-info">
          <span class="dc-label">${t('daily.title')}</span>
          <strong>${esc(getMode(ch.modeId).name)} · ${esc(difficultyLabel(ch.modeId, ch.difficulty))}</strong>
          <span class="dc-tags"><em class="dc-state">${t(`daily.state.${st === 'missed' ? 'today' : st}` as 'daily.state.today')}</em>${
            ch.mod !== 'none' ? `<em class="dc-mod">${tk(`daily.mod.short.${ch.mod}`)}</em>` : ''}</span>
        </span>
        <span class="dc-streak" title="${t('daily.streak')}"><i class="flame" aria-hidden="true">🔥</i><b>${streak}</b><small>${t('daily.inRow')}</small></span>
      </button>
      <button class="dc-week" type="button" data-act="calendar" aria-label="${t('daily.calendar')}">
        ${week.map((d) => `<span class="wk wk-${stateOf(p, d)}${d === day ? ' now' : ''}"><small>${esc(fmt(d, { weekday: 'narrow' }))}</small><i></i></span>`).join('')}
        <span class="dc-cal">${t('daily.calendar')}<span class="ico ico-back"></span></span>
      </button>`;
    el.querySelector('[data-act="open"]')!.addEventListener('click', () => openDay(day));
    el.querySelector('[data-act="calendar"]')!.addEventListener('click', () => openCalendar());
  }

  // --- arkusz wyzwania ---
  function openDay(day: string) {
    openDayKey = day;
    pending = null;
    const ch = challengeFor(day);
    const live = running(day);
    if (live) return renderDay(ch, live);
    deps.closeSheets();
    deps.busy(true);
    // Daj przeglądarce narysować „Generuję…”, zanim zablokujemy ją generatorem.
    void createGame(ch.modeId, ch.difficulty, ch.seed).then((g) => {
      deps.busy(false);
      if (openDayKey !== day) return;
      pending = g;
      pending.state.daily = { day, mod: ch.mod };
      renderDay(ch, pending);
    });
  }

  function renderDay(ch: Challenge, g: Game) {
    const day = ch.day;
    if (!notes.has(`${day}:${getLang()}`)) notes.set(`${day}:${getLang()}`, buildNote(ch, g.state));
    const p = loadProgress();
    const rec = p[day];
    const st = stateOf(p, day);
    const live = running(day) === g;
    const mode = getMode(ch.modeId);
    const bars = [...Array(ch.levels)].map((_, n) => `<i${n <= ch.level ? ' class="on"' : ''}></i>`).join('');
    const info: string[] = [];
    if (rec) info.push(t('daily.bestTime', { time: deps.formatTime(rec.ms) }));
    if (day !== today() && !rec?.onTime) info.push(t('daily.lateInfo'));
    if (!live && deps.canContinue()) {
      const cur = deps.current().state;
      info.push(t('daily.replaceInfo', { what: `${getMode(cur.modeId).name} · ${difficultyLabel(cur.modeId, cur.difficulty)}` }));
    }
    const sheet = $('sheet-daily');
    const box = sheet.querySelector('.sheet') as HTMLElement;
    box.className = `sheet daily st-${st}`;
    box.innerHTML = `
      <button class="sheet-x" type="button" aria-label="${t('sheet.close')}" title="${t('sheet.close')}"></button>
      <div class="dl-head">
        <div class="dl-page" aria-hidden="true"><small>${esc(fmt(day, { month: 'short' }))}</small><b>${parseDay(day).getDate()}</b><span>${esc(fmt(day, { weekday: 'short' }))}</span></div>
        <div class="dl-titles">
          <p class="sheet-label">${t('daily.title')} · ${esc(fmt(day, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
          <h2 id="daily-mode">${esc(mode.name)}</h2>
          <div class="dl-tags">
            <span class="dl-level"><span class="bars">${bars}</span>${esc(difficultyLabel(ch.modeId, ch.difficulty))}</span>
            <span class="dl-mod mod-${ch.mod}">${tk(`daily.mod.short.${ch.mod}`)}</span>
            <span class="dl-state">${t(`daily.state.${st}` as 'daily.state.today')}</span>
          </div>
        </div>
      </div>
      <section class="dl-why">
        <h3>${t('daily.why')}</h3>
        ${notes.get(`${day}:${getLang()}`)!.map((s, k) => `<p class="${k === 0 ? 'lead' : k === notes.get(`${day}:${getLang()}`)!.length - 1 && ch.mod !== 'none' ? 'twist' : ''}">${esc(s)}</p>`).join('')}
      </section>
      ${info.map((s) => `<p class="dl-info">${esc(s)}</p>`).join('')}
      <button class="btn-accent" type="button" data-act="go">${t(live ? 'daily.continue' : rec ? 'daily.replay' : st === 'missed' || st === 'today' ? 'daily.start' : 'daily.retry')}</button>
      <div class="dl-row">
        <button class="btn-quiet" type="button" data-act="calendar">${t('daily.calendar')}</button>
        <button class="btn-quiet" type="button" data-act="back" data-x>${t('daily.back')}</button>
      </div>`;
    box.querySelector('[data-act="go"]')!.addEventListener('click', () => {
      sheet.hidden = true;
      if (live) deps.resume();
      else deps.launch(g);
      pending = null;
    });
    box.querySelector('[data-act="calendar"]')!.addEventListener('click', () => openCalendar(day));
    box.querySelector('[data-act="back"]')!.addEventListener('click', () => { pending = null; deps.closeSheets(); });
    deps.closeSheets();
    sheet.hidden = false;
    box.scrollTop = 0;
  }

  // --- kalendarz ---
  function openCalendar(focus?: string) {
    if (focus) { const d = parseDay(focus); month = { y: d.getFullYear(), m: d.getMonth() }; }
    pending = null;
    openDayKey = null;
    renderCalendar();
    deps.closeSheets();
    $('sheet-calendar').hidden = false;
  }

  function renderCalendar() {
    const p = loadProgress();
    const now = today();
    const start = parseDay(DAILY_START), end = parseDay(now);
    const first = new Date(month.y, month.m, 1, 12);
    const canPrev = first > new Date(start.getFullYear(), start.getMonth(), 1, 12);
    const canNext = first < new Date(end.getFullYear(), end.getMonth(), 1, 12);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(month.y, month.m + 1, 0).getDate();
    const cells: string[] = [];
    for (let k = 0; k < lead; k++) cells.push('<span class="cd blank"></span>');
    for (let d = 1; d <= count; d++) {
      const key = dayKey(new Date(month.y, month.m, d, 12));
      const st = stateOf(p, key);
      const wd = (lead + d - 1) % 7;
      const on = (k: string) => p[k]?.onTime;
      const chain = st === 'onTime' ? `${wd > 0 && d > 1 && on(addDays(key, -1)) ? ' cl' : ''}${wd < 6 && d < count && on(addDays(key, 1)) ? ' cr' : ''}` : '';
      const off = st === 'before' || st === 'future';
      const ch = off ? null : challengeFor(key);
      cells.push(`<button type="button" class="cd cd-${st}${chain}${key === now ? ' now' : ''}" data-day="${key}" ${off ? 'disabled' : ''}
        aria-label="${esc(fmt(key, { day: 'numeric', month: 'long' }))}${ch ? `: ${esc(getMode(ch.modeId).name)}, ${t(`daily.state.${st}` as 'daily.state.today')}` : ''}"><b>${d}</b>${
        ch ? `<small>${esc(getMode(ch.modeId).name.slice(0, 3))}</small>` : ''}</button>`);
    }
    const wdNames = [...Array(7)].map((_, k) => fmt(addDays('2026-10-05', k), { weekday: 'narrow' })); // 5.10.2026 to poniedziałek
    const total = Object.keys(p).length;
    const box = $('sheet-calendar').querySelector('.sheet') as HTMLElement;
    const streak = currentStreak(p, now);
    box.innerHTML = `
      <button class="sheet-x" type="button" aria-label="${t('sheet.close')}" title="${t('sheet.close')}"></button>
      <h2 id="calendar-title">${t('daily.calTitle')}</h2>
      <div class="cal-stats">
        <div class="cs-streak${streak ? ' hot' : ''}"><i class="flame" aria-hidden="true">🔥</i><b>${streak}</b><small>${t('daily.streak')}</small></div>
        <div><b>${bestStreak(p)}</b><small>${t('daily.best')}</small></div>
        <div><b>${total}</b><small>${t('daily.done')}</small></div>
      </div>
      <div class="cal-nav">
        <button class="icon-btn" type="button" data-act="prev" aria-label="${t('daily.prev')}" ${canPrev ? '' : 'disabled'}><span class="ico ico-back"></span></button>
        <b>${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(first))}</b>
        <button class="icon-btn flip" type="button" data-act="next" aria-label="${t('daily.next')}" ${canNext ? '' : 'disabled'}><span class="ico ico-back"></span></button>
      </div>
      <div class="cal-grid">${wdNames.map((w) => `<span class="cw">${esc(w)}</span>`).join('')}${cells.join('')}</div>
      <div class="cal-legend">
        <span><i class="lg-onTime"></i>${t('daily.legend.onTime')}</span>
        <span><i class="lg-late"></i>${t('daily.legend.late')}</span>
        <span><i class="lg-missed"></i>${t('daily.legend.missed')}</span>
      </div>
      <div class="cal-account" hidden></div>
      <button class="btn-quiet" type="button" data-close>${t('stats.close')}</button>`;
    deps.accountBanner(box.querySelector('.cal-account') as HTMLElement);
    box.querySelector('[data-act="prev"]')!.addEventListener('click', () => { month = month.m === 0 ? { y: month.y - 1, m: 11 } : { y: month.y, m: month.m - 1 }; renderCalendar(); });
    box.querySelector('[data-act="next"]')!.addEventListener('click', () => { month = month.m === 11 ? { y: month.y + 1, m: 0 } : { y: month.y, m: month.m + 1 }; renderCalendar(); });
    box.querySelector('[data-close]')!.addEventListener('click', () => deps.closeSheets());
    box.querySelectorAll<HTMLButtonElement>('.cd[data-day]').forEach((b) => b.addEventListener('click', () => openDay(b.dataset.day!)));
  }

  /** Po zmianie języka przerysuj to, co jest otwarte. */
  function refresh() {
    if (!$('sheet-calendar').hidden) renderCalendar();
    if (!$('sheet-daily').hidden && openDayKey) {
      const g = running(openDayKey) ?? pending;
      if (g) renderDay(challengeFor(openDayKey), g);
    }
  }

  return { renderCard, openDay, openCalendar, refresh };
}

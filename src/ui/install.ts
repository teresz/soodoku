import './install.css';
import { rulesSheet } from '../modes/rules';
import { t } from '../i18n';

// Poradnik „Przypnij do ekranu startowego”: wykrzyknik w rogu menu otwiera arkusz z krokami dla iPhone'a,
// Androida i komputera (wykryty system na górze). Gdy apka już działa jako przypięta, wykrzyknik znika.

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(ua = navigator.userAgent, touch = navigator.maxTouchPoints): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Apka uruchomiona z ekranu startowego (albo jako zainstalowana na komputerze). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** W ramce (np. Artifact na claude.ai) przypinać się nie da. */
const inFrame = () => { try { return window.self !== window.top; } catch { return true; } };

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

const ICON = {
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`,
  dots: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M12 7v6M9 10l3 3 3-3"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>`,
};
const ico = (svg: string) => `<span class="pin-ico">${svg}</span>`;

function section(p: Platform) {
  if (p === 'ios') return {
    title: t('pin.ios'),
    text: t('pin.ios.note'),
    rows: [
      { icon: ico(ICON.share), title: t('pin.ios.1t'), text: t('pin.ios.1') },
      { icon: ico(ICON.plus), title: t('pin.ios.2t'), text: t('pin.ios.2') },
      { icon: ico(ICON.check), title: t('pin.ios.3t'), text: t('pin.ios.3') },
    ],
  };
  if (p === 'android') return {
    title: t('pin.android'),
    rows: [
      { icon: ico(ICON.dots), title: t('pin.android.1t'), text: t('pin.android.1') },
      { icon: ico(ICON.phone), title: t('pin.android.2t'), text: t('pin.android.2') },
      { icon: ico(ICON.check), title: t('pin.android.3t'), text: t('pin.android.3') },
    ],
  };
  return {
    title: t('pin.desktop'),
    rows: [
      { icon: ico(ICON.monitor), title: t('pin.desktop.1t'), text: t('pin.desktop.1') },
      { icon: ico(ICON.check), title: t('pin.desktop.2t'), text: t('pin.desktop.2') },
    ],
  };
}

export function createInstallGuide(button: HTMLElement, overlay: HTMLElement, body: HTMLElement, installBtn: HTMLButtonElement) {
  const platform = detectPlatform();
  let deferred: InstallPrompt | null = null;

  const refreshButton = () => { button.hidden = isStandalone() || inFrame(); };
  refreshButton();
  window.matchMedia('(display-mode: standalone)').addEventListener('change', refreshButton);

  // Chrome/Edge na Androidzie i komputerze dają własne okienko instalacji: wtedy wystarczy jeden przycisk.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    installBtn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installBtn.hidden = true;
    overlay.hidden = true;
    button.hidden = true;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    const d = deferred;
    deferred = null;
    installBtn.hidden = true;
    await d.prompt();
    await d.userChoice.catch(() => undefined);
  });

  function render() {
    const order: Platform[] = [platform, ...(['ios', 'android', 'desktop'] as Platform[]).filter((p) => p !== platform)];
    const [mine, ...rest] = order.map(section);
    body.innerHTML = rulesSheet(t('pin.lead'), [{ ...mine, title: `${mine.title} · ${t('pin.yours')}` }]) +
      `<details class="pin-more"><summary>${t('pin.other')}</summary>${rulesSheet('', rest).replace('<p class="sr-lead"></p>', '')}</details>`;
    installBtn.hidden = !deferred;
  }

  function open() { render(); overlay.hidden = false; }
  button.addEventListener('click', open);
  return { open, refresh: () => { if (!overlay.hidden) render(); } };
}


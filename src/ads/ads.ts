// Reklamy tylko poza rozgrywką: w menu i w okienku końca gry. Nigdy na planszy ani w trakcie meczu Sabotażu.
// ?ads=demo pokazuje szare ramki w miejscach reklam (do podglądu układu bez konta AdSense).
import { ADSENSE_CLIENT, AD_HOSTS, AD_SLOTS } from './config';
import { t } from '../i18n';

type Place = keyof typeof AD_SLOTS;

// Okienko końca gry dostaje świeżą reklamę najwyżej co minutę, żeby szybkie „Jeszcze raz” nie mieliło odsłon.
const END_REFRESH_MS = 60_000;

export function adsMode(host = location.hostname, search = location.search): 'live' | 'demo' | 'off' {
  if (new URLSearchParams(search).get('ads') === 'demo') return 'demo';
  if (ADSENSE_CLIENT && AD_HOSTS.includes(host)) return 'live';
  return 'off';
}

let scriptAdded = false;
function loadScript() {
  if (scriptAdded) return;
  scriptAdded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}

const lastFill = new Map<Place, number>();

/** Wstawia (albo zostawia) reklamę w kontenerze. Bez konfiguracji nic nie robi i chowa kontener. */
export function showAd(box: HTMLElement, place: Place) {
  const mode = adsMode();
  if (mode === 'off' || (mode === 'live' && !AD_SLOTS[place])) { box.hidden = true; return; }
  box.hidden = false;
  const now = Date.now();
  if (box.querySelector('ins, .ad-demo') && place === 'end' && now - (lastFill.get(place) ?? 0) < END_REFRESH_MS) return;
  if (box.querySelector('ins, .ad-demo') && place === 'home') return;
  lastFill.set(place, now);
  box.innerHTML = `<span class="ad-label" data-i18n="ads.label">${t('ads.label')}</span>`;
  if (mode === 'demo') {
    box.insertAdjacentHTML('beforeend', `<div class="ad-demo">AdSense · ${place}</div>`);
    return;
  }
  loadScript();
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = ADSENSE_CLIENT;
  ins.dataset.adSlot = AD_SLOTS[place];
  ins.dataset.adFormat = place === 'end' ? 'rectangle' : 'auto';
  ins.dataset.fullWidthResponsive = 'true';
  box.appendChild(ins);
  try {
    const w = window as unknown as { adsbygoogle?: unknown[] };
    (w.adsbygoogle = w.adsbygoogle || []).push({});
  } catch { /* adblock albo brak sieci: trudno, gra działa dalej */ }
}

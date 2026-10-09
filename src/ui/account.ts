// Konto Google w interfejsie: sekcja w Ustawieniach i pasek w kalendarzu wyzwań.
import './account.css';
import { t } from '../i18n';
import { signIn, signOut } from '../net/account';
import { accountsAvailable, currentAccount, syncState } from '../daily/sync';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Oficjalne „G” Google (cztery kolory), wymagane na przycisku logowania.
const G = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

const googleBtn = () => `<button class="g-btn" type="button" data-act="login">${G}<span>${t('account.google')}</span></button>`;

function avatar(name: string, url: string | null) {
  const initial = esc((name.trim()[0] ?? '?').toUpperCase());
  return `<span class="acc-avatar">${url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<b>${initial}</b></span>`;
}

const stateLine = () => {
  const st = syncState();
  return `<span class="acc-sync s-${st}"><i></i>${t(`account.sync.${st === 'off' ? 'syncing' : st}` as 'account.sync.ok')}</span>`;
};

/** Sekcja „Konto” w Ustawieniach. Zwraca false, gdy logowania tu nie ma (np. w Artifact). */
export function renderAccountSettings(label: HTMLElement, box: HTMLElement): boolean {
  const on = accountsAvailable();
  label.hidden = box.hidden = !on;
  if (!on) return false;
  const a = currentAccount();
  box.className = `account${a ? ' in' : ''}`;
  box.innerHTML = a
    ? `<div class="acc-me">${avatar(a.name, a.avatar)}<span class="acc-who"><b>${esc(a.name)}</b><small>${esc(a.email)}</small>${stateLine()}</span></div>
       <button class="btn-quiet acc-out" type="button" data-act="logout">${t('account.logout')}</button>`
    : `<p class="acc-pitch">${t('account.pitch')}</p>${googleBtn()}`;
  bind(box);
  return true;
}

/** Pasek w kalendarzu: zachęta do logowania albo informacja, że postęp jest w chmurze. */
export function renderAccountBanner(el: HTMLElement) {
  if (!accountsAvailable()) { el.hidden = true; return; }
  el.hidden = false;
  const a = currentAccount();
  el.className = `cal-account${a ? ' in' : ''}`;
  el.innerHTML = a
    ? `${avatar(a.name, a.avatar)}<span>${t('account.calSynced', { name: esc(a.name.split(' ')[0]) })}</span>${stateLine()}`
    : `<span>${t('account.calHint')}</span>${googleBtn()}`;
  bind(el);
}

function bind(root: HTMLElement) {
  const login = root.querySelector<HTMLButtonElement>('[data-act="login"]');
  login?.addEventListener('click', () => {
    login.disabled = true; // za chwilę przekierowanie do Google
    signIn().catch(() => { login.disabled = false; });
  });
  root.querySelector('[data-act="logout"]')?.addEventListener('click', () => { void signOut(); });
}

// Konto w interfejsie: formularz mail + hasło w Ustawieniach i pasek w kalendarzu wyzwań.
import './account.css';
import { t } from '../i18n';
import { AuthError, signInWithPassword, signOut } from '../net/account';
import { accountsAvailable, currentAccount, syncState } from '../daily/sync';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Stan formularza przeżywa przerysowania (np. zmianę statusu albo języka).
const form = { email: '', password: '', error: null as AuthError | 'empty' | null, busy: false };

function avatar(name: string) {
  return `<span class="acc-avatar"><b>${esc((name.trim()[0] ?? '?').toUpperCase())}</b></span>`;
}

const stateLine = () => {
  const st = syncState();
  return `<span class="acc-sync s-${st}"><i></i>${t(`account.sync.${st === 'off' ? 'syncing' : st}` as 'account.sync.ok')}</span>`;
};

/** Sekcja „Konto” w Ustawieniach. Zwraca false, gdy konta tu nie ma (np. w Artifact). */
export function renderAccountSettings(label: HTMLElement, box: HTMLElement, rerender: () => void): boolean {
  const on = accountsAvailable();
  label.hidden = box.hidden = !on;
  if (!on) return false;
  const a = currentAccount();
  box.className = `account${a ? ' in' : ''}`;
  if (a) {
    box.innerHTML = `<div class="acc-me">${avatar(a.name)}<span class="acc-who"><b>${esc(a.name)}</b><small>${esc(a.email)}</small>${stateLine()}</span></div>
      <button class="btn-quiet acc-out" type="button" data-act="logout">${t('account.logout')}</button>`;
    box.querySelector('[data-act="logout"]')!.addEventListener('click', () => { void signOut(); });
    return true;
  }
  box.innerHTML = `
    <p class="acc-pitch">${t('account.pitch')}</p>
    <form class="acc-form" novalidate>
      <input class="acc-input" type="email" name="email" autocomplete="username" inputmode="email" placeholder="${t('account.email')}" aria-label="${t('account.email')}" value="${esc(form.email)}">
      <input class="acc-input" type="password" name="password" autocomplete="current-password" placeholder="${t('account.password')}" aria-label="${t('account.password')}" value="${esc(form.password)}">
      ${form.error ? `<p class="acc-error" role="alert">${t(`account.err.${form.error}` as 'account.err.invalid')}</p>` : ''}
      <div class="acc-btns">
        <button class="btn-accent" type="submit" data-mode="login" ${form.busy ? 'disabled' : ''}>${t('account.login')}</button>
        <button class="btn-quiet" type="submit" data-mode="signup" ${form.busy ? 'disabled' : ''}>${t('account.signup')}</button>
      </div>
      <p class="acc-note">${t('account.noReset')}</p>
    </form>`;
  const f = box.querySelector('form')!;
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const create = (e.submitter as HTMLElement | null)?.dataset.mode === 'signup';
    form.email = (f.elements.namedItem('email') as HTMLInputElement).value.trim();
    form.password = (f.elements.namedItem('password') as HTMLInputElement).value;
    if (!form.email || !form.password) { form.error = 'empty'; rerender(); return; }
    form.busy = true; form.error = null; rerender();
    const err = await signInWithPassword(form.email, form.password, create);
    form.busy = false;
    form.error = err;
    if (err) return rerender();
    // Udało się: zalogowany widok narysuje onSyncChange, gdy dotrze konto, więc tu tylko czyścimy formularz.
    form.email = form.password = '';
  });
  return true;
}

/** Pasek w kalendarzu: zachęta do konta albo informacja, że postęp jest w chmurze. */
export function renderAccountBanner(el: HTMLElement, openAccount: () => void) {
  if (!accountsAvailable()) { el.hidden = true; return; }
  el.hidden = false;
  const a = currentAccount();
  el.className = `cal-account${a ? ' in' : ''}`;
  el.innerHTML = a
    ? `${avatar(a.name)}<span>${t('account.calSynced', { name: esc(a.name) })}</span>${stateLine()}`
    : `<span>${t('account.calHint')}</span><button class="btn-accent" type="button" data-act="open">${t('account.calButton')}</button>`;
  el.querySelector('[data-act="open"]')?.addEventListener('click', openAccount);
}

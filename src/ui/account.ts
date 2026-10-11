// Konto w interfejsie: formularz mail + hasło w Ustawieniach i pasek w kalendarzu wyzwań.
import './account.css';
import { t } from '../i18n';
import { AuthError, signInWithPassword, signOut } from '../net/account';
import { NickProblem, checkNick, myNick, setNick } from '../net/nick';
import { accountsAvailable, currentAccount, syncState } from '../daily/sync';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Stan formularza przeżywa przerysowania (np. zmianę statusu albo języka).
type FormError = AuthError | 'empty' | 'nickEmpty' | `nick.${NickProblem}`;
const form = { mode: 'login' as 'login' | 'signup', email: '', password: '', nick: '', error: null as FormError | null, busy: false };

// Nick zalogowanego konta: undefined = jeszcze nie wiemy, null = brak (stare konto, może ustawić raz).
const nickState = { forId: '', nick: undefined as string | null | undefined, draft: '', error: null as NickProblem | null, busy: false };

function loadNick(id: string, rerender: () => void) {
  if (nickState.forId === id) return;
  Object.assign(nickState, { forId: id, nick: undefined, draft: '', error: null, busy: false });
  void myNick().then((n) => { if (nickState.forId === id && nickState.nick === undefined) { nickState.nick = n; rerender(); } });
}

const nickErr = (p: NickProblem) => t(`nick.err.${p}` as 'nick.err.invalid');

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
    loadNick(a.id, rerender);
    const nick = nickState.nick;
    const shown = nick || a.name;
    let nickBox = '';
    if (nick === null) {
      nickBox = `<form class="acc-nick" novalidate>
        <p class="acc-pitch">${t('nick.setOnce')}</p>
        <input class="acc-input" name="nick" maxlength="16" autocomplete="nickname" placeholder="${t('nick.placeholder')}" aria-label="${t('nick.placeholder')}" value="${esc(nickState.draft)}">
        ${nickState.error ? `<p class="acc-error" role="alert">${nickErr(nickState.error)}</p>` : ''}
        <button class="btn-accent" type="submit" ${nickState.busy ? 'disabled' : ''}>${t('nick.save')}</button>
      </form>`;
    }
    box.innerHTML = `<div class="acc-me">${avatar(shown)}<span class="acc-who"><b>${esc(shown)}</b><small>${esc(a.email)}</small>${stateLine()}</span></div>
      ${nickBox}
      <button class="btn-quiet acc-out" type="button" data-act="logout">${t('account.logout')}</button>`;
    box.querySelector('[data-act="logout"]')!.addEventListener('click', () => { void signOut(); });
    const nf = box.querySelector<HTMLFormElement>('.acc-nick');
    nf?.addEventListener('submit', async (e) => {
      e.preventDefault();
      nickState.draft = (nf.elements.namedItem('nick') as HTMLInputElement).value.trim();
      nickState.busy = true; nickState.error = null; rerender();
      const err = await setNick(nickState.draft);
      nickState.busy = false;
      nickState.error = err;
      if (!err) nickState.nick = nickState.draft;
      if (err === 'locked') { nickState.forId = ''; } // ktoś ustawił w międzyczasie: dociągnij
      rerender();
    });
    return true;
  }
  const signup = form.mode === 'signup';
  box.innerHTML = `
    <p class="acc-pitch">${t('account.pitch')}</p>
    <div class="acc-tabs" role="tablist">
      <button type="button" role="tab" data-tab="login" aria-selected="${!signup}">${t('account.login')}</button>
      <button type="button" role="tab" data-tab="signup" aria-selected="${signup}">${t('account.signup')}</button>
    </div>
    <form class="acc-form" novalidate>
      <input class="acc-input" type="email" name="email" autocomplete="username" inputmode="email" placeholder="${t('account.email')}" aria-label="${t('account.email')}" value="${esc(form.email)}">
      <input class="acc-input" type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${t('account.password')}" aria-label="${t('account.password')}" value="${esc(form.password)}">
      ${signup ? `<input class="acc-input" name="nick" maxlength="16" autocomplete="nickname" placeholder="${t('nick.placeholder')}" aria-label="${t('nick.placeholder')}" value="${esc(form.nick)}">` : ''}
      ${form.error ? `<p class="acc-error" role="alert">${form.error.startsWith('nick.') ? nickErr(form.error.slice(5) as NickProblem) : t(`account.err.${form.error}` as 'account.err.invalid')}</p>` : ''}
      <button class="btn-accent" type="submit" ${form.busy ? 'disabled' : ''}>${t(signup ? 'account.signup' : 'account.login')}</button>
      <p class="acc-note">${signup ? t('nick.forever') + ' ' : ''}${t('account.noReset')}</p>
    </form>`;
  box.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    const f = box.querySelector('form')!;
    form.email = (f.elements.namedItem('email') as HTMLInputElement).value.trim();
    form.password = (f.elements.namedItem('password') as HTMLInputElement).value;
    form.mode = b.dataset.tab as 'login' | 'signup';
    form.error = null;
    rerender();
  }));
  const f = box.querySelector('form')!;
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const create = form.mode === 'signup';
    form.email = (f.elements.namedItem('email') as HTMLInputElement).value.trim();
    form.password = (f.elements.namedItem('password') as HTMLInputElement).value;
    if (create) form.nick = (f.elements.namedItem('nick') as HTMLInputElement).value.trim();
    if (!form.email || !form.password) { form.error = 'empty'; rerender(); return; }
    if (create && !form.nick) { form.error = 'nickEmpty'; rerender(); return; }
    form.busy = true; form.error = null; rerender();
    if (create) {
      // Nick sprawdzamy przed założeniem konta, żeby nie zostało konto z odrzuconym nickiem.
      const bad = await checkNick(form.nick);
      if (bad) { form.busy = false; form.error = `nick.${bad}`; rerender(); return; }
    }
    const err = await signInWithPassword(form.email, form.password, create);
    if (!err && create) {
      // Gdyby ktoś zajął nick w tej samej sekundzie, konto i tak powstaje, a nick da się ustawić w Ustawieniach.
      const nickErr = await setNick(form.nick);
      const me = currentAccount();
      if (!nickErr) Object.assign(nickState, { forId: me?.id ?? '', nick: me ? form.nick : undefined, error: null });
    }
    form.busy = false;
    form.error = err;
    if (err) return rerender();
    // Udało się: zalogowany widok narysuje onSyncChange, gdy dotrze konto, więc tu tylko czyścimy formularz.
    form.email = form.password = form.nick = '';
    form.mode = 'login';
    rerender();
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

import { GoTrueClient, type Session } from '@supabase/auth-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// Opcjonalne konto Google przez Supabase Auth. Bez logowania gra działa jak dotąd (postęp tylko w localStorage);
// po zalogowaniu postęp wyzwań dnia leci też do tabeli daily_progress (SQL w supabase/daily_progress.sql).

export interface Account { id: string; name: string; email: string; avatar: string | null }

/** Wiersz tabeli daily_progress (bez user_id, który dokładamy przy zapisie). */
export interface ProgressRow { day: string; ms: number; mistakes: number; hints: number; on_time: boolean; done_on: string }

/**
 * Logowanie ma sens tylko na zwykłej stronie (GitHub Pages, localhost). W Artifact (iframe)
 * i z pliku przekierowanie z Google nie ma dokąd wrócić, więc tam przycisku nie ma.
 */
export function accountsAvailable(): boolean {
  try { return /^https?:$/.test(location.protocol) && window.top === window.self; } catch { return false; }
}

let client: GoTrueClient | null = null;
let session: Session | null = null;

const auth = () => client ??= new GoTrueClient({
  url: `${SUPABASE_URL}/auth/v1`,
  headers: { apikey: SUPABASE_ANON_KEY },
  storageKey: 'soodoku.auth',
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true, // powrót z Google z ?code=… wymienia kod na sesję
  flowType: 'pkce',
});

const toAccount = (s: Session | null): Account | null => {
  if (!s) return null;
  const m = (s.user.user_metadata ?? {}) as Record<string, string | undefined>;
  return { id: s.user.id, name: m.full_name ?? m.name ?? s.user.email ?? '?', email: s.user.email ?? '', avatar: m.avatar_url ?? m.picture ?? null };
};

/** Zostawia w adresie tylko nasze parametry (np. ?pokoj=), bez śmieci po OAuth. */
function cleanUrl() {
  const url = new URL(location.href);
  let dirty = false;
  for (const k of ['code', 'error', 'error_code', 'error_description', 'state']) if (url.searchParams.has(k)) { url.searchParams.delete(k); dirty = true; }
  if (url.hash.includes('access_token') || url.hash.includes('error')) { url.hash = ''; dirty = true; }
  if (dirty) history.replaceState(history.state, '', url.toString());
}

/** Woła `fn` z bieżącym kontem od razu po starcie i przy każdym logowaniu, wylogowaniu i odświeżeniu sesji. */
export function watchAccount(fn: (a: Account | null) => void) {
  if (!accountsAvailable()) return fn(null);
  auth().onAuthStateChange((_event, s) => {
    session = s;
    // Poza callbackiem: auth-js nie lubi, gdy w nim czeka się na kolejne wywołania.
    window.setTimeout(() => { cleanUrl(); fn(toAccount(s)); }, 0);
  });
}

export async function signIn() {
  await auth().signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}

export async function signOut() {
  await auth().signOut({ scope: 'local' });
}

async function rest(path: string, init: RequestInit = {}) {
  if (!session) throw new Error('signed out');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!r.ok) throw new Error(`daily_progress ${r.status}`);
  return r;
}

export async function fetchRows(): Promise<ProgressRow[]> {
  return (await rest('daily_progress?select=day,ms,mistakes,hints,on_time,done_on')).json();
}

export async function upsertRows(rows: ProgressRow[]) {
  if (!rows.length || !session) return;
  const userId = session.user.id;
  await rest('daily_progress?on_conflict=user_id,day', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows.map((r) => ({ ...r, user_id: userId }))),
  });
}

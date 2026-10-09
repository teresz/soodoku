import { GoTrueClient, type Session } from '@supabase/auth-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// Opcjonalne konto (mail + hasło) przez Supabase Auth. Bez logowania gra działa jak dotąd (postęp tylko w localStorage);
// po zalogowaniu postęp wyzwań dnia leci też do tabeli daily_progress (SQL w supabase/daily_progress.sql).

export interface Account { id: string; name: string; email: string; avatar: string | null }

/** Wiersz tabeli daily_progress (bez user_id, który dokładamy przy zapisie). */
export interface ProgressRow { day: string; ms: number; mistakes: number; hints: number; on_time: boolean; done_on: string }

/**
 * Konto działa na zwykłej stronie (GitHub Pages, localhost). W Artifact (iframe) i z pliku go nie pokazujemy:
 * tam zapytania do Supabase i tak by nie przeszły.
 */
export function accountsAvailable(): boolean {
  try { return /^https?:$/.test(location.protocol) && window.top === window.self; } catch { return false; }
}

/**
 * Klucz sesji w localStorage. Przy testach dwóch kart (?net=local) każda karta może mieć własne konto
 * przez ?konto=A / ?konto=B, bo obie widzą ten sam localStorage.
 */
function authKey() {
  const q = new URLSearchParams(location.search);
  const tag = q.get('net') === 'local' ? q.get('konto')?.replace(/[^\w-]/g, '') : '';
  return tag ? `soodoku.auth.${tag}` : 'soodoku.auth';
}

let client: GoTrueClient | null = null;
let session: Session | null = null;

const auth = () => client ??= new GoTrueClient({
  url: `${SUPABASE_URL}/auth/v1`,
  headers: { apikey: SUPABASE_ANON_KEY },
  storageKey: authKey(),
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
});

const toAccount = (s: Session | null): Account | null => {
  if (!s) return null;
  const email = s.user.email ?? '';
  return { id: s.user.id, name: email.split('@')[0] || '?', email, avatar: null };
};

/** Woła `fn` z bieżącym kontem od razu po starcie i przy każdym logowaniu, wylogowaniu i odświeżeniu sesji. */
export function watchAccount(fn: (a: Account | null) => void) {
  if (!accountsAvailable()) return fn(null);
  auth().onAuthStateChange((_event, s) => {
    session = s;
    // Poza callbackiem: auth-js nie lubi, gdy w nim czeka się na kolejne wywołania.
    window.setTimeout(() => fn(toAccount(s)), 0);
  });
}

/** Czemu logowanie się nie udało (klucze tekstów `account.err.*`). */
export type AuthError = 'invalid' | 'exists' | 'weak' | 'email' | 'confirm' | 'rate' | 'network';

function authError(e: unknown): AuthError {
  const err = e as { code?: string; status?: number; message?: string } | null;
  switch (err?.code) {
    case 'invalid_credentials': return 'invalid';
    case 'user_already_exists': case 'email_exists': return 'exists';
    case 'weak_password': return 'weak';
    case 'email_address_invalid': case 'validation_failed': return 'email';
    case 'email_not_confirmed': return 'confirm';
    case 'over_request_rate_limit': case 'over_email_send_rate_limit': return 'rate';
  }
  if (err?.status === 429) return 'rate';
  if (err?.status === 400 && /password/i.test(err.message ?? '')) return 'weak';
  return 'network';
}

/** Logowanie albo zakładanie konta. Zwraca null, gdy się udało, inaczej powód błędu. */
export async function signInWithPassword(email: string, password: string, create: boolean): Promise<AuthError | null> {
  try {
    const { data, error } = create
      ? await auth().signUp({ email, password })
      : await auth().signInWithPassword({ email, password });
    if (error) return authError(error);
    // Z włączonym „Confirm email” Supabase zakłada konto bez sesji i czeka na kliknięcie w mailu.
    return data.session ? null : 'confirm';
  } catch (e) {
    return authError(e);
  }
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
  if (!r.ok) throw new Error(`${path.split('?')[0]} ${r.status}`);
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

/** Mecz Sabotażu na koncie (tabela sabotage_matches, SQL w supabase/sabotage_matches.sql). */
export interface MatchRow { match_id: string; opponent: string | null; won: boolean; ms: number; level: string; played_at: string }

export async function fetchMatches(): Promise<MatchRow[]> {
  return (await rest('sabotage_matches?select=match_id,opponent,won,ms,level,played_at')).json();
}

/** Mecz raz zapisany już się nie zmienia, więc powtórka tego samego match_id jest ignorowana. */
export async function insertMatches(rows: MatchRow[]) {
  if (!rows.length || !session) return;
  const userId = session.user.id;
  await rest('sabotage_matches?on_conflict=user_id,match_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows.map((r) => ({ ...r, user_id: userId }))),
  });
}

/** Funkcja w bazie (POST /rest/v1/rpc/…): jako zalogowany, a bez konta z samym kluczem anon. */
export async function rpc<T>(name: string, body: unknown = {}): Promise<T | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`rpc ${name} ${r.status}`);
  const text = await r.text();
  return text ? (JSON.parse(text) as T) : null;
}

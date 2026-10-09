// Statystyki Sabotażu z podziałem na rywali. Mecze siedzą w localStorage, a u zalogowanego także na koncie
// (tabela sabotage_matches), więc po zmianie telefonu wracają. Mail rywala zapisujemy tylko wtedy, gdy obaj gracze
// są zalogowani; mecze z kimś bez konta (albo rozegrane bez konta) lądują zbiorczo pod „gość”.
import type { MatchRow } from '../../net/account';

export interface MatchRecord {
  id: string;
  at: string; // ISO, kiedy mecz się skończył
  opp: string | null; // mail rywala albo null = gość
  won: boolean;
  ms: number;
  level: string;
  owner: string | null; // id konta, na którym grał ten telefon; null = bez konta
  synced?: boolean; // już jest na serwerze
}

const KEY = 'kratka.matches.v1';

export function loadMatches(): MatchRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as MatchRecord[]).filter((m) => m && typeof m.id === 'string' && typeof m.won === 'boolean') : [];
  } catch {
    return [];
  }
}

export function saveMatches(list: MatchRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* trudno */ }
}

export const newMatchId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Mail z sieci od rywala: przycięty, małymi literami, z grubsza poprawny; inaczej null. */
export function cleanEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@<>"]{1,64}@[^\s@<>"]+\.[^\s@<>"]+$/.test(e) ? e : null;
}

export const toMatchRow = (m: MatchRecord): MatchRow =>
  ({ match_id: m.id, opponent: m.opp, won: m.won, ms: Math.max(0, Math.round(m.ms)), level: m.level, played_at: m.at });

/** Dokleja mecze z serwera do lokalnych (konto `owner`); zwraca nową listę i to, czego serwer jeszcze nie ma. */
export function mergeMatches(local: MatchRecord[], owner: string, remote: MatchRow[]) {
  const onServer = new Set(remote.map((r) => r.match_id));
  const merged = local.map((m) => (m.owner === owner && onServer.has(m.id) && !m.synced ? { ...m, synced: true } : m));
  const have = new Set(merged.filter((m) => m.owner === owner).map((m) => m.id));
  for (const r of remote) {
    if (have.has(r.match_id)) continue;
    merged.push({ id: r.match_id, at: r.played_at, opp: cleanEmail(r.opponent), won: !!r.won, ms: Number(r.ms) || 0, level: String(r.level), owner, synced: true });
  }
  const upload = merged.filter((m) => m.owner === owner && !m.synced);
  return { merged, upload };
}

export interface Rival { opp: string | null; played: number; won: number; lost: number; lastAt: string }

/** Bilans z każdym rywalem: najczęstsi przeciwnicy na górze, gość zawsze na końcu. */
export function rivals(list: MatchRecord[], owner: string | null): Rival[] {
  const by = new Map<string | null, Rival>();
  for (const m of list) {
    if (m.owner !== owner) continue;
    const r = by.get(m.opp) ?? { opp: m.opp, played: 0, won: 0, lost: 0, lastAt: '' };
    r.played++;
    if (m.won) r.won++; else r.lost++;
    if (m.at > r.lastAt) r.lastAt = m.at;
    by.set(m.opp, r);
  }
  return [...by.values()].sort((a, b) =>
    (a.opp === null ? 1 : 0) - (b.opp === null ? 1 : 0) || b.played - a.played || b.lastAt.localeCompare(a.lastAt));
}

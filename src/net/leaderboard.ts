// Globalny ranking (SQL w supabase/leaderboard.sql): po każdej wygranej gra zgłasza czas (Tetroku: punkty),
// a w Statystykach każdy widzi top 10 trybu i poziomu. Bez konta gracz to „Gość”, rozpoznawany po id przeglądarki.
import { accountsAvailable, rpc } from './account';
import { deviceId } from './visits';

/** Tryby z rankingiem: Sabotaż (mecz 1v1) i wyzwania dnia zostają poza nim. */
export const RANKED_MODES = ['classic', 'clues', 'tetris', 'minesweeper', 'siege'];
export const byScore = (modeId: string) => modeId === 'tetris';

export interface BoardRow { pos: number; name: string | null; ms: number; score: number | null; at: string; me: boolean }
export interface Board { players: number; top: BoardRow[]; me: { pos: number; ms: number; score: number | null } | null }
export interface Submitted { better: boolean; rank: number; players: number }

/** missing = w bazie brak funkcji (nie puszczono leaderboard.sql), network = reszta kłopotów. */
export type BoardResult = { board: Board } | { error: 'missing' | 'network' };

const PENDING_KEY = 'soodoku.lb.pending';
interface Pending { mode: string; level: string; ms: number; score: number | null }

const readPending = (): Pending[] => {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as Pending[]; } catch { return []; }
};
const writePending = (list: Pending[]) => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20))); } catch { /* trudno */ }
};

const send = (p: Pending) => rpc<Submitted>('submit_score', { p_mode: p.mode, p_level: p.level, p_ms: Math.round(p.ms), p_score: p.score, p_device: deviceId() });

const cache = new Map<string, Board>();
export const cachedBoard = (mode: string, level: string) => cache.get(`${mode}:${level}`) ?? null;

/**
 * Zgłasza wygraną. Gdy nie ma sieci, wynik czeka w localStorage i leci przy następnej okazji.
 * Zwraca miejsce w rankingu albo null (brak sieci, brak SQL albo gra spoza rankingu).
 */
export async function submitScore(mode: string, level: string, ms: number, score?: number): Promise<Submitted | null> {
  if (!accountsAvailable() || !RANKED_MODES.includes(mode) || ms < 10000) return null;
  const p: Pending = { mode, level, ms, score: byScore(mode) ? score ?? 0 : null };
  try {
    const r = await send(p);
    cache.delete(`${mode}:${level}`);
    return r;
  } catch {
    writePending([...readPending(), p]);
    return null;
  }
}

/** Dosyła wyniki, które wcześniej nie doszły (np. wygrana w metrze). */
export async function flushPending() {
  const list = readPending();
  if (!list.length || !accountsAvailable()) return;
  const left: Pending[] = [];
  for (const p of list) {
    try { await send(p); cache.delete(`${p.mode}:${p.level}`); } catch { left.push(p); }
  }
  writePending(left);
}

export async function fetchBoard(mode: string, level: string): Promise<BoardResult> {
  try {
    const board = await rpc<Board>('leaderboard_top', { p_mode: mode, p_level: level, p_device: deviceId() });
    if (!board) return { error: 'network' };
    cache.set(`${mode}:${level}`, board);
    return { board };
  } catch (e) {
    // PostgREST oddaje 404, gdy funkcji nie ma w bazie.
    return { error: / 404$/.test(String((e as Error).message)) ? 'missing' : 'network' };
  }
}

// Synchronizacja postępu wyzwań z kontem (gdy gracz się zalogował). Źródłem prawdy zostaje localStorage:
// po zalogowaniu łączymy lokalne dni z tymi z serwera i dosyłamy, czego serwer nie ma albo ma gorsze.
import { Account, ProgressRow, accountsAvailable, fetchRows, upsertRows, watchAccount } from '../net/account';
import { DailyProgress, DayRecord, loadProgress, mergeProgress, saveProgress } from './daily';

export type SyncState = 'off' | 'syncing' | 'ok' | 'error';

export const toRow = (day: string, r: DayRecord): ProgressRow =>
  ({ day, ms: Math.round(r.ms), mistakes: r.mistakes, hints: r.hints, on_time: r.onTime, done_on: r.doneOn });

export const fromRows = (rows: ProgressRow[]): DailyProgress =>
  Object.fromEntries(rows.map((r) => [r.day, { ms: r.ms, mistakes: r.mistakes, hints: r.hints, onTime: r.on_time, doneOn: r.done_on }]));

const same = (a: DayRecord, b: DayRecord | undefined) =>
  !!b && Math.round(a.ms) === b.ms && a.mistakes === b.mistakes && a.hints === b.hints && a.onTime === b.onTime && a.doneOn === b.doneOn;

/** Co trzeba dosłać na serwer po połączeniu lokalnego postępu z serwerowym. */
export function plan(local: DailyProgress, remote: DailyProgress) {
  const merged = mergeProgress(local, remote);
  return { merged, upload: Object.keys(merged).filter((d) => !same(merged[d], remote[d])).map((d) => toRow(d, merged[d])) };
}

let account: Account | null = null;
let state: SyncState = 'off';
const listeners: (() => void)[] = [];
const set = (s: SyncState) => { state = s; listeners.forEach((f) => f()); };

export const syncState = () => state;
export const currentAccount = () => account;
export { accountsAvailable };
export const onSyncChange = (fn: () => void) => { listeners.push(fn); };

async function syncAll() {
  set('syncing');
  try {
    const remote = fromRows(await fetchRows());
    const { merged, upload } = plan(loadProgress(), remote);
    saveProgress(merged);
    await upsertRows(upload);
    set('ok');
  } catch {
    set('error'); // spróbujemy przy następnym starcie albo zapisie; lokalny postęp jest bezpieczny
  }
}

/** Start: słuchamy konta i po każdym zalogowaniu robimy pełną synchronizację. */
export function startSync() {
  watchAccount((a) => {
    const was = account?.id;
    account = a;
    if (!a) return set('off');
    if (a.id !== was || state === 'error') void syncAll();
    else set(state);
  });
}

/** Po ukończeniu wyzwania: dosyłamy ten jeden dzień (a jak wcześniej był błąd, to wszystko). */
export function pushDay(day: string) {
  if (!account) return;
  if (state === 'error') { void syncAll(); return; }
  const r = loadProgress()[day];
  if (!r) return;
  upsertRows([toRow(day, r)]).then(() => set('ok'), () => set('error'));
}

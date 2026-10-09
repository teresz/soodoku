import { Game, SavedGame } from './game';
import GenWorker from './gen.worker?worker&inline';

// Nowa gra bez zamrażania strony: plansza powstaje w workerze. Gdzie worker nie wstanie
// (np. blokada w ramce Artifact), liczymy po staremu w głównym wątku, plansza z seeda wychodzi identyczna.

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, (s: SavedGame | null) => void>();

function genWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new GenWorker();
    w.onmessage = (e: MessageEvent<{ id: number; state: SavedGame | null }>) => waiting.get(e.data.id)?.(e.data.state);
    w.onerror = () => {
      w.terminate();
      worker = null;
      [...waiting.values()].forEach((f) => f(null));
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Po awarii workera (albo gdy milczy) liczymy na miejscu. */
const WORKER_TIMEOUT_MS = 20000;

export function createGame(modeId: string, difficulty: string, seed: number): Promise<Game> {
  const local = () => new Promise<Game>((resolve) => {
    // Daj przeglądarce narysować „Generuję…”, zanim zablokujemy ją generatorem.
    window.setTimeout(() => resolve(Game.create(modeId, difficulty, seed)), 40);
  });
  const w = genWorker();
  if (!w) return local();
  return new Promise((resolve) => {
    const id = ++nextId;
    const done = (state: SavedGame | null) => {
      if (!waiting.has(id)) return;
      waiting.delete(id);
      window.clearTimeout(timer);
      if (state) resolve(new Game(state)); else void local().then(resolve);
    };
    const timer = window.setTimeout(() => done(null), WORKER_TIMEOUT_MS);
    waiting.set(id, done);
    w.postMessage({ id, modeId, difficulty, seed });
  });
}

/** Worker wstaje chwilę (parsowanie kodu), więc budzimy go zawczasu, gdy gracz jeszcze patrzy na menu. */
export function warmUpGenerator() {
  genWorker();
}

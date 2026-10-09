// Generator plansz w osobnym wątku: trudne poziomy liczą się na telefonie nawet kilka sekund,
// a w tym czasie strona (spinner, animacje, dotyk) ma dalej żyć.
import { Game } from './game';

self.onmessage = (e: MessageEvent<{ id: number; modeId: string; difficulty: string; seed: number }>) => {
  const { id, modeId, difficulty, seed } = e.data;
  try {
    self.postMessage({ id, state: Game.create(modeId, difficulty, seed).state });
  } catch {
    self.postMessage({ id, state: null });
  }
};

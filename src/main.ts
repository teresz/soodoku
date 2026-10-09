import './styles.css';
import { SavedGame } from './game/game';
import { startApp } from './ui/app';

// Hak podglądu Artifact: przy aktualizacji strony gra przeżywa bez utraty stanu. Poza podglądem go nie ma.
interface Hot { ready?: (fn: (data: { game?: SavedGame }) => void) => void; snapshot?: (fn: () => unknown) => void; data?: { game?: SavedGame } }
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;

const start = (data: { game?: SavedGame } = {}) => {
  const app = startApp(data.game ?? null);
  hot?.snapshot?.(() => ({ game: app.snapshot() }));
  // Testy dwóch zakładek (?net=local): podgląd stanu gry z konsoli.
  if (new URLSearchParams(location.search).get('net') === 'local') (window as unknown as { __soodoku: unknown }).__soodoku = { state: app.snapshot };
};

if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

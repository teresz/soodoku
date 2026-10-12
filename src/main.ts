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

// Motyw już nałożony: od teraz zmiany tła mogą płynnie przenikać.
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('ready')));

// Service worker: przypięta apka startuje z pamięci telefonu zamiast ściągać całą stronę i czcionki przy każdym uruchomieniu.
// Nie w podglądzie Artifact (ramka) ani na localhost w trybie dev.
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window && !import.meta.env.DEV) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

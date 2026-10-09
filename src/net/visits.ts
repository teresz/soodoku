// Licznik wejść na stronę: każde wejście woła count_visit w Supabase (SQL w supabase/page_visits.sql),
// a liczby widzi tylko admin (mail w tabeli site_admins) w Statystykach.
import { accountsAvailable, rpc } from './account';

export interface VisitCount { visits: number; devices: number }
export interface VisitStats { today: VisitCount; total: VisitCount; days: { day: string; visits: number; devices: number }[] }

const DEVICE_KEY = 'soodoku.device';

/** Losowy identyfikator przeglądarki: tylko po to, żeby odróżnić „ile osób” od „ile wejść”. */
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 12); // bez localStorage każde wejście to „nowe urządzenie”
  }
}

/** Raz na załadowanie strony. Nie liczymy lokalnych testów ani Artifactu (tam i tak nie ma Supabase). */
export function countVisit() {
  const q = new URLSearchParams(location.search);
  if (!accountsAvailable() || location.hostname === 'localhost' || q.get('net') === 'local') return;
  rpc('count_visit', { device: deviceId() }).catch(() => { /* licznik nie może psuć gry */ });
}

let cached: VisitStats | null = null;
/** Ostatnio pobrane liczby (żeby arkusz rysował się od razu, a świeże dochodziły w tle). */
export const cachedVisits = () => cached;

/** Liczby dla admina; null, gdy to nie admin albo brak tabeli. */
export async function fetchVisits(): Promise<VisitStats | null> {
  try {
    cached = await rpc<VisitStats>('visit_stats');
  } catch {
    cached = null;
  }
  return cached;
}

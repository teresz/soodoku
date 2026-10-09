import type { Rng } from '../../core/rng';

// Sabotaż: czysta logika ataków, bez DOM i sieci.
// Pełny wiersz/kolumna = prosty atak (zakaz cyfry albo zamazanie), pełny kwadrat = obrót planszy rywala o 90°.

export type AttackKind = 'ban' | 'blur' | 'rotate';

export const LEVELS = ['easy', 'medium', 'hard'] as const;
export type Level = (typeof LEVELS)[number];

/** Ile trwa każdy atak u ofiary (ms). Obrót to sama animacja. */
export const DURATION: Record<AttackKind, number> = { ban: 8000, blur: 4000, rotate: 900 };
/** Po obrocie przez tyle ms kolejny obrót zamienia się w zamazanie. */
export const ROTATE_GUARD_MS = 10000;
/**
 * Kara za złą cyfrę u siebie, rośnie z każdym błędem i już nie spada:
 * 1. błąd = blokada 3 s, 2. = blokada 5 s + rozmycie 3 s, 3. i dalej = blokada 5 s + rozmycie 5 s.
 */
export const SELF_PENALTY = [
  { freeze: 3000, blur: 0 },
  { freeze: 5000, blur: 3000 },
  { freeze: 5000, blur: 5000 },
] as const;

/** Kara za n-ty błąd w rundzie (n od 1). */
export function selfPenalty(n: number) {
  return SELF_PENALTY[Math.min(Math.max(n, 1), SELF_PENALTY.length) - 1];
}
/** Odliczanie przed startem. */
export const COUNTDOWN_MS = 3000;
/** Tyle czekamy na rywala, który zniknął, zanim przyznamy walkower. */
export const WALKOVER_MS = 20000;

/** Ataki za jednostki ukończone jednym ruchem (0–8 wiersze, 9–17 kolumny, 18–26 kwadraty). */
export function attacksFor(units: number[], rng: Rng): AttackKind[] {
  return units.map((u) => (u >= 18 ? 'rotate' : rng() < 0.5 ? 'ban' : 'blur'));
}

/** Cyfra do zakazu: losowa spośród tych, których ofierze jeszcze brakuje. */
export function pickBanDigit(counts: number[], rng: Rng): number | null {
  const open = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => counts[d] < 9);
  return open.length ? open[Math.floor(rng() * open.length)] : null;
}

export interface ActiveAttack { kind: AttackKind; until: number; digit?: number }

/**
 * Kolejka ataków u ofiary: odpalają się po kolei, nigdy dwa naraz.
 * Obrót w czasie ochrony po poprzednim obrocie zamienia się w zamazanie.
 */
export class AttackQueue {
  private queue: AttackKind[] = [];
  active: ActiveAttack | null = null;
  private lastRotate = -Infinity;
  rotation = 0; // ile ćwierćobrotów zgodnie z zegarem

  push(kind: AttackKind) { this.queue.push(kind); }

  get pending() { return this.queue.length; }

  /** Kończy wygasły atak i zaczyna następny. Zwraca atak, który właśnie wystartował. */
  tick(now: number, counts: number[], rng: Rng): ActiveAttack | null {
    if (this.active && now >= this.active.until) this.active = null;
    if (this.active || !this.queue.length) return null;
    let kind = this.queue.shift()!;
    if (kind === 'rotate' && now - this.lastRotate < ROTATE_GUARD_MS) kind = 'blur';
    let digit: number | undefined;
    if (kind === 'ban') {
      const d = pickBanDigit(counts, rng);
      if (d === null) kind = 'blur'; else digit = d;
    }
    if (kind === 'rotate') { this.lastRotate = now; this.rotation = (this.rotation + 1) % 4; }
    this.active = { kind, until: now + DURATION[kind], digit };
    return this.active;
  }

  bannedDigit(now: number) {
    return this.active?.kind === 'ban' && now < this.active.until ? this.active.digit! : null;
  }

  blurred(now: number) { return this.active?.kind === 'blur' && now < this.active.until; }

  clear() { this.queue = []; this.active = null; }
}

/** Kto wygrał, gdy obaj skończyli: krótszy czas, przy remisie gospodarz. */
export function decideWinner(myMs: number, theirMs: number, iAmHost: boolean): boolean {
  return myMs < theirMs || (myMs === theirMs && iAmHost);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeCode = (rng: Rng) => [...Array(4)].map(() => CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)]).join('');
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

// Geometria planszy 9x9. Indeksy komórek 0..80, wiersz po wierszu.
export type Grid = number[]; // 0 = pusto, 1..9 = cyfra

export const SIZE = 9;
export const CELLS = 81;
export const ALL_DIGITS = 0b1111111110; // bity 1..9

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
export const idx = (r: number, c: number) => r * 9 + c;

/** 27 jednostek: 9 wierszy, 9 kolumn, 9 kwadratów. */
export const UNITS: number[][] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push([...Array(9)].map((_, c) => idx(r, c)));
  for (let c = 0; c < 9; c++) units.push([...Array(9)].map((_, r) => idx(r, c)));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    units.push([...Array(9)].map((_, k) => idx(r0 + Math.floor(k / 3), c0 + (k % 3))));
  }
  return units;
})();

/** Dla każdej komórki: indeksy jednostek, do których należy [wiersz, kolumna, kwadrat]. */
export const UNITS_OF: number[][] = [...Array(CELLS)].map((_, i) => [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]);

/** 20 „sąsiadów” każdej komórki (ten sam wiersz, kolumna lub kwadrat). */
export const PEERS: number[][] = [...Array(CELLS)].map((_, i) => {
  const s = new Set<number>();
  for (const u of UNITS_OF[i]) for (const j of UNITS[u]) if (j !== i) s.add(j);
  return [...s];
});

export const bit = (d: number) => 1 << d;
export const popcount = (m: number) => {
  let n = 0;
  while (m) { m &= m - 1; n++; }
  return n;
};
export const digitsOf = (m: number) => {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d);
  return out;
};

/** Kandydaci dla pustej komórki wynikający z wpisanych cyfr. */
export function candidates(grid: Grid, i: number): number {
  let used = 0;
  for (const p of PEERS[i]) if (grid[p]) used |= bit(grid[p]);
  return ALL_DIGITS & ~used;
}

/** Komórki, których wartość koliduje z sąsiadem (ta sama cyfra w jednostce). */
export function conflicts(grid: Grid): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < CELLS; i++) {
    if (!grid[i]) continue;
    for (const p of PEERS[i]) if (grid[p] === grid[i]) { out.add(i); break; }
  }
  return out;
}

export const toString = (g: Grid) => g.map((v) => (v ? String(v) : '.')).join('');
export const fromString = (s: string): Grid => [...s].slice(0, 81).map((ch) => (ch >= '1' && ch <= '9' ? +ch : 0));

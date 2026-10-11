// Ciche dźwięki gry i wibracje. Wszystko syntezowane w Web Audio (bez plików), włączane w Ustawieniach.
// Kontekst audio powstaje dopiero przy pierwszym dźwięku, czyli po dotknięciu ekranu, więc przeglądarka go nie blokuje.

export type Sfx = 'place' | 'note' | 'erase' | 'wrong' | 'unit' | 'win' | 'lose' | 'boom' | 'hit';

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicOut: GainNode | null = null;
let soundOn = true;
let vibrateOn = true;

export function configureSound(o: { sound: boolean; vibrate: boolean }) {
  soundOn = o.sound;
  vibrateOn = o.vibrate;
}

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    bus = ctx.createGain();
    bus.gain.value = 0.55;
    bus.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

function tone(f: number, at: number, dur: number, type: OscillatorType = 'sine', level = 0.12, slide = 0) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(bus!);
  o.start(at);
  o.stop(at + dur + 0.05);
}

const SFX: Record<Sfx, (t: number) => void> = {
  place: (t) => tone(hz(81), t, 0.12, 'sine', 0.14),
  note: (t) => tone(hz(93), t, 0.06, 'sine', 0.06),
  erase: (t) => tone(hz(76), t, 0.08, 'sine', 0.07, 0.8),
  wrong: (t) => { tone(220, t, 0.22, 'triangle', 0.12, 0.7); tone(233, t, 0.22, 'triangle', 0.08, 0.7); },
  unit: (t) => [74, 78, 81, 86].forEach((m, k) => tone(hz(m), t + k * 0.06, 0.5, 'sine', 0.09)),
  win: (t) => [62, 66, 69, 74, 78, 81, 86].forEach((m, k) => tone(hz(m), t + k * 0.09, 1.2, 'sine', 0.09)),
  lose: (t) => [69, 66, 62, 57].forEach((m, k) => tone(hz(m), t + k * 0.16, 0.7, 'triangle', 0.08)),
  boom: (t) => { tone(110, t, 0.5, 'triangle', 0.16, 0.4); tone(70, t, 0.6, 'sine', 0.14, 0.5); },
  hit: (t) => tone(160, t, 0.18, 'triangle', 0.1, 0.6),
};

/** Wzorce wibracji (ms) dla dźwięków, przy których telefon ma też drgnąć. */
const BUZZ: Partial<Record<Sfx, number | number[]>> = { wrong: 40, boom: [60, 40, 90], lose: [80, 60, 80] };

export function play(name: Sfx) {
  if (soundOn) {
    const c = audio();
    if (c) {
      if (c.state === 'suspended') void c.resume();
      try { SFX[name](c.currentTime + 0.01); } catch { /* bez dźwięku też się gra */ }
    }
  }
  const b = BUZZ[name];
  if (b !== undefined) buzz(b);
}

export function buzz(pattern: number | number[]) {
  if (!vibrateOn) return;
  try { navigator.vibrate?.(pattern); } catch { /* bez wibracji */ }
}

// --- muzyka w tle: „Kryształki” ---
// Ambient generowany na żywo: wolne akordy D-dur (pady z trójkątów przez filtr) i kilka losowych dzwonków na takt,
// wszystko przez pogłos zrobiony z szumu. Za każdym razem gra trochę inaczej, nie ma żadnych plików.

const CHORDS = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
const BELLS = [74, 76, 78, 81, 83, 86, 88];
const BAR_S = 8;

let musicVol = 0; // 0–100, 0 = cisza
let musicTimer = 0;
let chord = 0;
let gestureHooked = false;

const musicGain = (v: number) => Math.pow(v / 100, 1.6) * 0.8;

function musicNodes() {
  const c = audio();
  if (!c || musicBus) return c;
  const len = Math.floor(c.sampleRate * 3.5);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const verb = c.createConvolver();
  verb.buffer = buf;
  const wet = c.createGain();
  wet.gain.value = 0.55;
  const out = c.createGain();
  out.gain.value = 0;
  verb.connect(wet).connect(out);
  musicBus = c.createGain();
  musicBus.connect(out);
  musicBus.connect(verb);
  out.connect(c.destination);
  musicOut = out;
  return c;
}

function pad(c: AudioContext, notes: number[], t: number, dur: number) {
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1300;
  lp.Q.value = 0.3;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0, t + dur * 1.15);
  lp.connect(g).connect(musicBus!);
  for (const m of notes) for (const det of [-6, 6]) {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(m);
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur * 1.2);
  }
}

function bell(c: AudioContext, m: number, t: number) {
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  const g2 = c.createGain();
  o.frequency.value = hz(m);
  o2.frequency.value = hz(m) * 2.76;
  g2.gain.value = 0.18;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(musicBus!);
  o.start(t); o2.start(t);
  o.stop(t + 3); o2.stop(t + 3);
}

function bar() {
  const c = ctx;
  if (!c || !musicBus) return;
  const t = c.currentTime + 0.05;
  pad(c, CHORDS[chord++ % CHORDS.length], t, BAR_S);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let k = 0; k < n; k++) bell(c, BELLS[Math.floor(Math.random() * BELLS.length)], t + Math.random() * BAR_S);
}

const wantMusic = () => musicVol > 0 && !document.hidden;

function startMusic() {
  if (musicTimer || !wantMusic()) return;
  const c = musicNodes();
  if (!c || !musicOut) return;
  if (c.state === 'suspended') void c.resume();
  musicOut.gain.cancelScheduledValues(c.currentTime);
  musicOut.gain.setTargetAtTime(musicGain(musicVol), c.currentTime, 0.8);
  bar();
  musicTimer = window.setInterval(bar, BAR_S * 1000);
}

function stopMusic() {
  if (!musicTimer) return;
  window.clearInterval(musicTimer);
  musicTimer = 0;
  if (ctx && musicOut) musicOut.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}

/** Głośność muzyki 0–100 (suwak w Ustawieniach). Gra dopiero po pierwszym dotknięciu strony, bo tak chcą przeglądarki. */
export function setMusicVolume(v: number) {
  musicVol = Math.max(0, Math.min(100, v));
  if (!gestureHooked) {
    gestureHooked = true;
    const kick = () => { if (wantMusic()) startMusic(); };
    window.addEventListener('pointerdown', kick, { passive: true });
    window.addEventListener('keydown', kick);
    document.addEventListener('visibilitychange', () => (wantMusic() ? startMusic() : stopMusic()));
  }
  if (!musicVol) return stopMusic();
  if (musicTimer && ctx && musicOut) musicOut.gain.setTargetAtTime(musicGain(musicVol), ctx.currentTime, 0.05);
  // Strona była już dotknięta (np. ktoś właśnie ciągnie suwak), więc można grać od razu.
  else if (ctx || (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) startMusic();
}

import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// Pokój dla kilku graczy: wiadomości do wszystkich i lista obecnych.
// Na produkcji Supabase Realtime, a z ?net=local w adresie zakładki tej samej przeglądarki (do testów bez sieci).

export interface RoomMsg { t: string; [k: string]: unknown }

export interface Room {
  readonly me: string;
  send(msg: RoomMsg): void;
  onMessage(fn: (msg: RoomMsg, from: string) => void): void;
  /** Kto oprócz mnie jest teraz w pokoju. */
  onPeers(fn: (others: string[]) => void): void;
  leave(): void;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
const CONNECT_TIMEOUT_MS = 10000;

export function joinRoom(name: string): Promise<Room> {
  const local = new URLSearchParams(location.search).get('net') === 'local';
  return local ? localRoom(name) : supabaseRoom(name);
}

let client: RealtimeClient | null = null;

function supabaseRoom(name: string): Promise<Room> {
  const me = newId();
  client ??= new RealtimeClient(SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1', {
    params: { apikey: SUPABASE_ANON_KEY, eventsPerSecond: 20 },
  });
  const ch: RealtimeChannel = client.channel(`soodoku:${name}`, {
    config: { broadcast: { self: false }, presence: { key: me } },
  });
  const msgFns: ((m: RoomMsg, from: string) => void)[] = [];
  const peerFns: ((o: string[]) => void)[] = [];
  let others: string[] = [];
  ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
    const p = payload as { from?: string; m?: RoomMsg };
    if (p?.m && typeof p.m.t === 'string' && p.from) msgFns.forEach((f) => f(p.m!, p.from!));
  });
  ch.on('presence', { event: 'sync' }, () => {
    others = Object.keys(ch.presenceState()).filter((k) => k !== me);
    peerFns.forEach((f) => f(others));
  });
  return new Promise((resolve, reject) => {
    let done = false;
    const fail = (why: string) => {
      if (done) return;
      done = true;
      void client?.removeChannel(ch);
      reject(new Error(why));
    };
    const timer = window.setTimeout(() => fail('timeout'), CONNECT_TIMEOUT_MS);
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && !done) {
        done = true;
        window.clearTimeout(timer);
        await ch.track({ at: Date.now() });
        resolve({
          me,
          send: (m) => { void ch.send({ type: 'broadcast', event: 'msg', payload: { from: me, m } }); },
          onMessage: (f) => { msgFns.push(f); },
          onPeers: (f) => { peerFns.push(f); f(others); },
          leave: () => { msgFns.length = 0; peerFns.length = 0; void ch.untrack(); void client?.removeChannel(ch); },
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        window.clearTimeout(timer);
        fail(status);
      }
    });
  });
}

/** Zamiennik na BroadcastChannel: ta sama przeglądarka, bez serwera. Obecność przez bicie serca. */
function localRoom(name: string): Promise<Room> {
  const me = newId();
  const bc = new BroadcastChannel(`soodoku:${name}`);
  const msgFns: ((m: RoomMsg, from: string) => void)[] = [];
  const peerFns: ((o: string[]) => void)[] = [];
  const seen = new Map<string, number>();
  let last = '';
  const emitPeers = () => {
    const now = Date.now();
    for (const [id, at] of seen) if (now - at > 5000) seen.delete(id);
    const others = [...seen.keys()].sort();
    if (others.join() === last) return;
    last = others.join();
    peerFns.forEach((f) => f(others));
  };
  bc.onmessage = (e) => {
    const d = e.data as { k: string; from: string; m?: RoomMsg };
    if (d.from === me) return;
    if (d.k === 'bye') seen.delete(d.from);
    else seen.set(d.from, Date.now());
    if (d.k === 'hi') bc.postMessage({ k: 'beat', from: me });
    if (d.k === 'msg' && d.m) msgFns.forEach((f) => f(d.m!, d.from));
    emitPeers();
  };
  bc.postMessage({ k: 'hi', from: me });
  const beat = window.setInterval(() => { bc.postMessage({ k: 'beat', from: me }); emitPeers(); }, 1500);
  return Promise.resolve({
    me,
    send: (m) => bc.postMessage({ k: 'msg', from: me, m }),
    onMessage: (f) => { msgFns.push(f); },
    onPeers: (f) => { peerFns.push(f); f([...seen.keys()]); },
    leave: () => { window.clearInterval(beat); bc.postMessage({ k: 'bye', from: me }); bc.close(); msgFns.length = 0; peerFns.length = 0; },
  });
}

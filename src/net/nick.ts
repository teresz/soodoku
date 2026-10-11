// Nick w rankingu: podawany przy zakładaniu konta (stare konta: raz w Ustawieniach), potem już się nie zmienia.
// Sprawdzanie tutaj to tylko szybka podpowiedź w formularzu; ostatnie słowo ma funkcja nick_check w supabase/leaderboard.sql.
import { rpc } from './account';

export type NickProblem = 'invalid' | 'rude' | 'taken' | 'locked' | 'network';

const ALLOWED = /^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{3,16}$/;
// Ta sama lista co w SQL. Rdzenie, więc łapie też odmiany („kurwa”, „kurwiszon”, „F.u.c.k”, „ch0j”).
const RUDE = /(kurw|chuj|choj|huj|pierd|jeb|pizd|cipa|cipk|kutas|fiut|dziwk|szmat|pedal|pedzi|ciota|sukinsyn|skurw|cwel|zjeb|gowno|gowna|sraj|sran|srac|ruchac|ruchan|dupa|dupe|dupy|dupk|chwdp|hitler|nazi|fuck|fuk|shit|cunt|bitch|nigg|niga|fag|dick|cock|puss|whore|slut|rapist|asshole|bastard|penis|vagina|porn|sex)/;
const FROM = 'ąćęłńóśźż0134578';
const TO = 'acelnoszzoieastb';

/** Spłaszcza nick tak jak SQL: małe litery, bez ogonków, cyfry jak litery, same litery a–z. */
export function flatten(nick: string): string {
  return [...nick.toLowerCase()].map((ch) => { const k = FROM.indexOf(ch); return k < 0 ? ch : TO[k]; }).join('').replace(/[^a-z]/g, '');
}

/** Błąd widoczny bez pytania serwera albo null, gdy nick wygląda dobrze. */
export function localNickProblem(nick: string): 'invalid' | 'rude' | null {
  const n = nick.trim();
  if (!ALLOWED.test(n)) return 'invalid';
  if (RUDE.test(flatten(n))) return 'rude';
  return null;
}

export async function checkNick(nick: string): Promise<NickProblem | null> {
  const local = localNickProblem(nick);
  if (local) return local;
  try {
    const r = await rpc<string>('nick_check', { p_nick: nick.trim() });
    return r === 'ok' ? null : (r as NickProblem) ?? 'network';
  } catch { return 'network'; }
}

export async function setNick(nick: string): Promise<NickProblem | null> {
  const local = localNickProblem(nick);
  if (local) return local;
  try {
    const r = await rpc<string>('set_nick', { p_nick: nick.trim() });
    return r === 'ok' ? null : r === 'signed_out' ? 'network' : (r as NickProblem) ?? 'network';
  } catch { return 'network'; }
}

export async function myNick(): Promise<string | null> {
  try { return await rpc<string>('my_nick'); } catch { return null; }
}

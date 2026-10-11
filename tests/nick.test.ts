import { describe, expect, it } from 'vitest';
import { flatten, localNickProblem } from '../src/net/nick';

describe('nick', () => {
  it('przepuszcza normalne nicki', () => {
    for (const n of ['teresz', 'Żaba_77', 'mistrz.sudoku', 'Ola-K']) expect(localNickProblem(n)).toBeNull();
  });
  it('odrzuca złe znaki i długość', () => {
    for (const n of ['ab', 'a'.repeat(17), 'ze spacją', 'emoji😀']) expect(localNickProblem(n)).toBe('invalid');
  });
  it('łapie wulgaryzmy z przebraniem', () => {
    expect(flatten('K.U.R.W.4')).toBe('kurwa');
    for (const n of ['kurwiszon', 'Ch0jek', 'F_u_c_k', 'pierdolec', 'xXSh1tXx', 'jebac_pis']) expect(localNickProblem(n)).toBe('rude');
  });
});

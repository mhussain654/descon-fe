import { isPakistanBank, PAKISTAN_BANKS } from './pakistanBanks';

describe('PAKISTAN_BANKS', () => {
  it('has no duplicate names', () => {
    expect(new Set(PAKISTAN_BANKS).size).toBe(PAKISTAN_BANKS.length);
  });
});

describe('isPakistanBank', () => {
  it('accepts a listed bank', () => {
    expect(isPakistanBank('Meezan Bank Limited')).toBe(true);
  });

  it('rejects free text and the empty string', () => {
    expect(isPakistanBank('Meezan Bank')).toBe(false);
    expect(isPakistanBank('')).toBe(false);
  });
});

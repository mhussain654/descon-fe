import { hasBankDetailFormErrors, normalizeAccountNumber, validateBankDetailFields } from './formValidation';

describe('validateBankDetailFields', () => {
  it('passes with valid fields', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36SCBL0000001123456702', bankName: 'Meezan Bank' });
    expect(hasBankDetailFormErrors(errors)).toBe(false);
  });

  it('requires account title', () => {
    const errors = validateBankDetailFields({ accountTitle: '  ', accountNumber: 'PK36SCBL0000001123456702', bankName: 'Meezan Bank' });
    expect(errors.accountTitle).toBe('REQUIRED');
  });

  it('requires account number', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '  ', bankName: 'Meezan Bank' });
    expect(errors.accountNumber).toBe('REQUIRED');
  });

  it('requires bank name', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36SCBL0000001123456702', bankName: '' });
    expect(errors.bankName).toBe('REQUIRED');
  });

  it('rejects an account number shorter than 4 characters after normalization', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'ab1', bankName: 'Meezan Bank' });
    expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
  });

  it('rejects an account number longer than 34 characters after normalization', () => {
    const errors = validateBankDetailFields({
      accountTitle: 'Ahmed Ali',
      accountNumber: 'A'.repeat(35),
      bankName: 'Meezan Bank',
    });
    expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
  });

  it('rejects an account number with characters outside A-Z0-9', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36-SCBL-0000', bankName: 'Meezan Bank' });
    expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
  });

  it('accepts a lowercase account number, normalizing before validating', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'pk36scbl0000001123456702', bankName: 'Meezan Bank' });
    expect(errors.accountNumber).toBeUndefined();
  });

  it('accepts an account number with internal whitespace, stripping it before validating', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36 SCBL 0000 0011 2345 6702', bankName: 'Meezan Bank' });
    expect(errors.accountNumber).toBeUndefined();
  });

  it('reports every invalid field at once, not just the first', () => {
    const errors = validateBankDetailFields({ accountTitle: '', accountNumber: '', bankName: '' });
    expect(errors).toEqual({ accountTitle: 'REQUIRED', accountNumber: 'REQUIRED', bankName: 'REQUIRED' });
  });
});

describe('normalizeAccountNumber', () => {
  it('uppercases and strips whitespace, matching the backend AccountNumberNormalizer', () => {
    expect(normalizeAccountNumber(' pk36 scbl 0000001123456702 ')).toBe('PK36SCBL0000001123456702');
  });
});

describe('hasBankDetailFormErrors', () => {
  it('is false for an empty errors object', () => {
    expect(hasBankDetailFormErrors({})).toBe(false);
  });

  it('is true when any field has an error', () => {
    expect(hasBankDetailFormErrors({ accountTitle: 'REQUIRED' })).toBe(true);
  });
});

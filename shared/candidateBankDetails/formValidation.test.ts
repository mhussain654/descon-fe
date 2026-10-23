import { hasBankDetailFormErrors, normalizeAccountNumber, validateBankDetailFields } from './formValidation';

describe('validateBankDetailFields', () => {
  it('passes with valid fields', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '0000001123456702', bankName: 'Meezan Bank Limited' });
    expect(hasBankDetailFormErrors(errors)).toBe(false);
  });

  it('requires account title', () => {
    const errors = validateBankDetailFields({ accountTitle: '  ', accountNumber: '0000001123456702', bankName: 'Meezan Bank Limited' });
    expect(errors.accountTitle).toBe('REQUIRED');
  });

  it('requires account number', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '  ', bankName: 'Meezan Bank Limited' });
    expect(errors.accountNumber).toBe('REQUIRED');
  });

  it('requires bank name', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '0000001123456702', bankName: '' });
    expect(errors.bankName).toBe('REQUIRED');
  });

  it('rejects an account number shorter than 6 digits', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '12345', bankName: 'Meezan Bank Limited' });
    expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
  });

  it('accepts exactly 6 and exactly 20 digits', () => {
    expect(validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '123456', bankName: 'Meezan Bank Limited' }).accountNumber).toBeUndefined();
    expect(validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '1'.repeat(20), bankName: 'Meezan Bank Limited' }).accountNumber).toBeUndefined();
  });

  it('rejects an account number longer than 20 digits', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '1'.repeat(21), bankName: 'Meezan Bank Limited' });
    expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
  });

  it('rejects letters and punctuation, including an IBAN', () => {
    for (const accountNumber of ['PK36SCBL0000001123456702', '0000-0011-2345', '12345a']) {
      const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber, bankName: 'Meezan Bank Limited' });
      expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
    }
  });

  it('accepts an account number with internal whitespace, stripping it before validating', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '0000 0011 2345 6702', bankName: 'Meezan Bank Limited' });
    expect(errors.accountNumber).toBeUndefined();
  });

  it('rejects a bank that is not in the list', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '0000001123456702', bankName: 'Some Other Bank' });
    expect(errors.bankName).toBe('REQUIRED');
  });

  it('reports every invalid field at once, not just the first', () => {
    const errors = validateBankDetailFields({ accountTitle: '', accountNumber: '', bankName: '' });
    expect(errors).toEqual({ accountTitle: 'REQUIRED', accountNumber: 'REQUIRED', bankName: 'REQUIRED' });
  });
});

describe('normalizeAccountNumber', () => {
  it('strips whitespace, matching the backend AccountNumberNormalizer', () => {
    expect(normalizeAccountNumber(' 0000 0011 2345 6702 ')).toBe('0000001123456702');
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

import { hasBankDetailFormErrors, normalizeAccountNumber, validateBankDetailFields } from './formValidation';

describe('validateBankDetailFields', () => {
  it('passes with valid fields', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36SCBL0000001123456702', bankName: 'Meezan Bank Limited' });
    expect(hasBankDetailFormErrors(errors)).toBe(false);
  });

  it('requires account title', () => {
    const errors = validateBankDetailFields({ accountTitle: '  ', accountNumber: 'PK36SCBL0000001123456702', bankName: 'Meezan Bank Limited' });
    expect(errors.accountTitle).toBe('REQUIRED');
  });

  it('requires account number', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '  ', bankName: 'Meezan Bank Limited' });
    expect(errors.accountNumber).toBe('REQUIRED');
  });

  it('requires bank name', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36SCBL0000001123456702', bankName: '' });
    expect(errors.bankName).toBe('REQUIRED');
  });

  it('rejects an account number shorter than 6 digits', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: '12345', bankName: 'Meezan Bank Limited' });
    expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
  });

  it('accepts a full Pakistani IBAN', () => {
    for (const accountNumber of ['PK36SCBL0000001123456702', 'pk09scbl0000001123456703']) {
      expect(validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber, bankName: 'Meezan Bank Limited' }).accountNumber).toBeUndefined();
    }
  });

  it('rejects a plain account number, a wrong length, a foreign IBAN and a wrong check digit', () => {
    for (const accountNumber of ['0000001123456702', 'PK36SCBL000000112345670', 'GB82WEST12345698765432', 'PK37SCBL0000001123456702']) {
      const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber, bankName: 'Meezan Bank Limited' });
      expect(errors.accountNumber).toBe('INVALID_ACCOUNT_NUMBER');
    }
  });

  it('accepts an IBAN with internal whitespace, stripping it before validating', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36 SCBL 0000 0011 2345 6702', bankName: 'Meezan Bank Limited' });
    expect(errors.accountNumber).toBeUndefined();
  });

  it('rejects a bank that is not in the list', () => {
    const errors = validateBankDetailFields({ accountTitle: 'Ahmed Ali', accountNumber: 'PK36SCBL0000001123456702', bankName: 'Some Other Bank' });
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

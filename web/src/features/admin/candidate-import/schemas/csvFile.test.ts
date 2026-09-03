import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, validateCsvFile } from './csvFile';

function csvFile(name: string, sizeBytes: number, type = 'text/csv') {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
}

describe('validateCsvFile', () => {
  it('requires a file', () => {
    expect(validateCsvFile(null)).toBe('FILE_REQUIRED');
  });

  it('accepts a well-formed .csv file within the size limit', () => {
    expect(validateCsvFile(csvFile('candidates.csv', 1024))).toBeNull();
  });

  it('rejects a non-.csv extension', () => {
    expect(validateCsvFile(csvFile('candidates.xlsx', 1024, 'application/vnd.ms-excel'))).toBe('INVALID_TYPE');
  });

  it('rejects an unexpected MIME type even with a .csv extension', () => {
    expect(validateCsvFile(csvFile('candidates.csv', 1024, 'application/pdf'))).toBe('INVALID_TYPE');
  });

  it('accepts a .csv file with an empty MIME type (some OS/browser combinations never set one)', () => {
    expect(validateCsvFile(csvFile('candidates.csv', 1024, ''))).toBeNull();
  });

  it('rejects a file larger than the limit', () => {
    expect(validateCsvFile(csvFile('candidates.csv', MAX_FILE_BYTES + 1))).toBe('FILE_TOO_LARGE');
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateCsvFile(csvFile('candidates.csv', MAX_FILE_BYTES))).toBeNull();
  });
});

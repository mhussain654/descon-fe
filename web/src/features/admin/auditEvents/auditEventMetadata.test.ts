import { describe, expect, it } from 'vitest';
import { approvedMetadataEntries, formatMetadataValue, isApprovedMetadataKey } from './auditEventMetadata';

describe('isApprovedMetadataKey', () => {
  it('approves an opaque public id', () => {
    expect(isApprovedMetadataKey('candidate_public_id')).toBe(true);
  });

  it('approves an enum/status code', () => {
    expect(isApprovedMetadataKey('provider_status_code')).toBe(true);
  });

  it('approves a plural codes list key', () => {
    expect(isApprovedMetadataKey('required_requirement_codes')).toBe(true);
  });

  it('approves a timestamp key', () => {
    expect(isApprovedMetadataKey('checkout_expires_at')).toBe(true);
  });

  it('approves a count key', () => {
    expect(isApprovedMetadataKey('total_rows')).toBe(true);
  });

  it('approves an explicitly listed safe exact key', () => {
    expect(isApprovedMetadataKey('flight_number')).toBe(true);
  });

  it.each(['reason', 'field', 'previous_value', 'new_value', 'before', 'after', 'details', 'evidence'])(
    'blocks the sensitive key "%s" even though it does not match a safe suffix',
    (key) => {
      expect(isApprovedMetadataKey(key)).toBe(false);
    }
  );

  it('blocks a key that matches no safe suffix or exact name', () => {
    expect(isApprovedMetadataKey('some_future_unreviewed_field')).toBe(false);
  });

  it('blocks a key that merely contains a safe suffix as a substring, not as its actual suffix', () => {
    expect(isApprovedMetadataKey('status_code_history')).toBe(false);
  });
});

describe('formatMetadataValue', () => {
  it('formats a string as-is', () => {
    expect(formatMetadataValue('kuickpay')).toBe('kuickpay');
  });

  it('formats a number as a string', () => {
    expect(formatMetadataValue(42)).toBe('42');
  });

  it('formats a boolean as a string', () => {
    expect(formatMetadataValue(true)).toBe('true');
  });

  it('formats null as an em dash placeholder', () => {
    expect(formatMetadataValue(null)).toBe('—');
  });

  it('formats undefined as an em dash placeholder', () => {
    expect(formatMetadataValue(undefined)).toBe('—');
  });

  it('formats an empty array as an em dash placeholder', () => {
    expect(formatMetadataValue([])).toBe('—');
  });

  it('joins an array of primitive values with a comma', () => {
    expect(formatMetadataValue(['passport', 'cnic_front'])).toBe('passport, cnic_front');
  });

  it('summarizes an array containing a non-primitive item by count, never inspecting its contents', () => {
    expect(formatMetadataValue([{ a: 1 }, { b: 2 }, 'x'])).toBe('(3 items)');
  });

  it('never renders a nested object as "[object Object]"', () => {
    expect(formatMetadataValue({ role: 'admin', staff_state: 'active' })).toBe('(unavailable)');
  });

  it('never renders a nested array of objects\' contents', () => {
    expect(formatMetadataValue([{ from: 'a', to: 'b' }])).toBe('(1 items)');
  });
});

describe('approvedMetadataEntries', () => {
  it('keeps only approved keys, in their original order, with safely formatted values', () => {
    const entries = approvedMetadataEntries({
      provider_status_code: 'settled',
      reason: 'Refunded per candidate request -- spoke to Ahmed Khan directly',
      import_public_id: 'batch-123',
    });

    expect(entries).toEqual([
      ['provider_status_code', 'settled'],
      ['import_public_id', 'batch-123'],
    ]);
  });

  it('drops a blocked key even when its value is a nested object', () => {
    const entries = approvedMetadataEntries({
      before: { role: 'hr', staff_state: 'active' },
      after: { role: 'admin', staff_state: 'active' },
      status_code: 'role_updated',
    });

    expect(entries).toEqual([['status_code', 'role_updated']]);
  });

  it('returns an empty list for metadata with no approved keys', () => {
    expect(approvedMetadataEntries({ reason: 'x', field: 'y' })).toEqual([]);
  });

  it('returns an empty list for empty metadata', () => {
    expect(approvedMetadataEntries({})).toEqual([]);
  });
});

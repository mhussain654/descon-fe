import { humanizeStatusCode } from './formatting';

describe('humanizeStatusCode', () => {
  it('replaces underscores with spaces and capitalizes each word', () => {
    expect(humanizeStatusCode('documents_pending')).toBe('Documents Pending');
    expect(humanizeStatusCode('registered')).toBe('Registered');
  });

  it('handles an already-clean single word', () => {
    expect(humanizeStatusCode('active')).toBe('Active');
  });
});

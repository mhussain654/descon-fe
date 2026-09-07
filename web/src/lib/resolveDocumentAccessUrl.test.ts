import { describe, expect, it } from 'vitest';
import { resolveDocumentAccessUrl } from './resolveDocumentAccessUrl';

describe('resolveDocumentAccessUrl', () => {
  it('resolves a relative access path against the API origin, dropping the /api/v1 prefix', () => {
    const resolved = resolveDocumentAccessUrl(
      '/rails/active_storage/blobs/redirect/xyz/passport.pdf',
      'http://localhost:3000/api/v1'
    );
    expect(resolved).toBe('http://localhost:3000/rails/active_storage/blobs/redirect/xyz/passport.pdf');
  });

  it('returns an empty string for an empty access path', () => {
    expect(resolveDocumentAccessUrl('', 'http://localhost:3000/api/v1')).toBe('');
  });

  it('fails closed (null) when no API base URL is configured -- there is nothing to validate against', () => {
    expect(resolveDocumentAccessUrl('/rails/blobs/xyz', '')).toBeNull();
  });

  it('fails closed (null) if the configured base URL is unparseable', () => {
    expect(resolveDocumentAccessUrl('/rails/blobs/xyz', 'not-a-url')).toBeNull();
  });

  it('works with a production-style HTTPS origin', () => {
    const resolved = resolveDocumentAccessUrl('/rails/active_storage/blobs/redirect/abc/file.png', 'https://api.descon.example/api/v1');
    expect(resolved).toBe('https://api.descon.example/rails/active_storage/blobs/redirect/abc/file.png');
  });

  describe('malicious and malformed values (security regression)', () => {
    const API_BASE_URL = 'https://api.descon.example/api/v1';

    it('fails closed for an absolute URL pointing at a different origin', () => {
      expect(resolveDocumentAccessUrl('https://evil.example/passport.pdf', API_BASE_URL)).toBeNull();
    });

    it('fails closed for a lookalike domain that merely starts with the real API origin', () => {
      expect(resolveDocumentAccessUrl('https://api.descon.example.evil.example/x', API_BASE_URL)).toBeNull();
    });

    it('fails closed for a protocol-relative URL that resolves to a different host', () => {
      expect(resolveDocumentAccessUrl('//evil.example/x', API_BASE_URL)).toBeNull();
    });

    it('fails closed for a javascript: URL', () => {
      expect(resolveDocumentAccessUrl('javascript:alert(1)', API_BASE_URL)).toBeNull();
    });

    it('fails closed for a data: URL', () => {
      expect(resolveDocumentAccessUrl('data:text/html,<script>alert(1)</script>', API_BASE_URL)).toBeNull();
    });

    it('fails closed for a file: URL', () => {
      expect(resolveDocumentAccessUrl('file:///etc/passwd', API_BASE_URL)).toBeNull();
    });

    it('fails closed for an HTTP downgrade of the real host', () => {
      expect(resolveDocumentAccessUrl('http://api.descon.example/x', API_BASE_URL)).toBeNull();
    });

    it('fails closed when the access path embeds credentials before a lookalike host', () => {
      expect(resolveDocumentAccessUrl('https://api.descon.example:pw@evil.example/x', API_BASE_URL)).toBeNull();
    });

    it('accepts an absolute URL that happens to already match the exact approved origin', () => {
      expect(resolveDocumentAccessUrl(`${API_BASE_URL.replace('/api/v1', '')}/rails/blobs/xyz`, API_BASE_URL)).toBe(
        'https://api.descon.example/rails/blobs/xyz'
      );
    });
  });
});

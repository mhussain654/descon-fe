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

  it('returns the raw path unchanged when no API base URL is configured', () => {
    expect(resolveDocumentAccessUrl('/rails/blobs/xyz', '')).toBe('/rails/blobs/xyz');
  });

  it('returns the raw path unchanged if the configured base URL is unparseable', () => {
    expect(resolveDocumentAccessUrl('/rails/blobs/xyz', 'not-a-url')).toBe('/rails/blobs/xyz');
  });

  it('works with a production-style HTTPS origin', () => {
    const resolved = resolveDocumentAccessUrl('/rails/active_storage/blobs/redirect/abc/file.png', 'https://api.descon.example/api/v1');
    expect(resolved).toBe('https://api.descon.example/rails/active_storage/blobs/redirect/abc/file.png');
  });
});

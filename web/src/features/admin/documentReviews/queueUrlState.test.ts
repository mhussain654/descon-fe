import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_STATUS_FILTER,
  readQueueStateFromSearchParams,
  writeQueueStateToSearchParams,
} from './queueUrlState';

describe('readQueueStateFromSearchParams', () => {
  it('falls back to the backend default statuses and page 1/size 20 when the URL has no params', () => {
    const state = readQueueStateFromSearchParams(new URLSearchParams());
    expect(state.filters.status).toEqual(DEFAULT_STATUS_FILTER);
    expect(state.page).toEqual({ number: 1, size: DEFAULT_PAGE_SIZE });
  });

  it('reads a comma-separated status list', () => {
    const state = readQueueStateFromSearchParams(new URLSearchParams('status=verified,changes_required'));
    expect(state.filters.status).toEqual(['verified', 'changes_required']);
  });

  it('drops an unrecognized status value rather than sending it to the backend', () => {
    const state = readQueueStateFromSearchParams(new URLSearchParams('status=verified,not_a_real_status'));
    expect(state.filters.status).toEqual(['verified']);
  });

  it('falls back to the default when every status value is unrecognized', () => {
    const state = readQueueStateFromSearchParams(new URLSearchParams('status=garbage'));
    expect(state.filters.status).toEqual(DEFAULT_STATUS_FILTER);
  });

  it('reads candidateId, project, country, from and to', () => {
    const state = readQueueStateFromSearchParams(
      new URLSearchParams('candidateId=cand-1&project=PRJ-1&country=SA&from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z')
    );
    expect(state.filters).toMatchObject({
      candidatePublicId: 'cand-1',
      projectCode: 'PRJ-1',
      countryCode: 'SA',
      submittedFrom: '2026-08-01T00:00:00Z',
      submittedTo: '2026-08-31T23:59:59Z',
    });
  });

  it('reads page and size', () => {
    const state = readQueueStateFromSearchParams(new URLSearchParams('page=3&size=50'));
    expect(state.page).toEqual({ number: 3, size: 50 });
  });

  it('falls back to page 1 for an invalid page value', () => {
    const state = readQueueStateFromSearchParams(new URLSearchParams('page=-5'));
    expect(state.page.number).toBe(1);
  });
});

describe('writeQueueStateToSearchParams', () => {
  it('writes the status filter as a comma-joined list', () => {
    const params = writeQueueStateToSearchParams({ status: ['verified', 'changes_required'] }, {});
    expect(params.get('status')).toBe('verified,changes_required');
  });

  it('writes candidateId, project, country, from and to', () => {
    const params = writeQueueStateToSearchParams(
      {
        candidatePublicId: 'cand-1',
        projectCode: 'PRJ-1',
        countryCode: 'SA',
        submittedFrom: '2026-08-01T00:00:00Z',
        submittedTo: '2026-08-31T23:59:59Z',
      },
      {}
    );
    expect(params.get('candidateId')).toBe('cand-1');
    expect(params.get('project')).toBe('PRJ-1');
    expect(params.get('country')).toBe('SA');
    expect(params.get('from')).toBe('2026-08-01T00:00:00Z');
    expect(params.get('to')).toBe('2026-08-31T23:59:59Z');
  });

  it('omits page/size from the URL when they are page 1 / the default size', () => {
    const params = writeQueueStateToSearchParams({}, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(params.has('page')).toBe(false);
    expect(params.has('size')).toBe(false);
  });

  it('writes page/size when they differ from the defaults', () => {
    const params = writeQueueStateToSearchParams({}, { number: 3, size: 50 });
    expect(params.get('page')).toBe('3');
    expect(params.get('size')).toBe('50');
  });

  it('round-trips through read -> write -> read unchanged', () => {
    const original = readQueueStateFromSearchParams(new URLSearchParams('status=verified&candidateId=cand-1&page=2&size=50'));
    const written = writeQueueStateToSearchParams(original.filters, original.page);
    const roundTripped = readQueueStateFromSearchParams(written);
    expect(roundTripped).toEqual(original);
  });
});

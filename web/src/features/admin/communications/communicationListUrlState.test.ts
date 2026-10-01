import {
  DEFAULT_PAGE_SIZE,
  readCommunicationListStateFromSearchParams,
  writeCommunicationListStateToSearchParams,
} from './communicationListUrlState';

describe('communicationListUrlState', () => {
  it('falls back to no filters/sort and page 1/default size when the URL has no params', () => {
    const state = readCommunicationListStateFromSearchParams(new URLSearchParams());
    expect(state.filters).toEqual({
      channel: undefined,
      direction: undefined,
      status: undefined,
      candidateAssignment: undefined,
      candidate: undefined,
      occurredFrom: undefined,
      occurredTo: undefined,
    });
    expect(state.sort).toBeUndefined();
    expect(state.page).toEqual({ number: 1, size: DEFAULT_PAGE_SIZE });
  });

  it('reads every filter, sort and page from the URL', () => {
    const params = new URLSearchParams(
      'channel=ai_voice_call&direction=outbound&status=completed&assignment=d8805480-7d1b-4ef4-aee6-c76dd026e3e4' +
        '&candidate=bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd&from=2026-08-01&to=2026-08-31&sort=created_at&page=3&size=50'
    );
    const state = readCommunicationListStateFromSearchParams(params);
    expect(state.filters).toEqual({
      channel: 'ai_voice_call',
      direction: 'outbound',
      status: 'completed',
      candidateAssignment: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4',
      candidate: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd',
      occurredFrom: '2026-08-01',
      occurredTo: '2026-08-31',
    });
    expect(state.sort).toBe('created_at');
    expect(state.page).toEqual({ number: 3, size: 50 });
  });

  it('drops an unrecognized sort value rather than forwarding it to the backend', () => {
    expect(readCommunicationListStateFromSearchParams(new URLSearchParams('sort=not_a_real_sort')).sort).toBeUndefined();
  });

  it('drops an unrecognized direction value rather than forwarding it to the backend', () => {
    expect(readCommunicationListStateFromSearchParams(new URLSearchParams('direction=sideways')).filters.direction).toBeUndefined();
  });

  it('drops a malformed occurred_from/occurred_to date rather than forwarding it to the backend', () => {
    const state = readCommunicationListStateFromSearchParams(new URLSearchParams('from=not-a-date&to=08/31/2026'));
    expect(state.filters.occurredFrom).toBeUndefined();
    expect(state.filters.occurredTo).toBeUndefined();
  });

  it('falls back to page 1 for an invalid or negative page number', () => {
    expect(readCommunicationListStateFromSearchParams(new URLSearchParams('page=-5')).page.number).toBe(1);
    expect(readCommunicationListStateFromSearchParams(new URLSearchParams('page=abc')).page.number).toBe(1);
  });

  it('omits filters/sort from the URL when unset', () => {
    const params = writeCommunicationListStateToSearchParams({}, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(Array.from(params.keys())).toEqual([]);
  });

  it('omits page/size from the URL when they are page 1 / the default size', () => {
    const params = writeCommunicationListStateToSearchParams({ channel: 'ai_voice_call' }, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(params.has('page')).toBe(false);
    expect(params.has('size')).toBe(false);
  });

  it('writes every set filter, sort and non-default page/size explicitly', () => {
    const params = writeCommunicationListStateToSearchParams(
      {
        channel: 'ai_voice_call',
        direction: 'inbound',
        status: 'failed',
        candidateAssignment: 'assignment-id',
        candidate: 'candidate-id',
        occurredFrom: '2026-08-01',
        occurredTo: '2026-08-31',
      },
      'created_at',
      { number: 2, size: 50 }
    );
    expect(params.get('channel')).toBe('ai_voice_call');
    expect(params.get('direction')).toBe('inbound');
    expect(params.get('status')).toBe('failed');
    expect(params.get('assignment')).toBe('assignment-id');
    expect(params.get('candidate')).toBe('candidate-id');
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-31');
    expect(params.get('sort')).toBe('created_at');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('50');
  });

  it('round-trips through read/write without losing state', () => {
    const original = new URLSearchParams('channel=ai_voice_call&direction=outbound&sort=created_at&page=2&size=10');
    const state = readCommunicationListStateFromSearchParams(original);
    const rebuilt = writeCommunicationListStateToSearchParams(state.filters, state.sort, state.page);

    expect(readCommunicationListStateFromSearchParams(rebuilt)).toEqual(state);
  });
});

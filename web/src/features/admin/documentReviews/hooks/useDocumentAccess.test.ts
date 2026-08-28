import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentAccess } from './useDocumentAccess';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';

vi.mock('../../../../lib/admin-document-reviews-client', () => ({
  adminDocumentReviewsClient: { requestDocumentAccess: vi.fn() },
}));

const mockUseStaffAuth = vi.fn();
vi.mock('../../../../contexts/StaffAuthContext', () => ({
  useStaffAuth: () => mockUseStaffAuth(),
}));

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function access(overrides = {}) {
  return { documentId: 'doc-1', url: '/rails/active_storage/blobs/redirect/x/f.pdf', expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides };
}

describe('useDocumentAccess', () => {
  beforeEach(() => {
    mockUseStaffAuth.mockReturnValue({ status: 'authenticated' });
  });

  afterEach(() => {
    vi.mocked(adminDocumentReviewsClient.requestDocumentAccess).mockReset();
    mockUseStaffAuth.mockReset();
  });

  it('stores the access credential on a successful request', async () => {
    adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue(access());
    const { result } = renderHook(() => useDocumentAccess());

    await act(async () => {
      await result.current.requestAccess('doc-1');
    });

    expect(result.current.access?.documentId).toBe('doc-1');
    expect(result.current.isRequesting).toBe(false);
  });

  // "Close" and "navigate to a different submission" both go through the
  // same clearAccess() call (SubmissionDetail's own effect calls it on a
  // submissionId change) -- this covers both.
  it('does not restore access if clearAccess() (dialog close, or navigating away) runs before the response resolves', async () => {
    const request = deferred();
    adminDocumentReviewsClient.requestDocumentAccess.mockReturnValue(request.promise);
    const { result } = renderHook(() => useDocumentAccess());

    let pending;
    act(() => {
      pending = result.current.requestAccess('doc-1');
    });
    act(() => {
      result.current.clearAccess();
    });
    await act(async () => {
      request.resolve(access());
      await pending;
    });

    expect(result.current.access).toBeNull();
    expect(result.current.isRequesting).toBe(false);
  });

  it('does not let a slower response for document A overwrite access already granted for document B', async () => {
    const requestA = deferred();
    const requestB = deferred();
    adminDocumentReviewsClient.requestDocumentAccess.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    const { result } = renderHook(() => useDocumentAccess());

    let pendingA;
    act(() => {
      pendingA = result.current.requestAccess('doc-A');
    });
    let pendingB;
    act(() => {
      pendingB = result.current.requestAccess('doc-B');
    });

    await act(async () => {
      requestB.resolve(access({ documentId: 'doc-B' }));
      await pendingB;
    });
    expect(result.current.access?.documentId).toBe('doc-B');

    await act(async () => {
      requestA.resolve(access({ documentId: 'doc-A' }));
      await pendingA;
    });

    expect(result.current.access?.documentId).toBe('doc-B');
  });

  it('discards a late error from a superseded request', async () => {
    const requestA = deferred();
    adminDocumentReviewsClient.requestDocumentAccess.mockReturnValueOnce(requestA.promise).mockResolvedValueOnce(access({ documentId: 'doc-B' }));
    const { result } = renderHook(() => useDocumentAccess());

    let pendingA;
    act(() => {
      pendingA = result.current.requestAccess('doc-A');
    });
    await act(async () => {
      await result.current.requestAccess('doc-B');
    });
    await act(async () => {
      requestA.reject({ code: 'CANDIDATE_DOCUMENT_NOT_FOUND' });
      await pendingA.catch(() => {});
    });

    expect(result.current.error).toBeNull();
    expect(result.current.access?.documentId).toBe('doc-B');
  });

  it('clears access when the staff session status becomes unauthenticated (logout)', async () => {
    adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue(access());
    const { result, rerender } = renderHook(() => useDocumentAccess());

    await act(async () => {
      await result.current.requestAccess('doc-1');
    });
    expect(result.current.access).not.toBeNull();

    mockUseStaffAuth.mockReturnValue({ status: 'unauthenticated' });
    rerender();

    expect(result.current.access).toBeNull();
  });

  it('discards a response that resolves after the session status changes to unauthenticated mid-request', async () => {
    const request = deferred();
    adminDocumentReviewsClient.requestDocumentAccess.mockReturnValue(request.promise);
    const { result, rerender } = renderHook(() => useDocumentAccess());

    let pending;
    act(() => {
      pending = result.current.requestAccess('doc-1');
    });

    mockUseStaffAuth.mockReturnValue({ status: 'unauthenticated' });
    rerender();

    await act(async () => {
      request.resolve(access());
      await pending;
    });

    expect(result.current.access).toBeNull();
  });
});

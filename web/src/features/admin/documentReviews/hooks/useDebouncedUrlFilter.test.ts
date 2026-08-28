import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedUrlFilter } from './useDebouncedUrlFilter';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedUrlFilter', () => {
  it('updates the draft immediately when typing, without committing yet', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedUrlFilter('', onCommit, 400));

    act(() => result.current[1]('a'));
    expect(result.current[0]).toBe('a');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits only after typing pauses for the debounce delay', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedUrlFilter('', onCommit, 400));

    act(() => result.current[1]('cand-1'));
    act(() => vi.advanceTimersByTime(399));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onCommit).toHaveBeenCalledWith('cand-1');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('does not re-commit if the value settles back to the current urlValue', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedUrlFilter('cand-1', onCommit, 400));

    act(() => result.current[1]('cand-1'));
    act(() => vi.advanceTimersByTime(400));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('resyncs the draft when urlValue changes externally (e.g. browser back/forward)', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(({ urlValue }) => useDebouncedUrlFilter(urlValue, onCommit, 400), {
      initialProps: { urlValue: 'cand-1' },
    });

    rerender({ urlValue: 'cand-2' });
    expect(result.current[0]).toBe('cand-2');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('only commits the latest value when several keystrokes happen within the debounce window', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedUrlFilter('', onCommit, 400));

    act(() => result.current[1]('c'));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current[1]('ca'));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current[1]('can'));
    act(() => vi.advanceTimersByTime(400));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('can');
  });
});

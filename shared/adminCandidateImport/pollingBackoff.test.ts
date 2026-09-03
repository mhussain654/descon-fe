import { isTerminalImportStatus, nextImportPollDelayMs } from './pollingBackoff';

describe('isTerminalImportStatus', () => {
  it('reports queued and processing as non-terminal', () => {
    expect(isTerminalImportStatus('queued')).toBe(false);
    expect(isTerminalImportStatus('processing')).toBe(false);
  });

  it('reports completed, partial, failed and invalidated as terminal', () => {
    expect(isTerminalImportStatus('completed')).toBe(true);
    expect(isTerminalImportStatus('partial')).toBe(true);
    expect(isTerminalImportStatus('failed')).toBe(true);
    expect(isTerminalImportStatus('invalidated')).toBe(true);
  });
});

describe('nextImportPollDelayMs', () => {
  it('starts short for the first poll', () => {
    expect(nextImportPollDelayMs(0)).toBe(2_000);
  });

  it('increases with each successive poll', () => {
    const delays = [0, 1, 2, 3, 4].map(nextImportPollDelayMs);
    expect(delays).toEqual([2_000, 3_000, 5_000, 8_000, 13_000]);
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it('holds at the maximum interval once the schedule is exhausted, never growing unbounded', () => {
    expect(nextImportPollDelayMs(5)).toBe(20_000);
    expect(nextImportPollDelayMs(6)).toBe(20_000);
    expect(nextImportPollDelayMs(100)).toBe(20_000);
  });

  it('never returns a negative or zero delay for a negative poll count', () => {
    expect(nextImportPollDelayMs(-1)).toBe(2_000);
  });
});

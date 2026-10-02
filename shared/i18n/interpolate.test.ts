import { interpolate } from './interpolate';

describe('interpolate', () => {
  it('fills every named slot, in whatever order the language puts them', () => {
    expect(interpolate('%{completed} of %{total} steps complete', { completed: 5, total: 15 })).toBe(
      '5 of 15 steps complete'
    );
    expect(interpolate('%{total} میں سے %{completed} مراحل مکمل', { completed: 5, total: 15 })).toBe(
      '15 میں سے 5 مراحل مکمل'
    );
  });

  it('leaves unknown slots untouched', () => {
    expect(interpolate('Hello %{name}', {})).toBe('Hello %{name}');
  });
});

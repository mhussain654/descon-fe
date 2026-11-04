import { interpolate, interpolateSegments } from './interpolate';

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

describe('interpolateSegments', () => {
  it('keeps each filled value apart from the words around it, wherever the language puts it', () => {
    expect(interpolateSegments('Application in Process for %{country}', { country: 'Saudi Arabia' })).toEqual([
      { text: 'Application in Process for ', slot: null },
      { text: 'Saudi Arabia', slot: 'country' },
    ]);
    expect(interpolateSegments('%{country} کے لیے درخواست زیرِ عمل ہے', { country: 'Qatar' })).toEqual([
      { text: 'Qatar', slot: 'country' },
      { text: ' کے لیے درخواست زیرِ عمل ہے', slot: null },
    ]);
  });

  it('leaves unknown slots as plain text', () => {
    expect(interpolateSegments('Hello %{name}', {})).toEqual([{ text: 'Hello ', slot: null }, { text: '%{name}', slot: null }]);
  });
});

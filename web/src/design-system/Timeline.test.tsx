import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Timeline, type TimelineItemData } from './Timeline';

const items: TimelineItemData[] = [
  { id: 1, label: 'Registered', status: 'completed' },
  { id: 2, label: 'Documents Uploaded', status: 'current', statusText: 'in progress' },
  { id: 3, label: 'Visa Issued', status: 'pending' },
];

describe('Timeline', () => {
  it('renders every step label in order', () => {
    render(<Timeline items={items} />);
    const labels = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(labels[0]).toContain('Registered');
    expect(labels[1]).toContain('Documents Uploaded');
    expect(labels[2]).toContain('Visa Issued');
  });

  it('gives the current step a screen-reader-only status word when provided', () => {
    render(<Timeline items={items} />);
    expect(screen.getByText('(in progress)')).toBeInTheDocument();
  });

  it('does not add a status word when none was supplied, rather than inventing English text', () => {
    render(<Timeline items={[{ id: 1, label: 'Registered', status: 'completed' }]} />);
    expect(screen.queryByText('(completed)')).not.toBeInTheDocument();
  });

  it('renders already-translated Urdu labels without clipping', () => {
    render(
      <Timeline
        items={[
          { id: 1, label: 'دستاویزات اپ لوڈ', status: 'current', statusText: 'جاری ہے' },
        ]}
      />
    );
    const label = screen.getByText('دستاویزات اپ لوڈ');
    expect(label.className).not.toMatch(/truncate|overflow-hidden/);
  });
});

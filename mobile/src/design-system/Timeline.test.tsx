import { render, screen } from '@testing-library/react-native';
import { Timeline, type TimelineItemData } from './Timeline';

const items: TimelineItemData[] = [
  { id: 1, label: 'Registered', status: 'completed' },
  { id: 2, label: 'Documents Uploaded', status: 'current', statusText: 'in progress' },
  { id: 3, label: 'Visa Issued', status: 'pending' },
];

describe('Timeline', () => {
  it('renders every step label', () => {
    render(<Timeline items={items} />);
    expect(screen.getByText('Registered')).toBeOnTheScreen();
    expect(screen.getByText('Documents Uploaded')).toBeOnTheScreen();
    expect(screen.getByText('Visa Issued')).toBeOnTheScreen();
  });

  it('combines the label and status word into the accessible name for the current step', () => {
    render(<Timeline items={items} />);
    expect(screen.getByLabelText('Documents Uploaded (in progress)')).toBeOnTheScreen();
  });

  it('uses just the label as the accessible name when no status word is supplied', () => {
    render(<Timeline items={[{ id: 1, label: 'Registered', status: 'completed' }]} />);
    expect(screen.getByLabelText('Registered')).toBeOnTheScreen();
  });

  it('renders already-translated Urdu labels', () => {
    render(<Timeline items={[{ id: 1, label: 'دستاویزات اپ لوڈ', status: 'current', statusText: 'جاری ہے' }]} />);
    expect(screen.getByText('دستاویزات اپ لوڈ')).toBeOnTheScreen();
  });
});

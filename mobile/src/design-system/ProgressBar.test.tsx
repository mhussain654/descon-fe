import { render, screen } from '@testing-library/react-native';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes value via progressbar role and accessibility value', () => {
    render(<ProgressBar value={30} label="Mobilization progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Mobilization progress' });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 30 });
  });

  it('clamps out-of-range values to 0-100', () => {
    const { rerender } = render(<ProgressBar value={150} label="Progress" />);
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(100);

    rerender(<ProgressBar value={-20} label="Progress" />);
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(0);
  });

  it('renders already-formatted display text', () => {
    render(<ProgressBar value={30} label="Progress" displayText="30% complete" />);
    expect(screen.getByText('30% complete')).toBeOnTheScreen();
  });

  it('renders an already-translated Urdu label', () => {
    render(<ProgressBar value={30} label="متحرک کاری کی پیشرفت" />);
    expect(screen.getByRole('progressbar', { name: 'متحرک کاری کی پیشرفت' })).toBeOnTheScreen();
  });
});

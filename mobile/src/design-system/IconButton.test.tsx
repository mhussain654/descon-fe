import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('exposes the required label as its accessible name', () => {
    render(<IconButton icon={<Text>×</Text>} label="Close" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
  });

  it('uses an already-translated Urdu label as the accessible name', () => {
    render(<IconButton icon={<Text>×</Text>} label="بند کریں" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'بند کریں' })).toBeOnTheScreen();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    render(<IconButton icon={<Text>×</Text>} label="Retry" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disables itself and blocks presses while loading', () => {
    const onPress = jest.fn();
    render(<IconButton icon={<Text>×</Text>} label="Retry" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Retry' });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

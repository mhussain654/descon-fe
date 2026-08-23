import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, type ButtonVariant } from './Button';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'outline', 'destructive', 'text'];

describe('Button', () => {
  it.each(VARIANTS)('renders the %s variant with an accessible button role and its label', (variant) => {
    render(
      <Button variant={variant} onPress={() => {}}>
        Continue
      </Button>
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
  });

  it('renders long Urdu text', () => {
    render(
      <Button onPress={() => {}}>جاری رکھیں اور اپنی معلومات کی تصدیق کریں تاکہ درخواست کا عمل مکمل ہو سکے</Button>
    );
    expect(screen.getByText(/جاری رکھیں/)).toBeOnTheScreen();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Send OTP</Button>);
    fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress while disabled', () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} disabled>
        Continue
      </Button>
    );
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('marks itself busy and disabled while loading, without losing its accessible name', () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} loading>
        Verify OTP
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Verify OTP' });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import { OtpField } from './OtpField';

describe('OtpField', () => {
  it('exposes the already-translated label as the accessible name', () => {
    render(<OtpField label="One-Time Password" value="" onValueChange={() => {}} />);
    expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen();
  });

  it('reports typed digits back through onValueChange, stripping non-numeric characters', () => {
    const onValueChange = jest.fn();
    render(<OtpField label="OTP" value="" onValueChange={onValueChange} />);
    fireEvent.changeText(screen.getByLabelText('OTP'), '12a456');
    expect(onValueChange).toHaveBeenCalledWith('12456');
  });

  it('calls onComplete once the value reaches the configured length', () => {
    const onComplete = jest.fn();
    render(<OtpField label="OTP" value="" onValueChange={() => {}} onComplete={onComplete} length={4} />);
    fireEvent.changeText(screen.getByLabelText('OTP'), '1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('shows a validation message when there is an error', () => {
    render(<OtpField label="OTP" value="" onValueChange={() => {}} errorMessage="Incorrect code" />);
    expect(screen.getByText('Incorrect code')).toBeOnTheScreen();
  });

  it('renders an already-translated Urdu label', () => {
    render(<OtpField label="ایک بار کا پاس ورڈ" value="" onValueChange={() => {}} />);
    expect(screen.getByLabelText('ایک بار کا پاس ورڈ')).toBeOnTheScreen();
  });
});

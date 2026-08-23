import { render, screen } from '@testing-library/react-native';
import { TextField } from './TextField';

describe('TextField', () => {
  it('renders the label and the input', () => {
    render(<TextField label="CNIC Number" />);
    expect(screen.getByText('CNIC Number')).toBeOnTheScreen();
  });

  it('shows helper text when there is no error', () => {
    render(<TextField label="CNIC Number" helperText="Digits only, no dashes" />);
    expect(screen.getByText('Digits only, no dashes')).toBeOnTheScreen();
  });

  it('shows the validation message instead of helper text when there is an error', () => {
    render(<TextField label="CNIC Number" helperText="Digits only" errorMessage="CNIC is required" />);
    expect(screen.getByText('CNIC is required')).toBeOnTheScreen();
    expect(screen.queryByText('Digits only')).not.toBeOnTheScreen();
  });

  it('renders an already-translated Urdu label and error', () => {
    render(<TextField label="شناختی کارڈ نمبر" errorMessage="یہ خانہ درکار ہے۔" />);
    expect(screen.getByText('شناختی کارڈ نمبر')).toBeOnTheScreen();
    expect(screen.getByText('یہ خانہ درکار ہے۔')).toBeOnTheScreen();
  });

  it('marks the field disabled when editable is false', () => {
    render(<TextField label="CNIC Number" editable={false} />);
    expect(screen.getByDisplayValue('')).toBeDisabled();
  });
});

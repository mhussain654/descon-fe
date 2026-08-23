import { fireEvent, render, screen } from '@testing-library/react-native';
import { CnicField } from './CnicField';

// formatCnic/toCnicDigits themselves are tested once, platform-independently,
// in ../../../shared/cnic.test.ts.
describe('CnicField', () => {
  it('displays the raw value formatted', () => {
    render(<CnicField label="CNIC Number" value="1234512345671" onValueChange={() => {}} />);
    expect(screen.getByDisplayValue('12345-1234567-1')).toBeOnTheScreen();
  });

  it("exposes the label as the input's accessible name, not just visible text", () => {
    render(<CnicField label="CNIC Number" value="" onValueChange={() => {}} />);
    expect(screen.getByLabelText('CNIC Number')).toBeOnTheScreen();
  });

  it('reports only digits back through onValueChange, stripping non-numeric input', () => {
    const onValueChange = jest.fn();
    render(<CnicField label="CNIC Number" value="" onValueChange={onValueChange} />);
    fireEvent.changeText(screen.getByDisplayValue(''), '12a345');
    expect(onValueChange).toHaveBeenCalledWith('12345');
  });

  it('shows a validation message on error', () => {
    render(<CnicField label="CNIC Number" value="" onValueChange={() => {}} errorMessage="CNIC is required" />);
    expect(screen.getByText('CNIC is required')).toBeOnTheScreen();
  });

  it('renders an already-translated Urdu label', () => {
    render(<CnicField label="شناختی کارڈ نمبر" value="" onValueChange={() => {}} />);
    expect(screen.getByText('شناختی کارڈ نمبر')).toBeOnTheScreen();
  });
});

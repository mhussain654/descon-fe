import { fireEvent, render, screen } from '@testing-library/react-native';
import { SelectField } from './SelectField';

const options = [
  { value: 'a', label: 'Alpha Bank' },
  { value: 'b', label: 'Beta Bank' },
];

function renderField(overrides: Partial<React.ComponentProps<typeof SelectField>> = {}) {
  const onChange = jest.fn();
  render(<SelectField label="Bank name" value="" options={options} onChange={onChange} placeholder="Select a bank" cancelLabel="Cancel" {...overrides} />);
  return onChange;
}

describe('SelectField', () => {
  it('shows the placeholder until something is chosen, then the chosen label', () => {
    renderField();
    expect(screen.getByText('Select a bank')).toBeOnTheScreen();
  });

  it('shows the selected option label', () => {
    renderField({ value: 'b' });
    expect(screen.getByText('Beta Bank')).toBeOnTheScreen();
  });

  it('opens the list, reports the chosen value and closes', () => {
    const onChange = renderField();
    fireEvent.press(screen.getByLabelText('Bank name'));
    fireEvent.press(screen.getByRole('button', { name: 'Beta Bank' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('button', { name: 'Alpha Bank' })).not.toBeOnTheScreen();
  });

  it('closes without choosing when cancelled', () => {
    const onChange = renderField();
    fireEvent.press(screen.getByLabelText('Bank name'));
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the current option as selected in the list', () => {
    renderField({ value: 'a' });
    fireEvent.press(screen.getByLabelText('Bank name'));
    expect(screen.getByRole('button', { name: 'Alpha Bank' }).props.accessibilityState.selected).toBe(true);
  });

  it('shows the error message instead of the helper text', () => {
    renderField({ errorMessage: 'Select your bank.', helperText: 'Pick one' });
    expect(screen.getByText('Select your bank.')).toBeOnTheScreen();
    expect(screen.queryByText('Pick one')).not.toBeOnTheScreen();
  });
});

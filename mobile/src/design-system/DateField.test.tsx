import { fireEvent, render, screen } from '@testing-library/react-native';
import { DateField } from './DateField';

const TODAY = new Date(2026, 9, 26); // 26 October 2026

function renderField(overrides: Partial<React.ComponentProps<typeof DateField>> = {}) {
  const onChange = jest.fn();
  render(
    <DateField
      label="Issue date"
      value=""
      onChange={onChange}
      placeholder="Select date"
      doneLabel="Done"
      cancelLabel="Cancel"
      dayLabel="Day"
      monthLabel="Month"
      yearLabel="Year"
      maxDate={TODAY}
      {...overrides}
    />
  );
  return onChange;
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('DateField', () => {
  it('shows the placeholder until a date is chosen, then the chosen date', () => {
    renderField();
    expect(screen.getByText('Select date')).toBeOnTheScreen();
  });

  it('shows the chosen date in words', () => {
    renderField({ value: '2026-01-15' });
    expect(screen.getByText('15 January 2026')).toBeOnTheScreen();
  });

  it('reports the date picked from the day, month and year lists as YYYY-MM-DD', () => {
    const onChange = renderField();
    fireEvent.press(screen.getByLabelText('Issue date'));
    press('15');
    press('January');
    press('2025');
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2025-01-15');
  });

  it('reports nothing when cancelled', () => {
    const onChange = renderField();
    fireEvent.press(screen.getByLabelText('Issue date'));
    press('Cancel');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens on the current value, so confirming straight away keeps it', () => {
    const onChange = renderField({ value: '2026-03-09' });
    fireEvent.press(screen.getByLabelText('Issue date'));
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2026-03-09');
  });

  it('never offers a date after the latest allowed date', () => {
    renderField();
    fireEvent.press(screen.getByLabelText('Issue date'));
    expect(screen.queryByRole('button', { name: '2027' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'November' })).toBeNull();
    expect(screen.getByRole('button', { name: 'October' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '27' })).toBeNull();
    expect(screen.getByRole('button', { name: '26' })).toBeOnTheScreen();
  });

  it('brings the day inside a shorter month when the month changes', () => {
    const onChange = renderField({ value: '2025-01-31' });
    fireEvent.press(screen.getByLabelText('Issue date'));
    press('February');
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2025-02-28');
  });

  it('brings a date back inside the allowed range when the year moves to the latest year', () => {
    const onChange = renderField({ value: '2025-12-20' });
    fireEvent.press(screen.getByLabelText('Issue date'));
    press('2026');
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2026-10-20');
  });

  it('shows the error instead of the helper text', () => {
    renderField({ errorMessage: 'Choose the date.', helperText: 'Pick one' });
    expect(screen.getByText('Choose the date.')).toBeOnTheScreen();
    expect(screen.queryByText('Pick one')).toBeNull();
  });
});

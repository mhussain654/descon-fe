import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { DateField } from './DateField';

const TODAY = new Date(2026, 9, 26); // Monday 26 October 2026

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

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const openPicker = () => fireEvent.press(screen.getByLabelText('Issue date'));

describe('DateField', () => {
  it('shows the placeholder until a date is chosen', () => {
    renderField();
    expect(screen.getByText('Select date')).toBeOnTheScreen();
  });

  it('shows the chosen date in words', () => {
    renderField({ value: '2026-01-15' });
    expect(screen.getByText('15 January 2026')).toBeOnTheScreen();
  });

  it('opens on a calendar of the current month, Monday first, and reports a tapped day as YYYY-MM-DD', () => {
    const onChange = renderField();
    openPicker();
    // 1 October 2026 is a Thursday, so it is preceded by three blank cells.
    expect(screen.getByRole('button', { name: 'Month, October' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Year, 2026' })).toBeOnTheScreen();
    press('15 October 2026');
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2026-10-15');
  });

  it('spells out the chosen date above the calendar so it can be checked before Done', () => {
    renderField();
    openPicker();
    press('3 October 2026');
    expect(screen.getAllByText('3 October 2026').length).toBeGreaterThan(0);
  });

  it('changes the year, then the month, then the day', () => {
    const onChange = renderField();
    openPicker();
    press('Year, 2026');
    press('2025');
    press('January');
    press('15 January 2025');
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2025-01-15');
  });

  it('reports nothing when cancelled', () => {
    const onChange = renderField();
    openPicker();
    press('Cancel');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens on the current value, so confirming straight away keeps it', () => {
    const onChange = renderField({ value: '2026-03-09' });
    openPicker();
    expect(screen.getByRole('button', { name: 'Month, March' })).toBeOnTheScreen();
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2026-03-09');
  });

  it('never lets a date after the latest allowed date be chosen', () => {
    renderField();
    openPicker();
    expect(screen.getByRole('button', { name: '27 October 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '26 October 2026' })).toBeEnabled();
    press('Month, October');
    expect(screen.getByRole('button', { name: 'November' })).toBeDisabled();
    press('Year, 2026');
    expect(screen.queryByRole('button', { name: '2027' })).toBeNull();
  });

  it('brings the day inside a shorter month when the month changes', () => {
    const onChange = renderField({ value: '2025-01-31' });
    openPicker();
    press('Month, January');
    press('February');
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2025-02-28');
  });

  it('brings a date back inside the allowed range when the year moves to the latest year', () => {
    const onChange = renderField({ value: '2025-12-20' });
    openPicker();
    press('Year, 2025');
    press('2026');
    press('Done');
    expect(onChange).toHaveBeenCalledWith('2026-10-20');
  });

  it('keeps the Done and Cancel buttons above the system navigation bar', () => {
    render(
      <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 48, left: 0, right: 0 }}>
        <DateField label="Issue date" value="" onChange={jest.fn()} placeholder="Select date" doneLabel="Done" cancelLabel="Cancel" dayLabel="Day" monthLabel="Month" yearLabel="Year" maxDate={TODAY} />
      </SafeAreaInsetsContext.Provider>
    );
    openPicker();
    expect(screen.getByTestId('date-field-sheet')).toHaveStyle({ paddingBottom: 16 + 48 });
  });

  it('shows the error instead of the helper text', () => {
    renderField({ errorMessage: 'Choose the date.', helperText: 'Pick one' });
    expect(screen.getByText('Choose the date.')).toBeOnTheScreen();
    expect(screen.queryByText('Pick one')).toBeNull();
  });
});

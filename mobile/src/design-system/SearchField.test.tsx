import { fireEvent, render, screen } from '@testing-library/react-native';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('exposes an accessible name and reports typed input', () => {
    const onValueChange = jest.fn();
    render(<SearchField value="" onValueChange={onValueChange} label="Search candidates" clearLabel="Clear" />);
    fireEvent.changeText(screen.getByLabelText('Search candidates'), 'Ahmed');
    expect(onValueChange).toHaveBeenCalledWith('Ahmed');
  });

  it('only shows the clear button once there is a query, and clears it on press', () => {
    const onValueChange = jest.fn();
    const { rerender } = render(
      <SearchField value="" onValueChange={onValueChange} label="Search" clearLabel="Clear search" />
    );
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeOnTheScreen();

    rerender(<SearchField value="Ahmed" onValueChange={onValueChange} label="Search" clearLabel="Clear search" />);
    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('renders an already-translated Urdu label', () => {
    render(<SearchField value="" onValueChange={() => {}} label="تلاش کریں" clearLabel="صاف کریں" />);
    expect(screen.getByLabelText('تلاش کریں')).toBeOnTheScreen();
  });
});

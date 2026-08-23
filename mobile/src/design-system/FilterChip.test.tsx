import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterChip } from './FilterChip';

describe('FilterChip', () => {
  it('reflects selection via accessibilityState.selected', () => {
    const { rerender } = render(
      <FilterChip selected={false} onPress={() => {}}>
        Documents Pending
      </FilterChip>
    );
    expect(screen.getByRole('button').props.accessibilityState.selected).toBe(false);

    rerender(
      <FilterChip selected onPress={() => {}}>
        Documents Pending
      </FilterChip>
    );
    expect(screen.getByRole('button').props.accessibilityState.selected).toBe(true);
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    render(
      <FilterChip selected={false} onPress={onPress}>
        All
      </FilterChip>
    );
    fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

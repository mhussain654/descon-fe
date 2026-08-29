import { renderHook } from '@testing-library/react-native';
import { useRefetchOnFocus } from './useRefetchOnFocus';

// A thin wrapper around @react-navigation/native's useFocusEffect -- mocked
// here to synchronously invoke the registered callback on demand, so this
// test can drive "the screen gained focus" without a real NavigationContainer.
let registeredCallback: (() => void) | undefined;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    registeredCallback = callback;
  },
}));

function fireFocus() {
  registeredCallback?.();
}

describe('useRefetchOnFocus', () => {
  beforeEach(() => {
    registeredCallback = undefined;
  });

  it('refetches when the screen gains focus', () => {
    const refetch = jest.fn();
    renderHook(() => useRefetchOnFocus(refetch, false));

    fireFocus();

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not refetch while already fetching', () => {
    const refetch = jest.fn();
    renderHook(() => useRefetchOnFocus(refetch, true));

    fireFocus();

    expect(refetch).not.toHaveBeenCalled();
  });

  it('reads the latest refetch/isFetching on each focus, even though the registered callback itself never changes', () => {
    const firstRefetch = jest.fn();
    const secondRefetch = jest.fn();
    const { rerender } = renderHook(
      ({ refetch, isFetching }: { refetch: () => void; isFetching: boolean }) => useRefetchOnFocus(refetch, isFetching),
      { initialProps: { refetch: firstRefetch, isFetching: true } }
    );

    fireFocus();
    expect(firstRefetch).not.toHaveBeenCalled();

    rerender({ refetch: secondRefetch, isFetching: false });
    fireFocus();

    expect(secondRefetch).toHaveBeenCalledTimes(1);
    expect(firstRefetch).not.toHaveBeenCalled();
  });
});

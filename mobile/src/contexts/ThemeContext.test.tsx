import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, DevSettings } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { getActiveScheme, setActiveScheme } from '../design-system/theme';
import { takeResumeRoute } from '../lib/appRestart';
import { ThemeProvider, useTheme } from './ThemeContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn(() => Promise.resolve()) }));

let latest: ReturnType<typeof useTheme> | undefined;
function Probe() {
  latest = useTheme();
  return null;
}

async function renderProvider(onReady = jest.fn()) {
  render(
    <ThemeProvider onReady={onReady}>
      <Probe />
    </ThemeProvider>
  );
  await act(async () => {});
  return onReady;
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    latest = undefined;
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    setActiveScheme('light');
  });

  it('uses the saved choice before drawing anything, and says when it is ready', async () => {
    await AsyncStorage.setItem('descon.theme', 'dark');

    const onReady = await renderProvider();

    expect(latest?.scheme).toBe('dark');
    expect(getActiveScheme()).toBe('dark');
    expect(onReady).toHaveBeenCalled();
  });

  it('follows the phone’s setting when nothing was chosen', async () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');

    await renderProvider();

    expect(latest?.scheme).toBe('dark');
  });

  it('saves a new choice and reloads the app, reopening the screen that asked', async () => {
    const reload = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
    await renderProvider();

    await act(async () => {
      await latest?.setScheme('dark', '/(tabs)/profile');
    });

    expect(await AsyncStorage.getItem('descon.theme')).toBe('dark');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await takeResumeRoute()).toBe('/(tabs)/profile');
  });

  it('does nothing when the chosen theme is already in use', async () => {
    const reload = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
    await renderProvider();

    await act(async () => {
      await latest?.setScheme('light');
    });

    expect(reload).not.toHaveBeenCalled();
  });
});

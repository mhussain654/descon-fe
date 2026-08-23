import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { act, create } from 'react-test-renderer';
import { LanguageProvider, useLanguage } from './LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-updates', () => ({
  reloadAsync: jest.fn(() => Promise.resolve()),
}));

function Probe({ onReady }) {
  const value = useLanguage();
  onReady(value);
  return null;
}

async function renderProbe() {
  let latest;
  const onReady = (value) => {
    latest = value;
  };
  let root;
  await act(async () => {
    root = create(
      <LanguageProvider>
        <Probe onReady={onReady} />
      </LanguageProvider>
    );
  });
  return { root, get value() {
    return latest;
  } };
}

describe('LanguageContext', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to English when nothing is persisted', async () => {
    const { value } = await renderProbe();
    expect(value.language).toBe('en');
    expect(value.t('continue')).toBe('Continue');
  });

  it('restores a persisted language on mount', async () => {
    await AsyncStorage.setItem('descon.language', 'ur');
    const { value } = await renderProbe();
    expect(value.language).toBe('ur');
    expect(value.t('continue')).toBe('جاری رکھیں');
  });

  it('applies RTL layout direction when a persisted Urdu language is restored', async () => {
    I18nManager.isRTL = false;
    const forceRTLSpy = jest.spyOn(I18nManager, 'forceRTL');
    const allowRTLSpy = jest.spyOn(I18nManager, 'allowRTL');
    const reloadSpy = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
    await AsyncStorage.setItem('descon.language', 'ur');

    await renderProbe();

    expect(allowRTLSpy).toHaveBeenCalledWith(true);
    expect(forceRTLSpy).toHaveBeenCalledWith(true);
    // Restoring a persisted language on a fresh process only ever applies
    // direction -- it must never reload, or a mismatched persisted/native
    // direction on cold start would reload every single launch.
    expect(reloadSpy).not.toHaveBeenCalled();

    forceRTLSpy.mockRestore();
    allowRTLSpy.mockRestore();
    reloadSpy.mockRestore();
    I18nManager.isRTL = false;
  });

  it('persists the language when setLanguage is called', async () => {
    const probe = await renderProbe();
    await act(async () => {
      probe.value.setLanguage('ur');
    });
    expect(probe.value.language).toBe('ur');
    expect(await AsyncStorage.getItem('descon.language')).toBe('ur');
    await act(async () => {
      probe.root.unmount();
    });
  });

  it('toggles between English and Urdu', async () => {
    const probe = await renderProbe();
    expect(probe.value.language).toBe('en');
    await act(async () => {
      probe.value.toggleLanguage();
    });
    expect(probe.value.language).toBe('ur');
    await act(async () => {
      probe.value.toggleLanguage();
    });
    expect(probe.value.language).toBe('en');
    await act(async () => {
      probe.root.unmount();
    });
  });

  it('reloads the app after switching language changes the RTL direction (regression: I18nManager.forceRTL only applies after a reload)', async () => {
    I18nManager.isRTL = false;
    const reloadSpy = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
    const probe = await renderProbe();

    await act(async () => {
      await probe.value.setLanguage('ur');
    });

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    reloadSpy.mockRestore();
    I18nManager.isRTL = false;
  });

  it('persists the new language before reloading, so the choice survives the reload', async () => {
    I18nManager.isRTL = false;
    const callOrder = [];
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async () => {
      callOrder.push('persist');
    });
    const reloadSpy = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {
      callOrder.push('reload');
    });
    const probe = await renderProbe();

    await act(async () => {
      await probe.value.setLanguage('ur');
    });

    expect(callOrder).toEqual(['persist', 'reload']);

    setItemSpy.mockRestore();
    reloadSpy.mockRestore();
    I18nManager.isRTL = false;
  });

  it('does not reload when the language changes but RTL direction does not (no supported language pair currently exercises this, but the guard must still hold)', async () => {
    I18nManager.isRTL = false;
    const reloadSpy = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
    const probe = await renderProbe();

    // Setting the same (already-active) language is a no-op direction change.
    await act(async () => {
      await probe.value.setLanguage('en');
    });

    expect(reloadSpy).not.toHaveBeenCalled();

    reloadSpy.mockRestore();
  });

  it('falls back to Updates.reloadAsync outside of development', async () => {
    I18nManager.isRTL = false;
    const originalDev = global.__DEV__;
    global.__DEV__ = false;
    const probe = await renderProbe();

    await act(async () => {
      await probe.value.setLanguage('ur');
    });

    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);

    global.__DEV__ = originalDev;
    I18nManager.isRTL = false;
  });
});

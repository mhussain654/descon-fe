import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { I18nManager } from 'react-native';
import { act, create } from 'react-test-renderer';
import { LanguageProvider, useLanguage } from './LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

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
    await AsyncStorage.setItem('descon.language', 'ur');

    await renderProbe();

    expect(allowRTLSpy).toHaveBeenCalledWith(true);
    expect(forceRTLSpy).toHaveBeenCalledWith(true);

    forceRTLSpy.mockRestore();
    allowRTLSpy.mockRestore();
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
});

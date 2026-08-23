import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from './LanguageContext';

function Probe() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span>{language}</span>
      <button type="button" onClick={() => setLanguage('ur')}>
        ur
      </button>
      <button type="button" onClick={() => setLanguage('en')}>
        en
      </button>
      <span>{t('continue')}</span>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    document.documentElement.className = '';
  });

  it('defaults to English/LTR with no Urdu font class', () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.classList.contains('font-noto-nastaliq-urdu')).toBe(false);
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('switches document direction, lang and the Urdu font class when Urdu is selected', () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'ur' }));

    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.classList.contains('font-noto-nastaliq-urdu')).toBe(true);
    expect(screen.getByText('جاری رکھیں')).toBeInTheDocument();
  });

  it('switches back to ltr/English and removes the Urdu font class', () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'ur' }));
    fireEvent.click(screen.getByRole('button', { name: 'en' }));

    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.classList.contains('font-noto-nastaliq-urdu')).toBe(false);
  });
});

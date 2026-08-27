import type { Language } from '../i18n/translations';
import { formatNumber } from '../i18n/locale';

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Human-readable file size (e.g. "123 KB", "4.5 MB"), locale-aware for the numeral itself. Never renders a raw byte count for anything but the smallest unit. */
export function formatFileSize(bytes: number, language: Language): string {
  if (!Number.isFinite(bytes) || bytes < 0) return formatNumber(0, language) + ' ' + UNITS[0];
  if (bytes === 0) return `${formatNumber(0, language)} ${UNITS[0]}`;

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = unitIndex === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${formatNumber(rounded, language)} ${UNITS[unitIndex]}`;
}

import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { formatDate } from '../../../shared/i18n/locale';
import { Button } from './Button';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { Text } from './Text';
import { ValidationMessage } from './ValidationMessage';
import { colors, radii, spacing, zIndex } from './tokens';
import { getFontFamily } from './fonts';
import { physicalTextAlign, rowDirectionTowards } from '../lib/layoutDirection';

type Language = 'en' | 'ur';
interface DateParts { year: number; month: number; day: number }

export interface DateFieldProps {
  /** Already-translated label text. */
  label: string;
  /** The chosen date as `YYYY-MM-DD`, or '' while nothing is chosen. */
  value: string;
  /** Called with the chosen date as `YYYY-MM-DD`. */
  onChange: (isoDate: string) => void;
  /** Already-translated text shown while nothing is chosen. */
  placeholder: string;
  doneLabel: string;
  cancelLabel: string;
  dayLabel: string;
  monthLabel: string;
  yearLabel: string;
  helperText?: string;
  errorMessage?: string;
  /** The latest date that can be chosen. Defaults to today. */
  maxDate?: Date;
  /** How many years before the latest year can be chosen. */
  yearsBack?: number;
  language?: Language;
}

const pad = (value: number) => String(value).padStart(2, '0');
const toIso = ({ year, month, day }: DateParts) => `${year}-${pad(month)}-${pad(day)}`;
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function parseIso(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= daysInMonth(parts.year, parts.month) ? parts : null;
}

function partsOf(date: Date): DateParts {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** A date never later than `latest`, with the day brought inside the month. */
function clampToRange(parts: DateParts, latest: DateParts): DateParts {
  const year = Math.min(parts.year, latest.year);
  const month = year === latest.year ? Math.min(parts.month, latest.month) : parts.month;
  const dayLimit = year === latest.year && month === latest.month ? latest.day : daysInMonth(year, month);
  return { year, month, day: Math.min(parts.day, dayLimit) };
}

function monthName(month: number, language: Language): string {
  try {
    // dateStyle is formatDate's default and cannot be combined with a lone `month`, so it is switched off.
    return formatDate(new Date(Date.UTC(2000, month - 1, 1)), language, { dateStyle: undefined, month: 'long', timeZone: 'UTC' });
  } catch {
    return String(month);
  }
}

function displayDate(parts: DateParts, language: Language): string {
  return `${parts.day} ${monthName(parts.month, language)} ${parts.year}`;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

/**
 * A date chosen from day / month / year lists in a modal sheet, so nobody has to type a date format.
 * Built from plain React Native views (no native date-picker library), and never lets a date after
 * `maxDate` be chosen.
 */
export function DateField({
  label, value, onChange, placeholder, doneLabel, cancelLabel, dayLabel, monthLabel, yearLabel,
  helperText, errorMessage, maxDate, yearsBack = 10, language = 'en',
}: DateFieldProps) {
  const latest = partsOf(maxDate ?? new Date());
  const chosen = parseIso(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateParts>(latest);
  const hasError = Boolean(errorMessage);
  const side = language === 'ur' ? 'right' : 'left';
  const textStyle = { textAlign: physicalTextAlign(side), fontFamily: getFontFamily(language, 'regular') };

  const openSheet = () => {
    setDraft(clampToRange(chosen ?? latest, latest));
    setOpen(true);
  };
  const pick = (change: Partial<DateParts>) => setDraft((current) => clampToRange({ ...current, ...change }, latest));
  const confirm = () => {
    onChange(toIso(draft));
    setOpen(false);
  };

  const lastMonth = draft.year === latest.year ? latest.month : 12;
  const lastDay = draft.year === latest.year && draft.month === latest.month ? latest.day : daysInMonth(draft.year, draft.month);
  const columns: { title: string; items: { value: number; text: string }[]; selected: number; onPick: (value: number) => void }[] = [
    { title: dayLabel, items: range(1, lastDay).map((day) => ({ value: day, text: String(day) })), selected: draft.day, onPick: (day) => pick({ day }) },
    { title: monthLabel, items: range(1, lastMonth).map((month) => ({ value: month, text: monthName(month, language) })), selected: draft.month, onPick: (month) => pick({ month }) },
    { title: yearLabel, items: range(latest.year - yearsBack, latest.year).reverse().map((year) => ({ value: year, text: String(year) })), selected: draft.year, onPick: (year) => pick({ year }) },
  ];

  return (
    <View>
      <Label language={language}>{label}</Label>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: chosen ? displayDate(chosen, language) : placeholder }}
        style={[styles.trigger, { flexDirection: rowDirectionTowards(side), borderColor: hasError ? colors.danger.default : colors.border.default }]}
      >
        <Text style={[styles.triggerText, textStyle, { color: chosen ? colors.text.primary : colors.text.tertiary }]} numberOfLines={1}>
          {chosen ? displayDate(chosen, language) : placeholder}
        </Text>
        <Calendar size={20} color={colors.text.tertiary} />
      </Pressable>
      {errorMessage ? (
        <ValidationMessage tone="error" language={language}>{errorMessage}</ValidationMessage>
      ) : helperText ? (
        <HelperText language={language}>{helperText}</HelperText>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} accessibilityRole="none" importantForAccessibility="no" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={[styles.sheetTitle, { fontFamily: getFontFamily(language, 'semibold'), textAlign: physicalTextAlign(side) }]}>{label}</Text>
          {/* Day, month, year always read left to right, in both languages. */}
          <View style={styles.columns}>
            {columns.map((column) => (
              <View key={column.title} style={styles.column}>
                <Text style={[styles.columnTitle, { fontFamily: getFontFamily(language, 'medium') }]}>{column.title}</Text>
                <ScrollView style={styles.list} nestedScrollEnabled>
                  {column.items.map((item) => {
                    const isSelected = item.value === column.selected;
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => column.onPick(item.value)}
                        accessibilityRole="button"
                        accessibilityLabel={item.text}
                        accessibilityState={{ selected: isSelected }}
                        style={[styles.option, isSelected && styles.optionSelected]}
                      >
                        <Text style={[styles.optionText, { fontFamily: getFontFamily(language, isSelected ? 'semibold' : 'regular') }, isSelected && { color: colors.brand.default }]}>{item.text}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => setOpen(false)} language={language}>{cancelLabel}</Button>
            <Button onPress={confirm} language={language}>{doneLabel}</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.raised,
  },
  triggerText: { flex: 1, fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface.overlay, zIndex: zIndex.overlay },
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    borderTopStartRadius: radii.xl,
    borderTopEndRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    padding: spacing[4],
    gap: spacing[3],
    zIndex: zIndex.modal,
  },
  sheetTitle: { fontSize: 18, color: colors.text.primary },
  columns: { flexDirection: 'row', direction: 'ltr', gap: spacing[2] },
  column: { flex: 1, gap: spacing[1] },
  columnTitle: { fontSize: 13, textAlign: 'center', color: colors.text.secondary },
  list: { height: 220 },
  option: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  optionSelected: { backgroundColor: colors.brand.subtle },
  optionText: { fontSize: 16, textAlign: 'center', color: colors.text.primary },
  actions: { flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end' },
});

import { Calendar, ChevronDown } from 'lucide-react-native';
import { useContext, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { formatDate } from '../../../shared/i18n/locale';
import { Button } from './Button';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { Text } from './Text';
import { ValidationMessage } from './ValidationMessage';
import { colors, radii, spacing, zIndex } from './tokens';
import { getFontFamily } from './fonts';
import { physicalTextAlign, rowDirectionTowards } from '../lib/layoutDirection';
import { themedStyles } from './theme';

type Language = 'en' | 'ur';
type CalendarView = 'days' | 'months' | 'years';
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
const DAYS_PER_WEEK = 7;

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

const isAfter = (a: DateParts, b: DateParts) => toIso(a) > toIso(b);

// dateStyle is formatDate's default and cannot be combined with lone fields, so it is switched off.
function formatPart(date: Date, language: Language, options: Intl.DateTimeFormatOptions, fallback: string): string {
  try {
    return formatDate(date, language, { dateStyle: undefined, timeZone: 'UTC', ...options });
  } catch {
    return fallback;
  }
}

const monthName = (month: number, language: Language) =>
  formatPart(new Date(Date.UTC(2000, month - 1, 1)), language, { month: 'long' }, String(month));

/** Week starts on Monday; 2024-01-01 was a Monday. */
const weekdayNames = (language: Language) =>
  Array.from({ length: DAYS_PER_WEEK }, (_, index) => formatPart(new Date(Date.UTC(2024, 0, 1 + index)), language, { weekday: 'narrow' }, ''));

function displayDate(parts: DateParts, language: Language): string {
  return `${parts.day} ${monthName(parts.month, language)} ${parts.year}`;
}

/** Day cells for a month grid: leading blanks (null) so day 1 falls under its weekday, Monday first. */
function monthGrid(year: number, month: number): (number | null)[] {
  const leadingBlanks = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % DAYS_PER_WEEK;
  const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1);
  const cells: (number | null)[] = [...Array<null>(leadingBlanks).fill(null), ...days];
  while (cells.length % DAYS_PER_WEEK !== 0) cells.push(null);
  return cells;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

/**
 * A date chosen from a calendar in a modal sheet, so nobody has to type a date format. The month
 * and year buttons above the calendar switch it to a month or year list, so far-off dates are a few
 * taps away. Built from plain React Native views (no native date-picker library), and never lets a
 * date after `maxDate` be chosen. The chosen date is spelled out above the calendar to check before
 * pressing Done.
 */
export function DateField({
  label, value, onChange, placeholder, doneLabel, cancelLabel, dayLabel, monthLabel, yearLabel,
  helperText, errorMessage, maxDate, yearsBack = 10, language = 'en',
}: DateFieldProps) {
  const latest = partsOf(maxDate ?? new Date());
  const chosen = parseIso(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CalendarView>('days');
  const [draft, setDraft] = useState<DateParts>(latest);
  // The sheet sits at the bottom of the screen, so it keeps its buttons clear of the system navigation bar.
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const hasError = Boolean(errorMessage);
  const side = language === 'ur' ? 'right' : 'left';
  const textStyle = { textAlign: physicalTextAlign(side), fontFamily: getFontFamily(language, 'regular') };
  const font = (weight: 'regular' | 'medium' | 'semibold') => ({ fontFamily: getFontFamily(language, weight) });

  const openSheet = () => {
    setDraft(clampToRange(chosen ?? latest, latest));
    setView('days');
    setOpen(true);
  };
  const pick = (change: Partial<DateParts>) => setDraft((current) => clampToRange({ ...current, ...change }, latest));
  const confirm = () => {
    onChange(toIso(draft));
    setOpen(false);
  };

  const headerButton = (target: CalendarView, title: string, text: string) => (
    <Pressable
      onPress={() => setView(view === target ? 'days' : target)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${text}`}
      accessibilityState={{ expanded: view === target }}
      style={[styles.headerButton, view === target && styles.headerButtonActive]}
    >
      <Text style={[styles.headerButtonText, font('semibold')]}>{text}</Text>
      <ChevronDown size={18} color={colors.brand.default} />
    </Pressable>
  );

  const option = (key: number, text: string, accessibilityLabel: string, isSelected: boolean, disabled: boolean, onPress: () => void, cellStyle: object) => (
    <View key={key} style={cellStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: isSelected, disabled }}
        style={[styles.option, isSelected && styles.optionSelected]}
      >
        <Text style={[styles.optionText, font(isSelected ? 'semibold' : 'regular'), isSelected && styles.optionTextSelected, disabled && styles.optionTextDisabled]}>{text}</Text>
      </Pressable>
    </View>
  );

  const daysView = (
    <View accessibilityLabel={dayLabel}>
      <View style={styles.grid}>
        {weekdayNames(language).map((weekday, index) => (
          <View key={index} style={styles.dayCell}>
            <Text style={[styles.weekday, font('medium')]} importantForAccessibility="no">{weekday}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {monthGrid(draft.year, draft.month).map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const parts = { year: draft.year, month: draft.month, day };
          return option(day, String(day), displayDate(parts, language), day === draft.day, isAfter(parts, latest), () => pick({ day }), styles.dayCell);
        })}
      </View>
    </View>
  );

  const monthsView = (
    <View style={styles.grid}>
      {range(1, 12).map((month) => {
        const disabled = draft.year === latest.year && month > latest.month;
        const name = monthName(month, language);
        return option(month, name, name, month === draft.month, disabled, () => { pick({ month }); setView('days'); }, styles.wideCell);
      })}
    </View>
  );

  const yearsView = (
    <ScrollView style={styles.yearList} nestedScrollEnabled>
      <View style={styles.grid}>
        {range(latest.year - yearsBack, latest.year).reverse().map((year) =>
          option(year, String(year), String(year), year === draft.year, false, () => { pick({ year }); setView('months'); }, styles.wideCell))}
      </View>
    </ScrollView>
  );

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

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent accessibilityViewIsModal>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} accessibilityRole="none" importantForAccessibility="no" />
        <View testID="date-field-sheet" style={[styles.sheet, { paddingBottom: spacing[4] + bottomInset }]} accessibilityViewIsModal>
          <Text style={[styles.sheetTitle, font('semibold'), { textAlign: physicalTextAlign(side) }]}>{label}</Text>
          <Text style={[styles.draftDate, font('semibold'), { textAlign: physicalTextAlign(side) }]} accessibilityLiveRegion="polite">
            {displayDate(draft, language)}
          </Text>
          {/* The calendar always reads left to right, Monday first, in both languages. */}
          <View style={styles.header}>
            {headerButton('months', monthLabel, monthName(draft.month, language))}
            {headerButton('years', yearLabel, String(draft.year))}
          </View>
          {view === 'days' ? daysView : view === 'months' ? monthsView : yearsView}
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => setOpen(false)} language={language}>{cancelLabel}</Button>
            <Button onPress={confirm} language={language}>{doneLabel}</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = themedStyles(() => ({
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
  draftDate: { fontSize: 16, color: colors.brand.default },
  header: { flexDirection: 'row', direction: 'ltr', gap: spacing[2] },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
  },
  headerButtonActive: { borderColor: colors.brand.default, backgroundColor: colors.brand.subtle },
  headerButtonText: { fontSize: 16, color: colors.text.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', direction: 'ltr' },
  dayCell: { width: `${100 / DAYS_PER_WEEK}%`, padding: 2 },
  wideCell: { width: '33.333%', padding: spacing[1] },
  weekday: { fontSize: 13, textAlign: 'center', color: colors.text.secondary, paddingVertical: spacing[1] },
  yearList: { maxHeight: 264 },
  option: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  optionSelected: { backgroundColor: colors.brand.default },
  optionText: { fontSize: 16, textAlign: 'center', color: colors.text.primary },
  optionTextSelected: { color: colors.brand.on },
  optionTextDisabled: { color: colors.text.disabled },
  actions: { flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end' },
}));

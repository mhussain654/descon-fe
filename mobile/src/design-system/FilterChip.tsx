import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontWeights, radii, spacing } from './tokens';
import { getFontFamily } from './fonts';

export interface FilterChipProps {
  selected: boolean;
  onPress: () => void;
  children: string;
  /** Which font family renders the label -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Toggleable filter pill, e.g. a stage filter above a candidate list. */
export function FilterChip({ selected, onPress, children, language = 'en' }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.brand.default : colors.surface.sunken, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {selected ? <Check size={14} color={colors.brand.on} /> : null}
      <Text
        style={[styles.text, { color: selected ? colors.brand.on : colors.text.secondary, fontFamily: getFontFamily(language, 'medium') }]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1.5],
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  text: { fontSize: 14, fontWeight: fontWeights.medium },
});

import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontWeights, radii, spacing } from './tokens';

export interface FilterChipProps {
  selected: boolean;
  onPress: () => void;
  children: string;
}

/** Toggleable filter pill, e.g. a stage filter above a candidate list. */
export function FilterChip({ selected, onPress, children }: FilterChipProps) {
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
      <Text style={[styles.text, { color: selected ? colors.brand.on : colors.text.secondary }]}>{children}</Text>
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
    paddingVertical: spacing[1.5],
  },
  text: { fontSize: 14, fontWeight: fontWeights.medium },
});

import { Search, X } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';
import { IconButton } from './IconButton';
import { colors, radii, spacing } from './tokens';

export interface SearchFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Already-translated placeholder. */
  placeholder?: string;
  /** Already-translated accessible name for the field itself. */
  label: string;
  /** Already-translated accessible name for the clear button. */
  clearLabel: string;
  editable?: boolean;
}

/** Search control with a leading icon and a clear button once there's a query to clear. */
export function SearchField({ value, onValueChange, placeholder, label, clearLabel, editable }: SearchFieldProps) {
  return (
    <View style={styles.container}>
      <Search size={16} color={colors.text.tertiary} style={styles.leadingIcon} />
      <TextInput
        value={value}
        onChangeText={onValueChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        editable={editable}
        accessibilityLabel={label}
        style={styles.input}
      />
      {value ? (
        <IconButton
          icon={<X size={16} color={colors.text.tertiary} />}
          label={clearLabel}
          size="sm"
          variant="ghost"
          onPress={() => onValueChange('')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.lg,
    backgroundColor: colors.surface.raised,
    paddingStart: spacing[3],
    paddingEnd: spacing[1],
  },
  leadingIcon: { marginEnd: spacing[2] },
  input: { flex: 1, fontSize: 16, color: colors.text.primary, paddingVertical: spacing[2] },
});

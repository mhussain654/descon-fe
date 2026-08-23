import { ActivityIndicator, View } from 'react-native';
import { colors } from './tokens';

export type SpinnerSize = 'sm' | 'lg';

const RN_SIZE: Record<SpinnerSize, 'small' | 'large'> = { sm: 'small', lg: 'large' };

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Accessible label announced to assistive tech (e.g. an already-translated "Loading…"). */
  label: string;
}

/** Indeterminate progress indicator. Pair with ProgressBar for determinate progress. */
export function Spinner({ size = 'sm', label }: SpinnerProps) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size={RN_SIZE[size]} color={colors.brand.default} />
    </View>
  );
}

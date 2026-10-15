import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg from 'react-native-svg';

/** Give SVG artwork a numeric viewport on Android. Percentage-sized SVG roots
 * can paint only part of an absolutely positioned React Native surface. */
export function MeasuredSvg({ children }: { children: ReactNode }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View testID="measured-svg-surface" style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height} pointerEvents="none" accessible={false}>
          {children}
        </Svg>
      ) : null}
    </View>
  );
}

import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontWeights, spacing } from './tokens';

export type TimelineItemStatus = 'completed' | 'current' | 'pending';

export interface TimelineItemData {
  id: string | number;
  /** Already-translated step label. */
  label: string;
  /** Already-formatted secondary text, e.g. a localized date. */
  description?: string;
  status: TimelineItemStatus;
  /** Already-translated status word, read by screen readers alongside the marker icon. */
  statusText?: string;
  /** e.g. a Badge showing "In progress". */
  trailing?: ReactNode;
}

export interface TimelineProps {
  items: TimelineItemData[];
}

const MARKER_COLORS: Record<TimelineItemStatus, { background: string; foreground: string }> = {
  completed: { background: colors.success.subtle, foreground: colors.success.emphasis },
  current: { background: colors.brand.subtle, foreground: colors.brand.emphasis },
  pending: { background: colors.surface.background, foreground: colors.text.tertiary },
};

const MARKER_SIZE = 32;

/** Vertical status timeline, e.g. mobilization progress. Status is shown by icon + text, not color alone. */
export function Timeline({ items }: TimelineProps) {
  return (
    <View accessibilityRole="list">
      {items.map((item, index) => {
        const marker = MARKER_COLORS[item.status];
        return (
          <View key={item.id} style={styles.row} accessibilityRole="text">
            <View style={styles.markerColumn}>
              <View style={[styles.marker, { backgroundColor: marker.background }]}>
                {item.status === 'completed' ? <Check size={16} color={marker.foreground} /> : null}
                {item.status === 'current' ? <View style={[styles.dot, { backgroundColor: colors.brand.default }]} /> : null}
              </View>
              {index < items.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: item.status === 'completed' ? colors.success.default : colors.border.default },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.content}>
              <Text
                style={[styles.label, item.status === 'current' && styles.labelCurrent]}
                accessibilityLabel={item.statusText ? `${item.label} (${item.statusText})` : item.label}
              >
                {item.label}
              </Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              {item.trailing ? <View style={styles.trailing}>{item.trailing}</View> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[4] },
  markerColumn: { alignItems: 'center' },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connector: { width: 2, flex: 1, minHeight: spacing[12] },
  content: { flex: 1, paddingBottom: spacing[6] },
  label: { fontSize: 16, fontWeight: fontWeights.medium, color: colors.text.primary },
  labelCurrent: { fontWeight: fontWeights.semibold },
  description: { marginTop: spacing[1], fontSize: 14, color: colors.text.secondary },
  trailing: { marginTop: spacing[3] },
});

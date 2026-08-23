import type { ReactElement, ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { LoadingState } from './LoadingState';
import { colors, spacing } from './tokens';

export interface ListProps<T> {
  data: T[];
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  /** True only while loading the first page -- shows LoadingState instead of the list. */
  isLoading?: boolean;
  /** Already-translated message for the initial-load LoadingState. */
  loadingMessage?: string;
  /** Props for the EmptyState shown when loading finished with zero items. */
  emptyState?: EmptyStateProps;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Mobile's pagination equivalent: called when the list is scrolled near the end. */
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  /** Already-translated label for the manual "Load more" footer button. */
  loadMoreLabel?: string;
  header?: ReactNode;
  /** Set false when embedding a short list inside an outer ScrollView, to avoid nesting two scroll containers. */
  scrollEnabled?: boolean;
}

/** FlatList wrapper with built-in loading/empty/refresh/load-more states -- the mobile equivalent of web's DataTable + Pagination. */
export function List<T>({
  data,
  renderItem,
  keyExtractor,
  isLoading = false,
  loadingMessage,
  emptyState,
  onRefresh,
  isRefreshing = false,
  onLoadMore,
  isLoadingMore = false,
  loadMoreLabel,
  header,
  scrollEnabled = true,
}: ListProps<T>) {
  if (isLoading && data.length === 0) {
    return <LoadingState message={loadingMessage ?? ''} />;
  }

  if (!isLoading && data.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      scrollEnabled={scrollEnabled}
      ListHeaderComponent={header ? <View>{header}</View> : null}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={onRefresh ? <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand.default} /> : undefined}
      onEndReachedThreshold={0.4}
      onEndReached={onLoadMore}
      ListFooterComponent={
        isLoadingMore && loadMoreLabel ? (
          <View style={styles.footer}>
            <Button variant="text" size="sm" onPress={() => {}} loading>
              {loadMoreLabel}
            </Button>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  separator: { height: spacing[3] },
  footer: { alignItems: 'center', paddingVertical: spacing[4] },
});

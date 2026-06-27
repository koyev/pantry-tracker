import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemRow } from '@/components/item-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getSettings, listItems, setSettings } from '@/lib/db';
import { rescheduleExpiry } from '@/lib/notifications';
import { useTheme } from '@/hooks/use-theme';
import type { Item } from '@/types/item';
import * as StoreReview from 'expo-store-review';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [list, settings] = await Promise.all([listItems(), getSettings()]);
    setItems(list);
    setLoaded(true);
    // Keep the daily summary fresh whenever the list might have changed.
    await rescheduleExpiry(list, settings);
    // US-7: prompt for a review once, after the first item exists.
    if (list.length > 0 && !settings.hasReviewed) {
      await setSettings({ hasReviewed: true });
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.six,
          },
        ]}
        ListHeaderComponent={
          <ThemedText type="title" style={styles.heading}>
            My Pantry
          </ThemedText>
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <ThemedText type="subtitle">Nothing here yet</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                Tap “+ Scan” to add your first item by scanning a barcode — or add one manually.
              </ThemedText>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ItemRow item={item} onPress={() => router.push(`/item/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
      />

      <Pressable
        onPress={() => router.push('/scan')}
        style={[styles.fab, { bottom: insets.bottom + BottomTabInset + Spacing.three }]}>
        <View style={[styles.fabInner, { backgroundColor: theme.text }]}>
          <ThemedText type="default" style={{ color: theme.background }}>
            + Scan
          </ThemedText>
        </View>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  heading: {
    marginBottom: Spacing.three,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    ...Platform.select({ web: { right: Spacing.four, alignSelf: 'auto' } }),
  },
  fabInner: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    elevation: 4,
  },
});

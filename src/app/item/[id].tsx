import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ItemForm, type ItemFormValues } from '@/components/item-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteItem, getItem, updateItem } from '@/lib/db';
import { useTheme } from '@/hooks/use-theme';
import type { Item } from '@/types/item';

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null | undefined>(undefined);

  useEffect(() => {
    getItem(id).then(setItem);
  }, [id]);

  async function save(values: ItemFormValues) {
    await updateItem(id, values);
    router.back();
  }

  function confirmDelete() {
    const doDelete = async () => {
      await deleteItem(id);
      router.back();
    };
    if (Platform.OS === 'web') {
      // Alert has no buttons on web; use confirm().
      if (typeof window !== 'undefined' && window.confirm('Delete this item?')) doDelete();
      return;
    }
    Alert.alert('Delete item', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }

  if (item === undefined) {
    return <ThemedView style={styles.container} />;
  }

  if (item === null) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText type="subtitle">Item not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ItemForm initial={item} submitLabel="Save changes" onSubmit={save} />
        <Pressable onPress={confirmDelete} style={styles.deleteButton}>
          <ThemedText type="default" themeColor="statusExpired">
            Delete item
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four },
  deleteButton: { alignItems: 'center', paddingVertical: Spacing.three },
});

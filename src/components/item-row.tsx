import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusDot } from '@/components/status-dot';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { expiryLabel } from '@/lib/expiry';
import type { Item } from '@/types/item';

export function ItemRow({ item, onPress }: { item: Item; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <ThemedView type="backgroundElement" style={styles.row}>
        <StatusDot expiryDate={item.expiryDate} />
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
        ) : null}
        <View style={styles.text}>
          <ThemedText type="default" numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {expiryLabel(item.expiryDate)} · {item.quantity} {item.unit} · {item.location}
          </ThemedText>
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  image: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
});

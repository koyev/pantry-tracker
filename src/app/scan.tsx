import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ItemForm, type ItemFormValues } from '@/components/item-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { addItem } from '@/lib/db';
import { lookupBarcode } from '@/lib/openFoodFacts';
import { useTheme } from '@/hooks/use-theme';

type Stage = 'scan' | 'looking-up' | 'form';

export default function ScanScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('scan');
  const [prefill, setPrefill] = useState<Partial<ItemFormValues>>({});
  const handledRef = useRef(false);

  async function onBarcode(data: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    setStage('looking-up');
    const product = await lookupBarcode(data);
    setPrefill({ barcode: data, name: product?.name, imageUrl: product?.imageUrl });
    setStage('form');
  }

  function addManually() {
    handledRef.current = true;
    setPrefill({});
    setStage('form');
  }

  async function save(values: ItemFormValues) {
    await addItem(values);
    router.back();
  }

  if (stage === 'form') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <ItemForm initial={prefill} submitLabel="Save item" onSubmit={save} />
        </ScrollView>
      </ThemedView>
    );
  }

  if (stage === 'looking-up') {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.text} />
        <ThemedText type="default" themeColor="textSecondary">
          Looking up product…
        </ThemedText>
      </ThemedView>
    );
  }

  // stage === 'scan'
  const granted = permission?.granted;

  return (
    <ThemedView style={styles.container}>
      {granted ? (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128'],
          }}
          onBarcodeScanned={({ data }) => onBarcode(data)}
        />
      ) : (
        <View style={styles.center}>
          <ThemedText type="subtitle">Scan a barcode</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
            {permission && !permission.granted
              ? 'Camera access is needed to scan barcodes.'
              : 'Grant camera access to scan, or add an item manually.'}
          </ThemedText>
          {permission && !permission.granted ? (
            <Button label="Enable camera" onPress={requestPermission} theme={theme} />
          ) : null}
        </View>
      )}

      <View style={styles.footer}>
        <Pressable onPress={addManually}>
          <ThemedView type="backgroundElement" style={styles.manualButton}>
            <ThemedText type="default">Add manually</ThemedText>
          </ThemedView>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function Button({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.primaryButton, { backgroundColor: theme.text }]}>
        <ThemedText type="default" style={{ color: theme.background }}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centerText: { textAlign: 'center' },
  formContent: { padding: Spacing.four },
  footer: { padding: Spacing.four },
  manualButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});

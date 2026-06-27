import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { expiryLabel } from '@/lib/expiry';
import { LOCATIONS, UNITS, type Location } from '@/types/item';

export interface ItemFormValues {
  name: string;
  quantity: number;
  unit: string;
  location: Location;
  expiryDate: string; // ISO "YYYY-MM-DD"
  barcode: string | null;
  imageUrl: string | null;
}

interface ItemFormProps {
  initial?: Partial<ItemFormValues>;
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => void | Promise<void>;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function ItemForm({ initial, submitLabel, onSubmit }: ItemFormProps) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [unit, setUnit] = useState(initial?.unit ?? 'pcs');
  const [location, setLocation] = useState<Location>(initial?.location ?? 'fridge');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? todayISO());
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nameValid = name.trim().length > 0 && name.trim().length <= 80;
  const dateValid = isValidISODate(expiryDate);
  const canSubmit = nameValid && dateValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        quantity,
        unit,
        location,
        expiryDate,
        barcode: initial?.barcode ?? null,
        imageUrl: initial?.imageUrl ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) setExpiryDate(date.toISOString().slice(0, 10));
  }

  return (
    <View style={styles.container}>
      {initial?.imageUrl ? (
        <Image source={{ uri: initial.imageUrl }} style={styles.image} contentFit="contain" />
      ) : null}

      <Field label="Name">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Greek Yogurt"
          placeholderTextColor={theme.textSecondary}
          maxLength={80}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
      </Field>

      <Field label="Quantity">
        <View style={styles.stepper}>
          <StepperButton label="−" onPress={() => setQuantity((q) => Math.max(0, q - 1))} />
          <ThemedText type="default" style={styles.qtyValue}>
            {quantity}
          </ThemedText>
          <StepperButton label="+" onPress={() => setQuantity((q) => q + 1)} />
        </View>
      </Field>

      <Field label="Unit">
        <ChipRow options={UNITS} selected={unit} onSelect={setUnit} />
      </Field>

      <Field label="Location">
        <ChipRow
          options={LOCATIONS}
          selected={location}
          onSelect={(v) => setLocation(v as Location)}
        />
      </Field>

      <Field label="Expiry date">
        {Platform.OS === 'web' ? (
          <TextInput
            value={expiryDate}
            onChangeText={setExpiryDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
        ) : (
          <>
            <Pressable onPress={() => setShowPicker(true)}>
              <ThemedView type="backgroundElement" style={styles.input}>
                <ThemedText type="default">{expiryLabel(expiryDate)} ({expiryDate})</ThemedText>
              </ThemedView>
            </Pressable>
            {showPicker ? (
              <DateTimePicker
                value={new Date(`${expiryDate}T00:00:00`)}
                mode="date"
                onChange={onPickerChange}
              />
            ) : null}
          </>
        )}
        {!dateValid ? (
          <ThemedText type="small" themeColor="statusExpired">
            Enter a valid date (YYYY-MM-DD).
          </ThemedText>
        ) : null}
      </Field>

      <Pressable onPress={handleSubmit} disabled={!canSubmit}>
        <View style={[styles.submit, { backgroundColor: theme.text, opacity: canSubmit ? 1 : 0.4 }]}>
          <ThemedText type="default" style={{ color: theme.background }}>
            {submitting ? 'Saving…' : submitLabel}
          </ThemedText>
        </View>
      </Pressable>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <ThemedView type="backgroundElement" style={styles.stepperButton}>
        <ThemedText type="default">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Pressable key={opt} onPress={() => onSelect(opt)}>
          <ThemedView
            type={opt === selected ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.chip}>
            <ThemedText type="small" themeColor={opt === selected ? 'text' : 'textSecondary'}>
              {opt}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.four,
  },
  image: {
    width: '100%',
    height: 140,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 32,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  submit: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});

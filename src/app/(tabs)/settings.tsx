import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getSettings, listItems, setSettings, type Settings } from '@/lib/db';
import { requestNotificationPermission, rescheduleExpiry } from '@/lib/notifications';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [settings, setLocalSettings] = useState<Settings | null>(null);

  const reload = useCallback(async () => {
    setLocalSettings(await getSettings());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function persist(patch: Partial<Settings>) {
    const next = { ...(settings as Settings), ...patch };
    setLocalSettings(next);
    await setSettings(patch);
    await rescheduleExpiry(await listItems(), next);
  }

  async function onToggleNotifications(enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) return; // leave the switch off if permission denied
    }
    await persist({ notificationsEnabled: enabled });
  }

  function changeLeadTime(delta: number) {
    if (!settings) return;
    const leadTimeDays = Math.min(14, Math.max(1, settings.leadTimeDays + delta));
    persist({ leadTimeDays });
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
        ]}>
        <ThemedText type="title" style={styles.heading}>
          Settings
        </ThemedText>

        {settings ? (
          <>
            <ThemedView type="backgroundElement" style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText type="default">Expiry notifications</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  A daily reminder for items about to expire.
                </ThemedText>
              </View>
              <Switch value={settings.notificationsEnabled} onValueChange={onToggleNotifications} />
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText type="default">Lead time</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Warn me {settings.leadTimeDays} {settings.leadTimeDays === 1 ? 'day' : 'days'} before expiry.
                </ThemedText>
              </View>
              <View style={styles.stepper}>
                <Stepper label="−" onPress={() => changeLeadTime(-1)} />
                <ThemedText type="default" style={styles.stepperValue}>
                  {settings.leadTimeDays}
                </ThemedText>
                <Stepper label="+" onPress={() => changeLeadTime(1)} />
              </View>
            </ThemedView>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );

  function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <Pressable onPress={onPress}>
        <View style={[styles.stepperButton, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="default">{label}</ThemedText>
        </View>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({ web: { paddingTop: Spacing.six } }),
  },
  heading: { marginBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.half },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { minWidth: 24, textAlign: 'center' },
});

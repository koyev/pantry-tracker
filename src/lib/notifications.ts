import * as Notifications from 'expo-notifications';

import { daysUntil } from '@/lib/expiry';
import type { Settings } from '@/lib/db';
import type { Item } from '@/types/item';

/**
 * Local-only expiry notifications (PROJECT.md §7). No server.
 *
 * Limitation: a scheduled local notification's body is fixed at schedule time,
 * so the daily summary count can only be as fresh as the last reschedule.
 * Callers reschedule on app foreground and after every add/edit/delete.
 */

const SUMMARY_HOUR = 9; // 9am local
const SUMMARY_MINUTE = 0;

let handlerConfigured = false;

/** Call once at app startup (root layout). */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function countExpiringSoon(items: Item[], leadTimeDays: number): number {
  return items.filter((i) => daysUntil(i.expiryDate) <= leadTimeDays).length;
}

function summaryBody(count: number, leadTimeDays: number): string {
  const plural = count === 1 ? 'item' : 'items';
  return `${count} ${plural} expiring within ${leadTimeDays} ${
    leadTimeDays === 1 ? 'day' : 'days'
  }.`;
}

/**
 * Cancels existing schedules and, if enabled and something qualifies, schedules
 * a daily summary reminder. Safe to call repeatedly.
 */
export async function rescheduleExpiry(items: Item[], settings: Settings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.notificationsEnabled) return;

  const count = countExpiringSoon(items, settings.leadTimeDays);
  if (count === 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Pantry check',
      body: summaryBody(count, settings.leadTimeDays),
      data: { url: '/' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: SUMMARY_HOUR,
      minute: SUMMARY_MINUTE,
    },
  });
}

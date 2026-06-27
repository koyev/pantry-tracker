import { EXPIRY_AMBER_DAYS, type ThemeColor } from '@/constants/theme';
import type { ExpiryStatus } from '@/types/item';

/** Local midnight for an ISO date string ("YYYY-MM-DD") or Date. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today (00:00) to the given expiry date (00:00). Negative = past. */
export function daysUntil(expiryDate: string, now: Date = new Date()): number {
  const target = startOfDay(new Date(`${expiryDate}T00:00:00`));
  const today = startOfDay(now);
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

/** Status per PROJECT.md §5.1: green > 3 days, amber 0..3 days, red expired. */
export function getExpiryStatus(expiryDate: string, now: Date = new Date()): ExpiryStatus {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return 'expired';
  if (days <= EXPIRY_AMBER_DAYS) return 'soon';
  return 'fresh';
}

/** Theme color key for a status, for use with ThemedText/useTheme. */
export function statusColorKey(status: ExpiryStatus): Extract<ThemeColor, `status${string}`> {
  switch (status) {
    case 'expired':
      return 'statusExpired';
    case 'soon':
      return 'statusSoon';
    default:
      return 'statusFresh';
  }
}

/** Human label like "Expired", "Today", "Tomorrow", "in 5 days". */
export function expiryLabel(expiryDate: string, now: Date = new Date()): string {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return days === -1 ? 'Expired yesterday' : `Expired ${-days} days ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

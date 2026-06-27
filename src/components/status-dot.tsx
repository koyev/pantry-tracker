import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { getExpiryStatus, statusColorKey } from '@/lib/expiry';

export function StatusDot({ expiryDate, size = 12 }: { expiryDate: string; size?: number }) {
  const theme = useTheme();
  const color = theme[statusColorKey(getExpiryStatus(expiryDate))];
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      accessibilityLabel={`expiry status: ${getExpiryStatus(expiryDate)}`}
    />
  );
}

import { SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenScrollInsetsOptions = {
  /** Add tab bar clearance (e.g. map tab inside floating tabs). */
  includeTabBar?: boolean;
};

/**
 * Consistent scroll padding for stack screens with a top safe area + back button.
 * Pair with SafeAreaView edges={['top']}.
 */
export function useScreenScrollInsets(options: ScreenScrollInsetsOptions = {}) {
  const insets = useSafeAreaInsets();
  const { includeTabBar = false } = options;

  const paddingBottom = includeTabBar
    ? SCREEN_BOTTOM_INSET + Math.max(insets.bottom, Spacing.sm)
    : Math.max(insets.bottom, Spacing.xl) + Spacing.lg;

  return {
    insets,
    scrollContentStyle: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom,
      gap: Spacing.md,
    },
  };
}

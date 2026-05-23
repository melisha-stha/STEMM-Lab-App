import { Platform } from 'react-native';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxs: 4,
  '2xl': 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  pill: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  hero: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const Typography = {
  hero: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold, letterSpacing: 0.2 },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  section: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  body: { fontSize: FontSize.md, lineHeight: 22, fontWeight: FontWeight.regular },
  small: { fontSize: FontSize.sm, lineHeight: 18, fontWeight: FontWeight.medium },
  mono: Platform.select({
    ios: { fontVariant: ['tabular-nums'] as const },
    default: { fontFamily: 'monospace' },
  }),
};

export const TAB_BAR_HEIGHT = 64;
export const SCREEN_BOTTOM_INSET = Spacing.xxl + TAB_BAR_HEIGHT;

import { Platform } from 'react-native';

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const Typography = {
  hero: { fontSize: 30, fontWeight: '800' as const, letterSpacing: 0.2 },
  title: { fontSize: 20, fontWeight: '800' as const },
  section: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 16 },
  mono: Platform.select({
    ios: { fontVariant: ['tabular-nums'] as const },
    default: { fontFamily: 'monospace' },
  }),
} as const;

export const Shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  android: { elevation: 2 },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
});


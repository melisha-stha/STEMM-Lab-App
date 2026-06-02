import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Font family from @expo-google-fonts/press-start-2p (same key on iOS, Android, and web).
 */
export const PIXEL_FONT_FAMILY = 'PressStart2P_400Regular';

/** Press Start 2P renders much larger than system fonts on Android — scale metrics down. */
const ANDROID_SIZE_TIERS: { min: number; scale: number }[] = [
  { min: 24, scale: 0.55 },
  { min: 16, scale: 0.6 },
  { min: 12, scale: 0.65 },
  { min: 0, scale: 0.7 },
];

function scaleAndroidFontSize(fontSize: number): number {
  const tier = ANDROID_SIZE_TIERS.find((t) => fontSize >= t.min) ?? ANDROID_SIZE_TIERS.at(-1)!;
  return Math.max(8, Math.round(fontSize * tier.scale));
}

function androidLineHeight(fontSize: number, lineHeight?: number): number {
  const minLh = Math.ceil(fontSize * 1.95);
  if (lineHeight == null) return minLh;
  const scaled = Math.round(lineHeight * 0.65);
  return Math.max(minLh, scaled);
}

/**
 * Extra pressable box sizing so pixel labels fit inside buttons (Android only).
 */
export const ANDROID_PIXEL_PRESSABLE_BOX: ViewStyle = Platform.select({
  android: {
    minHeight: 52,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  default: {},
}) as ViewStyle;

export function getPixelFontFamily(loaded: boolean): string | undefined {
  if (!loaded) return undefined;
  return PIXEL_FONT_FAMILY;
}

/**
 * Applies the pixel font. iOS: unchanged metrics. Android: smaller sizes, taller line-height,
 * no letter-spacing, and no system font-weight fallback.
 */
export function withPixelFontStyle(
  family: string | undefined,
  ...styles: (TextStyle | false | null | undefined)[]
): TextStyle {
  const flat = StyleSheet.flatten(styles) ?? {};
  if (!family) return flat;

  if (Platform.OS !== 'android') {
    return { ...flat, fontFamily: family };
  }

  const { fontWeight: _fw, fontStyle: _fs, letterSpacing: _ls, ...rest } = flat;
  const next: TextStyle = {
    ...rest,
    fontFamily: family,
    includeFontPadding: false,
    letterSpacing: 0,
  };

  if (typeof next.fontSize === 'number') {
    const scaled = scaleAndroidFontSize(next.fontSize);
    next.fontSize = scaled;
    next.lineHeight = androidLineHeight(scaled, typeof rest.lineHeight === 'number' ? rest.lineHeight : undefined);
  }

  return next;
}

/** Android-only: use on hero CTAs, mission START, etc. */
export function androidPixelPressableBox(extra?: ViewStyle): ViewStyle {
  if (Platform.OS !== 'android') return extra ?? {};
  return StyleSheet.flatten([ANDROID_PIXEL_PRESSABLE_BOX, extra]) ?? {};
}

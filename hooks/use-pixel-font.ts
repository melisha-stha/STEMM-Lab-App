import { usePixelFontContext } from '@/contexts/pixel-font-context';

export {
  androidPixelPressableBox,
  ANDROID_PIXEL_PRESSABLE_BOX,
  getPixelFontFamily,
  PIXEL_FONT_FAMILY,
  withPixelFontStyle,
} from '@/hooks/pixel-font-utils';

export function usePixelFont() {
  return usePixelFontContext();
}

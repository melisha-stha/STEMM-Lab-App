import { PIXEL_RADIUS, PIXEL_SHADOW } from '@/constants/pixel-brand';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

type PixelBoxProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  shadowColor: string;
};

export function PixelBox({ children, style, shadowColor }: PixelBoxProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.shadow, { backgroundColor: shadowColor }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    paddingRight: PIXEL_SHADOW,
    paddingBottom: PIXEL_SHADOW,
  },
  shadow: {
    position: 'absolute',
    top: PIXEL_SHADOW,
    left: PIXEL_SHADOW,
    right: 0,
    bottom: 0,
    borderRadius: PIXEL_RADIUS,
  },
});

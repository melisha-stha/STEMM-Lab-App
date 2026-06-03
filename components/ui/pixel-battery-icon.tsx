import { PIXEL_BORDER } from '@/constants/pixel-brand';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

const SEGMENTS = 8;
const SEGMENT_WIDTH = 10;
const SEGMENT_HEIGHT = 22;
const SEGMENT_GAP = 2;
const NUB_WIDTH = 5;
const NUB_HEIGHT = 12;

type PixelBatteryIconProps = {
  percent: number | null;
  charging?: boolean;
  fillColor: string;
  trackColor: string;
  borderColor: string;
  chargingAccentColor?: string;
};

export function PixelBatteryIcon({
  percent,
  charging = false,
  fillColor,
  trackColor,
  borderColor,
  chargingAccentColor,
}: PixelBatteryIconProps) {
  const filledSegments = useMemo(() => {
    if (percent == null || percent < 0) return 0;
    return Math.max(0, Math.min(SEGMENTS, Math.round((percent / 100) * SEGMENTS)));
  }, [percent]);

  const boltColor = chargingAccentColor ?? fillColor;

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Pixel battery icon">
      <View style={[styles.body, { borderColor }]}>
        {Array.from({ length: SEGMENTS }, (_, index) => {
          const active = index < filledSegments;
          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? fillColor : trackColor,
                  borderColor,
                },
              ]}
            />
          );
        })}
        {charging ? (
          <View style={styles.boltWrap} pointerEvents="none">
            <View style={[styles.boltStem, { backgroundColor: boltColor }]} />
            <View style={[styles.boltTop, { borderBottomColor: boltColor }]} />
            <View style={[styles.boltBottom, { borderTopColor: boltColor }]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.nub, { backgroundColor: borderColor, borderColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEGMENT_GAP,
    borderWidth: PIXEL_BORDER,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRadius: 4,
    position: 'relative',
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    borderWidth: 2,
    borderRadius: 1,
  },
  nub: {
    width: NUB_WIDTH,
    height: NUB_HEIGHT,
    marginLeft: 3,
    borderWidth: 2,
    borderRadius: 1,
  },
  boltWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boltStem: {
    position: 'absolute',
    width: 4,
    height: 14,
    borderRadius: 1,
    transform: [{ rotate: '12deg' }],
  },
  boltTop: {
    position: 'absolute',
    top: 7,
    left: '38%',
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  boltBottom: {
    position: 'absolute',
    bottom: 7,
    left: '46%',
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

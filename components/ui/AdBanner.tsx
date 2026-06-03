import { Radius, Spacing } from '@/constants/design';
import { getAdMobBannerUnitId } from '@/hooks/notifications';
import { useThemeColor } from '@/hooks/use-theme-color';
import Constants from 'expo-constants';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';

let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    const mobileAds = require('react-native-google-mobile-ads');
    BannerAd = mobileAds.BannerAd;
    BannerAdSize = mobileAds.BannerAdSize;
    TestIds = mobileAds.TestIds;
  } catch (e) {
    if (__DEV__) console.warn('[AdMob]: Native module unavailable.', e);
  }
}

const useRealAds = !isExpoGo && BannerAd != null;

export default function AdBanner() {
  const cardSky = useThemeColor({}, 'cardSky');
  const cardSkyBorder = useThemeColor({}, 'cardSkyBorder');
  const cardSkyText = useThemeColor({}, 'cardSkyText');

  if (Platform.OS === 'web') return null;

  if (!useRealAds) {
    return (
      <View
        style={[
          styles.previewCard,
          {
            backgroundColor: cardSky,
            borderColor: cardSkyBorder,
          },
        ]}>
        <Text style={[styles.previewTitle, { color: cardSkyText }]}>AdMob Preview</Text>
        <Text style={[styles.previewSubtitle, { color: cardSkyText, opacity: 0.78 }]}>
          Real ads appear in APK / dev build
        </Text>
      </View>
    );
  }

  const adUnitId = getAdMobBannerUnitId(TestIds?.BANNER ?? null);

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error: unknown) => {
          if (__DEV__) console.log('[AdMob]: Banner failed to load.', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: Spacing.xs,
    backgroundColor: 'transparent',
  },
  previewCard: {
    width: '100%',
    minHeight: 56,
    borderWidth: 2,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  previewSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
  },
});

import React from 'react';
import { Platform } from 'react-native';

export function BannerAd() {
  // react-native-google-mobile-ads requires a native build (APK/dev build)
  // It cannot run in Expo Go — will be enabled in production APK build
  if (Platform.OS === 'web') return null;
  if (__DEV__) return null; // skip in Expo Go development

  const { BannerAd: AdBanner, BannerAdSize, TestIds } = require('react-native-google-mobile-ads');

  const adUnitId = 'ca-app-pub-1472940621207668/5718257345';

  return (
    <AdBanner
      unitId={adUnitId}
      size={BannerAdSize.BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  );
}
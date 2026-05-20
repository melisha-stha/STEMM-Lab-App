import React from 'react';
import { Platform } from 'react-native';

const PRODUCTION_BANNER_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID ?? 'ca-app-pub-1472940621207668/5718257345';

type GoogleMobileAdsModule = {
  BannerAd: React.ComponentType<{
    unitId: string;
    size: string;
    requestOptions?: { requestNonPersonalizedAdsOnly?: boolean };
  }>;
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string };
  TestIds: { ADAPTIVE_BANNER: string };
};

export default function AdBanner() {
  if (Platform.OS === 'web') {
    return null;
  }

  const { BannerAd, BannerAdSize, TestIds } =
    require('react-native-google-mobile-ads') as GoogleMobileAdsModule;

  const adUnitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : PRODUCTION_BANNER_UNIT_ID;

  return (
    <BannerAd
      unitId={adUnitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  );
}

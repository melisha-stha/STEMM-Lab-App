import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Dynamically check environments to prevent Expo Go runtime crashes
const isExpoGo = Platform.OS === 'web' || (typeof global !== 'undefined' && (global as any).__expo_expo_go_available__);

let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

if (!isExpoGo) {
  try {
    const mobileAds = require('react-native-google-mobile-ads');
    BannerAd = mobileAds.BannerAd;
    BannerAdSize = mobileAds.BannerAdSize;
    TestIds = mobileAds.TestIds;
  } catch (e) {
    console.warn('AdMob SDK module loading bypassed:', e);
  }
}

const PRODUCTION_AD_UNIT_ID = 'ca-app-pub-1472940621207668/5718257345';

const AD_UNIT_ID = __DEV__ 
  ? (TestIds?.BANNER || 'ca-app-pub-3940256099942544/6300978111') 
  : PRODUCTION_AD_UNIT_ID;

export default function AdBanner() {
  if (Platform.OS === 'web') return null;

  if (isExpoGo || !BannerAd) {
    return (
      <View style={styles.devContainer}>
        <Text style={styles.devText}>AdMob Banner Placeholder</Text>
        <Text style={styles.devSubtext}>ID: {PRODUCTION_AD_UNIT_ID}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error: any) => console.log('Ad failed to load wrapper trace: ', error)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  devContainer: {
    width: '100%',
    height: 60,
    backgroundColor: '#E6F4FE',
    borderWidth: 2,
    borderColor: '#0071E3',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    marginVertical: 4,
  },
  devText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0071E3',
  },
  devSubtext: {
    fontSize: 10,
    color: '#0071E3',
    opacity: 0.8,
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
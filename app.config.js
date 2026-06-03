/**
 * Injects native Google Maps API keys at build time from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 * Required for map tiles in APK/dev builds (Expo Go may behave differently).
 */
module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    config.ios?.config?.googleMapsApiKey ||
    config.android?.config?.googleMaps?.apiKey ||
    '';

  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};

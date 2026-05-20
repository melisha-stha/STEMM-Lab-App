# APK Build Guide — SCRUM-199

**Profile:** preview  
**Output:** APK (Android Package) — directly installable, no Play Store required  
**Built with:** EAS Build (Expo Application Services)

## Prerequisites

- EAS CLI installed: `npm install -g eas-cli`
- Logged in: `eas login`
- Project linked: `eas init` (run once)

## AdMob App IDs (verify before building)

The banner ad unit ID in this project is `ca-app-pub-1472940621207668/5718257345` (see `components/ui/AdBanner.tsx`).

Native builds also require **AdMob App IDs** (format `ca-app-pub-XXXXXXXX~YYYYYYYY`) in `app.json` under the `react-native-google-mobile-ads` plugin. Confirm both values in [AdMob](https://admob.google.com) → **Apps** → your app → **App settings** and update `app.json` if they differ from what is committed.

## Build command

```bash
eas build -p android --profile preview
```

## Environment variables

The preview profile reads `EXPO_PUBLIC_*` values from the `env` block in `eas.json`.

- Copy every `EXPO_PUBLIC_FIREBASE_*` value from your local `.env` into `eas.json` before building, **or**
- Prefer [EAS Secrets](https://docs.expo.dev/build-reference/variables/) (`eas secret:create`) so credentials are not stored in git.

`EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` is set to the production banner unit used by `AdBanner.tsx`.

## Downloading the APK

1. Build completes in approximately 10–20 minutes.
2. Open https://expo.dev and navigate to your project.
3. Select the completed build and click **Download**.
4. Transfer the APK to an Android device via USB, Google Drive, or similar.
5. On the device: **Settings → Security → Allow installation from unknown sources**.
6. Open the APK file to install.

## Physical device verification checklist

- [ ] App installs and launches without crash
- [ ] Login and signup work with Firebase Auth
- [ ] AdMob banner renders at the bottom of tab screens (above the tab bar)
- [ ] Parachute accelerometer auto-stop triggers on physical drop
- [ ] GPS tagging captures coordinates on parachute/sound/earthquake save
- [ ] Leaderboard loads and updates in real time
- [ ] Earthquake gyroscope reads live x/y/z values

## Screenshots required for deployment report

- EAS build dashboard showing completed build status
- APK downloaded and installed on physical Android device
- AdMob banner visible on home screen in the installed app
- Accelerometer auto-stop working during a parachute trial
- GPS coordinates captured on results screen

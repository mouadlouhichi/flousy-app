# 🤖 Android App — Setup & Build Guide

> Branch: `feat/expo-mobile-monorepo`
> Updated after fixing all missing items

---

## ✅ All Issues Fixed

| # | Issue | Fix Applied |
|---|---|---|
| 1 | `google-services.json` missing | Created `google-services.json.example` template + conditional check in `app.config.ts` |
| 2 | Google Sign-In `webClientId` never configured | Added `configureGoogleSignIn()` call in `_layout.tsx` + 3-tier fallback in `firebase.ts` |
| 3 | `expo-dev-client` missing | Added `~5.0.20` (required for native Firebase modules) |
| 4 | `eas.json` missing | Created with development/preview/production profiles |
| 5 | No `assets/` directory | Created `assets/` with icon, adaptive-icon, splash, favicon |
| 6 | No adaptive icon + splash config | Added to `app.config.ts` |
| 7 | `react-native-reanimated` missing | Added `~3.16.1` + Babel plugin |
| 8 | `expo-build-properties` missing | Added `~0.13.3` + Android SDK targeting (35/35/24) |
| 9 | `expo-splash-screen` missing | Added `~0.29.24` |
| 10 | `app.config.ts` (dynamic config) | Converted from `app.json` with env var support |
| 11 | `.env.example` missing | Created with `GOOGLE_WEB_CLIENT_ID` |
| 12 | `.gitignore` missing mobile entries | Added `android/`, `ios/`, `google-services.json`, `*.keystore` |
| 13 | `expo-updates` missing | Added `~0.27.5` + OTA config |
| 14 | `GestureHandlerRootView` missing | Wrapped in `_layout.tsx` (required for reanimated) |
| 15 | `expo-constants` missing | Added `~17.0.8` (required by expo-router) |
| 16 | `@shopify/react-native-skia` missing | Added `1.5.0` (required by victory-native) |
| 17 | Deep linking utility | Created `deep-linking.ts` for Firebase auth email actions |
| 18 | `expo-haptics` added | Added `~14.0.1` + haptic feedback on money moves |
| 19 | `expo-checkbox` added | Added `~4.0.1` for modal toggles |
| 20 | `expo-linking` added | Added `~7.0.5` for deep link support |

---

## ⚠️ One-Time Setup Required Before Building

These are things you must do manually (they involve secrets/credentials that can't be committed):

### 1. Download `google-services.json`
```
Firebase Console → Project Settings → Add Android App
  → Package name: com.flousy.app
  → SHA-1: (from your signing key, run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`)
  → Download google-services.json
  → Place at: apps/mobile/google-services.json
```

### 2. Set `GOOGLE_WEB_CLIENT_ID`
```
Firebase Console → Project Settings → Authentication → Sign-in method → Google
  → Copy the "Web client ID" (NOT the Android one)
  → Set in .env or EAS env vars:
    GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

### 3. Initialize EAS Project
```bash
cd apps/mobile
eas init          # Creates the EAS project ID
eas build:configure  # Validates eas.json
```

### 4. Generate Release Keystore (for Play Store)
```bash
cd apps/mobile
keytool -genkey -v -keystore flousy-upload.keystore \
  -alias flousy -keyalg RSA -keysize 2048 -validity 10000
# Store credentials securely — DO NOT commit the keystore
```

---

## 🚀 Build Commands

```bash
# Install dependencies
pnpm install

# Generate native Android project (creates android/ folder)
cd apps/mobile
npx expo prebuild

# Run on Android emulator or connected device
npx expo run:android

# Or build with EAS (cloud)
eas build --profile development --platform android   # Debug APK
eas build --profile preview --platform android        # Preview APK
eas build --profile production --platform android     # Release AAB (Play Store)
```

---

## 📁 New Files Created

```
apps/mobile/
├── app.config.ts              # Dynamic Expo config (replaces app.json)
├── eas.json                   # EAS Build profiles
├── .env.example               # Environment variables template
├── google-services.json.example  # Firebase config template
├── assets/
│   ├── icon.png               # App icon (1024×1024)
│   ├── adaptive-icon.png      # Android adaptive icon foreground
│   ├── splash.png             # Splash screen
│   └── favicon.png            # Web favicon (48×48)
└── src/lib/
    └── deep-linking.ts        # Deep link utilities for Firebase auth
```

## 📝 Files Modified

```
apps/mobile/
├── package.json               # Added 8 new dependencies
├── babel.config.js            # Added reanimated plugin
├── tsconfig.json              # Added app.config.ts to includes
└── src/
    ├── app/_layout.tsx        # Added GestureHandlerRootView + Google Sign-In config
    ├── app/dashboard/index.tsx # Added haptic feedback
    └── lib/firebase.ts        # Added 3-tier webClientId resolution + expo-constants
```

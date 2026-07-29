# 📱 Flousy Native Mobile App (`@flousy/mobile`)

This workspace contains the native **React Native Expo** mobile app for Flousy, sharing domain logic (`@flousy/core`) with the Next.js web application (`@flousy/web`).

---

## 🛠 Prerequisites

To develop or build the Android app, ensure you have:
- **Node.js** 20+
- **pnpm** (`npm install -g pnpm`)
- **Android Studio & Android SDK** (for local emulator or USB device testing)
- **Expo CLI / EAS CLI** (optional, for cloud/local APK builds: `npm install -g eas-cli`)

---

## 🚀 Creating & Running the Android App

### 1. Run in Development on an Android Emulator or Device

If you have an Android emulator running or an Android device connected via USB with USB Debugging enabled:

```bash
# From the root of the monorepo:
pnpm android

# Or from inside apps/mobile:
cd apps/mobile
pnpm run android
```

This will automatically generate the native Android project via Prebuild, compile the app, and launch it on your device/emulator.

---

### 2. Generate Native Android Code (`android/` directory)

If you want to open the Android project directly in **Android Studio** or inspect the native Android Gradle files:

```bash
# From the monorepo root:
pnpm android:prebuild

# Or from apps/mobile:
cd apps/mobile
npx expo prebuild --platform android
```

After running prebuild, open `apps/mobile/android` in Android Studio to build, run, or inspect native dependencies.

---

### 3. Build an APK (for Direct Testing & Distribution)

You can build an installable `.apk` file using Expo Application Services (**EAS Build**) with the configured `preview` profile in `eas.json`:

#### Option A: Build in the Cloud (EAS Build)
```bash
# From monorepo root:
pnpm build:android:apk

# Or from apps/mobile:
cd apps/mobile
eas build --platform android --profile preview
```

#### Option B: Build Locally (requires Docker or local Android SDK)
```bash
# From monorepo root:
pnpm build:android:local

# Or from apps/mobile:
cd apps/mobile
eas build --platform android --profile preview --local
```

---

### 4. Build a Google Play Store App Bundle (`.aab`)

To create a production-ready Android App Bundle (`.aab`) for publishing to the Google Play Store:

```bash
# From monorepo root:
pnpm build:android:aab

# Or from apps/mobile:
cd apps/mobile
eas build --platform android --profile production
```

---

## 📦 What's Included in `@flousy/mobile`

- **Expo SDK 52 + React Native 0.76**
- **NativeWind v4** (Tailwind CSS for React Native)
- **Expo Router v4** (File-based navigation)
- **Firebase Native SDKs**: `@react-native-firebase/app`, `auth`, and `firestore`
- **Biometric Security**: `expo-local-authentication` (Face ID / Fingerprint)
- **Shared Money Math**: `@flousy/core` handles all budgeting, envelopes, and conservation invariants

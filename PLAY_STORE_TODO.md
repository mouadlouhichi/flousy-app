# 🚀 SmartJib — Google Play Store Deployment TODO

> **Goal:** Ship SmartJib v1.0.0 to the Google Play Store  
> **Branch:** `feat/expo-mobile-monorepo`  
<<<<<<< HEAD
> **App:** `com.flousy.app` (Expo SDK 52, React Native 0.76)
=======
> **App:** `com.luigiagentz.smartjib` (Expo SDK 52, React Native 0.76)
>>>>>>> 6b570ec (feat: configure Android app with real Firebase credentials)

---

## Phase 1: Firebase & Credentials 🔴 BLOCKER

- [ ] **1.1** Create a Firebase project (if not already done)
  - Go to [Firebase Console](https://console.firebase.google.com/) → Add Project → `flousy`
  - Enable Google Analytics (recommended)

- [ ] **1.2** Register Android app in Firebase
  - Firebase Console → Project Settings → Add App → Android
<<<<<<< HEAD
  - Package name: `com.flousy.app`
=======
  - Package name: `com.luigiagentz.smartjib`
>>>>>>> 6b570ec (feat: configure Android app with real Firebase credentials)
  - App nickname: `SmartJib`
  - Debug SHA-1: Run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`

- [ ] **1.3** Download `google-services.json`
  - Place at: `apps/mobile/google-services.json`
  - ⚠️ This file is in `.gitignore` — never commit it

- [ ] **1.4** Enable Firebase Authentication
  - Firebase Console → Authentication → Sign-in method
  - Enable **Email/Password**
  - Enable **Google** → Copy the **Web Client ID** (NOT the Android one)

- [ ] **1.5** Set `GOOGLE_WEB_CLIENT_ID`
  - Create `apps/mobile/.env`:
    ```
    GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
    ```
  - Or set in `eas.json` → build profiles → `env.GOOGLE_WEB_CLIENT_ID`

- [ ] **1.6** Enable Cloud Firestore
  - Firebase Console → Firestore Database → Create database
  - Start in **test mode** (lock down before production)
  - Deploy `firestore.rules` from repo root:
    ```bash
    firebase deploy --only firestore:rules
    ```

- [ ] **1.7** Configure Firestore indexes (if needed)
  - The app queries `users/{uid}/months/{monthId}` and `users/{uid}/data/savings`
  - These are single-document lookups — no composite indexes needed yet

---

## Phase 2: EAS Build Setup 🟡

- [ ] **2.1** Install EAS CLI globally
  ```bash
  npm install -g eas-cli
  ```

- [ ] **2.2** Login to Expo
  ```bash
  eas login
  ```

- [ ] **2.3** Initialize EAS project
  ```bash
  cd apps/mobile
  eas init
  ```
  - This will generate a project ID — update `app.config.ts` → `extra.eas.projectId`

- [ ] **2.4** Verify `eas.json` configuration
  - Ensure `GOOGLE_WEB_CLIENT_ID` is set in each profile's `env`
  - Ensure `expo.devClient` is correct for each profile

- [ ] **2.5** Run first development build
  ```bash
  eas build --profile development --platform android
  ```
  - Install the APK on a test device
  - Verify Firebase Auth works (email + Google Sign-In)
  - Verify Firestore reads/writes work

---

## Phase 3: Android Prebuild & Native Config 🟡

- [ ] **3.1** Generate native Android project
  ```bash
  cd apps/mobile
  npx expo prebuild
  ```
  - This creates `apps/mobile/android/` (already in `.gitignore`)
  - Verify `google-services.json` is copied into `android/app/`

- [ ] **3.2** Verify Android manifest
  - Check `android/app/src/main/AndroidManifest.xml`:
<<<<<<< HEAD
    - `package="com.flousy.app"`
=======
    - `package="com.luigiagentz.smartjib"`
>>>>>>> 6b570ec (feat: configure Android app with real Firebase credentials)
    - Permissions: `USE_BIOMETRIC`, `USE_FINGERPRINT`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`
    - Internet permission should be auto-added by Firebase

- [ ] **3.3** Verify build.gradle
  - `compileSdkVersion = 35`
  - `targetSdkVersion = 35`
  - `minSdkVersion = 24`
  - `versionCode = 1`
  - `versionName = "1.0.0"`

- [ ] **3.4** Test on Android emulator
  ```bash
  npx expo run:android
  ```
  - Walk through all 7 tabs
  - Test login, signup, demo mode
  - Test onboarding flow
  - Test expense/bill/debt CRUD
  - Test CSV export/import
  - Test biometric lock
  - Test notifications

- [ ] **3.5** Test on physical Android device
  - Install the development build APK
  - Test Google Sign-In (requires real device or Google Play Services on emulator)
  - Test biometric authentication (fingerprint/face)
  - Test push notifications

---

## Phase 4: Signing & Release Build 🟡

- [ ] **4.1** Generate upload keystore
  ```bash
  cd apps/mobile
  keytool -genkey -v \
    -keystore flousy-upload.keystore \
    -alias flousy \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000
  ```
  - ⚠️ Store the keystore and passwords SECURELY (1Password, etc.)
  - ⚠️ `flousy-upload.keystore` is in `.gitignore`

- [ ] **4.2** Configure keystore for EAS Build
  - Option A: Store credentials in EAS (recommended)
    ```bash
    eas credentials
    ```
  - Option B: Local `.easrc` or `build.json` (not recommended for teams)

- [ ] **4.3** Build release AAB
  ```bash
  eas build --profile production --platform android
  ```
  - This produces an `.aab` (Android App Bundle) file
  - Download from EAS dashboard

- [ ] **4.4** Test the release build
  - Install the AAB on a test device using `bundletool`
  - Or use `eas build --profile preview` for an APK version
  - Verify all features work in release mode
  - Check for any debug-only issues

---

## Phase 5: Google Play Console Setup 🟡

- [ ] **5.1** Create Google Play Developer account
  - Go to [Google Play Console](https://play.google.com/console)
  - Pay the one-time $25 registration fee
  - Complete account verification

- [ ] **5.2** Create the app listing
  - App name: `SmartJib`
  - Default language: `English`
  - App or game: `App`
  - Free or paid: `Free`

- [ ] **5.3** Store listing — Content
  - [ ] **Short description** (80 chars max):
    ```
    Smart budgeting with envelope strategy. Track expenses, savings, debts & bills.
    ```
  - [ ] **Full description** (4000 chars max):
    ```
    SmartJib is your personal budget companion that helps you manage money using 
    the proven envelope budgeting strategy. Split your income into Needs, Wants, 
    and Savings envelopes, track where your money is (bank, home, wallet), and 
    stay on top of your financial goals.

    📊 ENVELOPE BUDGETING
    Choose from 50/30/20, 60/20/20, or 70/20/10 strategies. Every dirham is 
    accounted for across your envelopes and money places.

    💰 EXPENSE TRACKING
    Record variable expenses and fixed bills. Categorize by type, assign to 
    household members, and track where money was spent from.

    🐍 SAVINGS GOALS
    Set and track global saving goals that survive month rollovers. Fund goals 
    from any money place.

    ⚖️ DEBTS & CREDITS
    Track money you owe and money owed to you. Settle debts with one tap.

    📈 TRENDS & ANALYTICS
    View 6-month spending history, category breakdowns, envelope utilization, 
    and household member spending distribution.

    🔒 SECURITY
    Biometric app lock (fingerprint / Face ID). Email verification. 
    Account deletion (GDPR compliant).

    🌍 MULTILINGUAL
    Available in English, French, and Arabic (with RTL support).

    📤 DATA PORTABILITY
    Import and export your budget data as CSV. No vendor lock-in.
    ```
  - [ ] **App icon**: Use `apps/mobile/assets/icon.png` (512×512 minimum)
  - [ ] **Feature graphic** (1024×500): Create a banner showing SmartJib's key features
  - [ ] **Phone screenshots** (minimum 4, maximum 8):
    - Take screenshots from a physical device or emulator
    - Recommended: 1080×1920 or 1080×2340
    - Show: Login, Dashboard Overview, Transactions, Trends, Savings
  - [ ] **Tablet screenshots** (optional but recommended)

- [ ] **5.4** Store listing — Categorization
  - App category: `Finance`
  - Tags: `Budget`, `Money`, `Finance`, `Expense Tracker`, `Savings`
  - Content rating: Complete the IARC questionnaire (likely PEGI 3 / Everyone)

- [ ] **5.5** Store listing — Contact details
  - Email: Your support email
  - Privacy policy URL: `https://flousy.app/privacy`
  - Terms of service URL: `https://flousy.app/terms`

- [ ] **5.6** Content rating
  - Complete the IARC questionnaire
  - Answer: No violence, no gambling, no user-generated content sharing, no location data
  - Expected rating: **Everyone / PEGI 3**

- [ ] **5.7** Target audience
  - Age: 18+ (financial app)
  - Primary: Adults managing personal/household budgets

---

## Phase 6: Data Safety & Privacy 🟡

- [ ] **6.1** Complete Google Play Data Safety section
  - **Data collected:**
    - ✅ Email address (for authentication)
    - ✅ Financial data (budget, expenses, savings — stored in user's own Firestore)
  - **Data shared:** None
  - **Data encrypted:** Yes (in transit via HTTPS, at rest via Firestore)
  - **Data deletion:** Yes (in-app account deletion available)
  - **Independent security review:** No (not required for this app type)

- [ ] **6.2** Ensure privacy policy page is live
  - Already exists at `apps/web/src/app/privacy/page.tsx`
  - Deploy to `https://flousy.app/privacy` (or wherever your web app is hosted)
  - Must include: data collection, usage, storage, deletion, third parties (Firebase/Google)

- [ ] **6.3** Ensure terms of service page is live
  - Already exists at `apps/web/src/app/terms/page.tsx`
  - Deploy to `https://flousy.app/terms`

- [ ] **6.4** App permissions justification
  - `USE_BIOMETRIC` / `USE_FINGERPRINT`: For biometric app lock
  - `RECEIVE_BOOT_COMPLETED`: For budget notification scheduling
  - `VIBRATE`: For notification haptic feedback
  - Internet: For Firebase Auth & Firestore sync

---

## Phase 7: Pre-Launch Testing 🟡

- [ ] **7.1** Internal testing track
  - Upload the AAB to Google Play Console → Internal testing
  - Add 5-10 internal testers (email addresses)
  - Roll out to internal testing
  - Have testers verify all features

- [ ] **7.2** Test on multiple devices/API levels
  - Minimum: Android 7.0 (API 24) — set in `expo-build-properties`
  - Test on: Android 10, 12, 13, 14
  - Test on: Small phone, large phone, tablet
  - Test on: Devices with/without fingerprint sensor

- [ ] **7.3** Test offline behavior
  - Firestore has offline persistence by default
  - Verify app works without network (demo mode should work fully)
  - Verify app recovers gracefully when network returns

- [ ] **7.4** Test RTL layout (Arabic)
  - Switch language to Arabic in settings
  - Verify all screens render correctly in RTL
  - Verify `I18nManager.forceRTL()` works

- [ ] **7.5** Accessibility check
  - Test with TalkBack screen reader
  - Verify all interactive elements have accessibility labels
  - Verify color contrast ratios meet WCAG 2.1 AA

- [ ] **7.6** Performance check
  - Verify app launches in < 3 seconds
  - Verify smooth scrolling on all tabs
  - Verify no memory leaks (use Flipper or React DevTools Profiler)

---

## Phase 8: App Content & Final Polish 🟢

- [ ] **8.1** Create feature graphic (1024×500)
  - Banner image for the Play Store listing
  - Should show SmartJib's key value proposition

- [ ] **8.2** Take store screenshots
  - Use Android Studio's screenshot tool or `adb shell screencap`
  - Minimum 4 screenshots:
    1. Dashboard overview with envelopes
    2. Transaction list with categories
    3. Trends chart with 6-month history
    4. Savings goals progress
  - Optional: Add promotional text overlays

- [ ] **8.3** Dark mode verification
  - Verify all screens look correct in dark mode
  - Test system dark mode toggle
  - Check all modals in dark mode

- [ ] **8.4** Edge cases
  - Test with zero budget (no data)
  - Test with very large budget numbers
  - Test with no expenses / no bills
  - Test month switching across year boundaries
  - Test demo mode → sign in transition

- [ ] **8.5** Error handling
  - Test with no internet (Firebase should cache)
  - Test with expired Google Sign-In
  - Test with invalid email/password
  - Test account deletion flow

---

## Phase 9: Production Release 🟢

- [ ] **9.1** Lock down Firestore rules
  - Deploy production `firestore.rules` from repo
  - Verify rules block unauthorized access
  - Test with unauthenticated user

- [ ] **9.2** Update `versionCode` and `versionName`
  - In `app.config.ts`:
    ```ts
    version: "1.0.0",
    android: { versionCode: 1 }
    ```

- [ ] **9.3** Final production build
  ```bash
  cd apps/mobile
  eas build --profile production --platform android
  ```

- [ ] **9.4** Submit to Google Play
  ```bash
  eas submit --profile production --platform android
  ```
  - Or manually upload the AAB via Google Play Console

- [ ] **9.5** Roll out to production
  - Start with 10% rollout → monitor crash rates
  - Increase to 50% → monitor reviews
  - Full rollout (100%)

- [ ] **9.6** Set up Google Play Console alerts
  - Crash rate alerts
  - ANR (Application Not Responding) alerts
  - User feedback alerts
  - Review notifications

---

## Phase 10: Post-Launch 🟢

- [ ] **10.1** Monitor crash analytics
  - Set up Firebase Crashlytics (optional but recommended)
  - Or use Google Play Console's Android vitals

- [ ] **10.2** Set up OTA updates with EAS Update
  - Configure `expo-updates` URL in `app.config.ts`
  - Push minor fixes without a full Play Store review

- [ ] **10.3** Respond to user reviews
  - Monitor Google Play Console → Reviews
  - Respond promptly to negative reviews

- [ ] **10.4** Plan next release
  - Collect user feedback
  - Prioritize features for v1.1.0
  - Consider: Recurring transaction reminders, budget templates, multi-currency, data export to PDF

---

## 📋 Quick Reference — Commands

```bash
# Install deps
pnpm install

# Generate native project
cd apps/mobile && npx expo prebuild

# Run on emulator
npx expo run:android

# Development build (EAS)
eas build --profile development --platform android

# Preview build (APK)
eas build --profile preview --platform android

# Production build (AAB)
eas build --profile production --platform android

# Submit to Play Store
eas submit --profile production --platform android

# Typecheck
npx tsc --noEmit

# Core tests
pnpm --filter @flousy/core test
```

---

## 📋 Quick Reference — Key Files

| File | Purpose |
|---|---|
| `apps/mobile/app.config.ts` | Dynamic Expo config (env vars, plugins, Android settings) |
| `apps/mobile/eas.json` | EAS Build profiles (dev, preview, production) |
| `apps/mobile/.env.example` | Required environment variables |
| `apps/mobile/google-services.json.example` | Firebase config template |
| `apps/mobile/babel.config.js` | Babel with reanimated plugin |
| `apps/mobile/assets/` | App icons, splash, favicon |
| `apps/mobile/src/lib/firebase.ts` | Google Sign-In config (3-tier fallback) |
| `apps/mobile/src/lib/deep-linking.ts` | Deep link utilities |
| `firestore.rules` | Firestore security rules |

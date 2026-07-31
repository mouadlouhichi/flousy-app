const GOOGLE_WEB_CLIENT_ID =
  process.env.GOOGLE_WEB_CLIENT_ID ??
  "636070498350-g7pjc8019fm4cggpepdvk2es3532k1b8.apps.googleusercontent.com";

const fs = require("fs");
const path = require("path");

// Only reference the iOS Firebase plist when it actually exists. The repo ships
// GoogleService-Info.plist.example; without the real file Expo prints
// "Could not parse Expo config: ios.googleServicesFile" on every command.
const iosGoogleServicesFile = fs.existsSync(
  path.join(__dirname, "GoogleService-Info.plist"),
)
  ? "./GoogleService-Info.plist"
  : undefined;

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "SmartJib",
  slug: "smartjib",
  owner: "mouadlouhichi",
  version: "1.0.0",
  scheme: "smartjib",
  orientation: "portrait",
  userInterfaceStyle: "automatic",

  // ─── Splash Screen ───────────────────────────────────────────────
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#2ea44f",
  },

  // ─── iOS ─────────────────────────────────────────────────────────
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.luigiagentz.smartjib",
    infoPlist: {
      NSFaceIDUsageDescription:
        "SmartJib uses Face ID to securely unlock your private budget.",
    },
    googleServicesFile: iosGoogleServicesFile,
  },

  // ─── Android ─────────────────────────────────────────────────────
  android: {
    package: "com.luigiagentz.smartjib",
    versionCode: 1,
    googleServicesFile: "./google-services.json",
    permissions: [
      "USE_BIOMETRIC",
      "USE_FINGERPRINT",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#2ea44f",
    },
  },

  // ─── Web ─────────────────────────────────────────────────────────
  web: {
    favicon: "./assets/favicon.png",
  },

  // ─── Plugins ─────────────────────────────────────────────────────
  plugins: [
    "expo-router",
    "expo-localization",
    "expo-local-authentication",
    "expo-font",
    "expo-splash-screen",
    "expo-updates",
    [
      "@react-native-firebase/app",
      {
        googleWebClientId: GOOGLE_WEB_CLIENT_ID,
      },
    ],
    "@react-native-google-signin/google-signin",
    "expo-notifications",
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
        },
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          // The SDK 52 template sets ext.kotlinVersion = 1.9.25 (so
          // expo-modules-core picks Compose compiler 1.5.15 + KSP
          // 1.9.25-1.0.20), but the root build.gradle declares
          // `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')` with no
          // version, so the Kotlin plugin actually resolves to 1.9.24 via
          // @react-native/gradle-plugin. That mismatch fails
          // :expo-modules-core:compileDebugKotlin. Setting kotlinVersion here
          // makes expo-build-properties pin the classpath to 1.9.25.
          kotlinVersion: "1.9.25",
        },
      },
    ],
  ],

  // ─── EAS Updates ─────────────────────────────────────────────────
  updates: {
    url: "https://u.expo.dev/67a3635e-ac8a-430b-b861-f327d921e4ea",
  },

  // ─── Runtime Version ─────────────────────────────────────────────
  runtimeVersion: {
    policy: "appVersion",
  },

  // ─── Extra (env vars accessible at runtime) ──────────────────────
  extra: {
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: "67a3635e-ac8a-430b-b861-f327d921e4ea",
    },
  },
};

module.exports = config;

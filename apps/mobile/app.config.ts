import type { ExpoConfig, ConfigContext } from "expo/config";

const GOOGLE_WEB_CLIENT_ID =
  process.env.GOOGLE_WEB_CLIENT_ID ??
  "636070498350-g7pjc8019fm4cggpepdvk2es3532k1b8.apps.googleusercontent.com";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SmartJib",
  slug: "smartjib",
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
    googleServicesFile: "./GoogleService-Info.plist",
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
        },
      },
    ],
  ],

  // ─── EAS Updates ─────────────────────────────────────────────────
  updates: {},

  // ─── Runtime Version ─────────────────────────────────────────────
  runtimeVersion: {
    policy: "appVersion",
  },

  // ─── Extra (env vars accessible at runtime) ──────────────────────
  extra: {
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
    eas: {},
  },
});

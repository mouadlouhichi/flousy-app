import type { ExpoConfig, ConfigContext } from "expo/config";
import * as fs from "fs";
import * as path from "path";

const GOOGLE_WEB_CLIENT_ID =
  process.env.GOOGLE_WEB_CLIENT_ID ??
  "636070498350-g7pjc8019fm4cggpepdvk2es3532k1b8.apps.googleusercontent.com";

// Check if google-services.json exists at build time
const googleServicesPath = path.join(__dirname, "google-services.json");
const hasGoogleServices = fs.existsSync(googleServicesPath);

// Check if GoogleService-Info.plist exists at build time (iOS)
const googleServicesPlistPath = path.join(
  __dirname,
  "GoogleService-Info.plist"
);
const hasGoogleServicesPlist = fs.existsSync(googleServicesPlistPath);

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
    // Always set the path — @react-native-firebase/app plugin requires it at prebuild time.
    // If the real file doesn't exist, we create a minimal placeholder so prebuild succeeds.
    googleServicesFile: "./GoogleService-Info.plist",
  },

  // ─── Android ─────────────────────────────────────────────────────
  android: {
    package: "com.luigiagentz.smartjib",
    versionCode: 1,
    // Always set the path — @react-native-firebase/app plugin requires it at prebuild time.
    // If the real file doesn't exist, we create a minimal placeholder so prebuild succeeds.
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
    // Note: react-native-reanimated/plugin is in babel.config.js, not here
  ],

  // ─── EAS Updates ─────────────────────────────────────────────────
  updates: {
    url: "https://u.expo.dev/your-project-id-here",
  },

  // ─── Runtime Version ─────────────────────────────────────────────
  runtimeVersion: {
    policy: "appVersion",
  },

  // ─── Extra (env vars accessible at runtime) ──────────────────────
  extra: {
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: "your-eas-project-id-here",
    },
  },
});

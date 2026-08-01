Running 'gradlew :app:assembleDebug' in /home/expo/workingdir/build/apps/mobile/android
Downloading https://services.gradle.org/distributions/gradle-8.10.2-all.zip
10%.
20%.
30%.
40%.
50%.
60%.
70%.
80%.
90%.
100%
Welcome to Gradle 8.10.2!
Here are the highlights of this release:
 - Support for Java 23
 - Faster configuration cache
 - Better configuration cache reports
For more details see https://docs.gradle.org/8.10.2/release-notes.html
To honour the JVM settings for this build a single-use Daemon process will be forked. For more on this, please refer to https://docs.gradle.org/8.10.2/userguide/gradle_daemon.html#sec:disabling_the_daemon in the Gradle documentation.
Daemon will be stopped at the end of the build
> Task :gradle-plugin:shared:checkKotlinGradlePluginConfigurationErrors
> Task :gradle-plugin:settings-plugin:checkKotlinGradlePluginConfigurationErrors
> Task :gradle-plugin:settings-plugin:pluginDescriptors
> Task :gradle-plugin:settings-plugin:processResources
> Task :gradle-plugin:shared:processResources NO-SOURCE
> Task :gradle-plugin:shared:compileKotlin
> Task :gradle-plugin:shared:compileJava NO-SOURCE
> Task :gradle-plugin:shared:classes UP-TO-DATE
> Task :gradle-plugin:shared:jar
> Task :gradle-plugin:settings-plugin:compileKotlin
> Task :gradle-plugin:settings-plugin:compileJava
NO-SOURCE
> Task :gradle-plugin:settings-plugin:classes
> Task :gradle-plugin:settings-plugin:jar
> Task :gradle-plugin:react-native-gradle-plugin:checkKotlinGradlePluginConfigurationErrors
> Task :expo-dev-launcher-gradle-plugin:checkKotlinGradlePluginConfigurationErrors
> Task :expo-updates-gradle-plugin:checkKotlinGradlePluginConfigurationErrors
> Task :expo-updates-gradle-plugin:pluginDescriptors
> Task :expo-dev-launcher-gradle-plugin:pluginDescriptors
> Task :expo-updates-gradle-plugin:processResources
> Task :expo-dev-launcher-gradle-plugin:processResources
> Task :gradle-plugin:react-native-gradle-plugin:pluginDescriptors
> Task :gradle-plugin:react-native-gradle-plugin:processResources
> Task :gradle-plugin:react-native-gradle-plugin:compileKotlin
> Task :gradle-plugin:react-native-gradle-plugin:compileJava NO-SOURCE
> Task :gradle-plugin:react-native-gradle-plugin:classes
> Task :gradle-plugin:react-native-gradle-plugin:jar
> Task :expo-dev-launcher-gradle-plugin:compileKotlin
> Task :expo-dev-launcher-gradle-plugin:compileJava NO-SOURCE
> Task :expo-dev-launcher-gradle-plugin:classes
> Task :expo-dev-launcher-gradle-plugin:jar
> Task :expo-updates-gradle-plugin:compileKotlin
> Task :expo-updates-gradle-plugin:compileJava NO-SOURCE
> Task :expo-updates-gradle-plugin:classes
> Task :expo-updates-gradle-plugin:jar
> Configure project :app
ℹ️  [33mApplying gradle plugin[0m '[32mexpo-dev-launcher-gradle-plugin[0m' (expo-dev-launcher@5.0.35)
ℹ️  [33mApplying gradle plugin[0m '[32mexpo-updates-gradle-plugin[0m' (expo-updates@0.27.5)
> Configure project :expo
Using expo modules
- [32mexpo-application[0m (6.0.2)
- [32mexpo-asset[0m (11.0.5)
  - [32mexpo-constants[0m (17.0.8)
  - [32mexpo-dev-client[0m (5.0.20)
  - [32mexpo-dev-launcher[0m (5.0.35)
  - [32mexpo-dev-menu[0m (6.0.25)
  - [32mexpo-eas-client[0m (0.13.3)
  - [32mexpo-file-system[0m (18.0.12)
  - [32mexpo-font[0m (13.0.4)
- [32mexpo-haptics[0m (14.0.1)
  - [32mexpo-json-utils[0m (0.14.0)
  - [32mexpo-keep-awake[0m (14.0.3)
  - [32mexpo-linking[0m (7.0.5)
  - [32mexpo-local-authentication[0m (15.0.2)
  - [32mexpo-localization[0m (16.0.1)
  - [32mexpo-manifests[0m (0.15.8)
  - [32mexpo-modules-core[0m (2.2.3)
  - [32mexpo-notifications[0m (0.29.14)
  - [32mexpo-sharing[0m (13.0.1)
  - [32mexpo-splash-screen[0m (0.29.24)
- [32mexpo-structured-headers[0m (4.0.0)
  - [32mexpo-updates[0m (0.27.5)
> Configure project :react-native-firebase_app
:react-native-firebase_app package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/app/package.json
:react-native-firebase_app:firebase.bom using default value: 33.12.0
:react-native-firebase_app:play.play-services-auth using default value: 21.3.0
:react-native-firebase_app package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/app/package.json
:react-native-firebase_app:version set from package.json: 21.14.0 (21,14,0 - 21014000)
:react-native-firebase_app:android.compileSdk using custom value: 35
:react-native-firebase_app:android.targetSdk using custom value: 35
:react-native-firebase_app:android.minSdk using custom value: 24
:react-native-firebase_app:reactNativeAndroidDir /home/expo/workingdir/build/node_modules/react-native/android
> Configure project :react-native-firebase_auth
:react-native-firebase_auth package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/auth/package.json
:react-native-firebase_app package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/app/package.json
:react-native-firebase_auth:firebase.bom using default value: 33.12.0
:react-native-firebase_auth package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/auth/package.json
:react-native-firebase_auth:version set from package.json: 21.14.0 (21,14,0 - 21014000)
:react-native-firebase_auth:android.compileSdk using custom value: 35
:react-native-firebase_auth:android.targetSdk using custom value: 35
:react-native-firebase_auth:android.minSdk using custom value: 24
:react-native-firebase_auth:reactNativeAndroidDir /home/expo/workingdir/build/node_modules/react-native/android
> Configure project :react-native-firebase_firestore
:react-native-firebase_firestore package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/firestore/package.json
:react-native-firebase_app package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/app/package.json
:react-native-firebase_firestore:firebase.bom using default value: 33.12.0
:react-native-firebase_firestore package.json found at /home/expo/workingdir/build/node_modules/@react-native-firebase/firestore/package.json
:react-native-firebase_firestore:version set from package.json: 21.14.0 (21,14,0 - 21014000)
:react-native-firebase_firestore:android.compileSdk using custom value: 35
:react-native-firebase_firestore:android.targetSdk using custom value: 35
:react-native-firebase_firestore:android.minSdk using custom value: 24
:react-native-firebase_firestore:reactNativeAndroidDir /home/expo/workingdir/build/node_modules/react-native/android
> Configure project :react-native-reanimated
Android gradle plugin: 8.6.0
Gradle: 8.10.2
> Configure project :shopify_react-native-skia
react-native-skia: node_modules/ found at: /home/expo/workingdir/build/node_modules
react-native-skia: RN Version: 76 / 0.76.9
react-native-skia: isSourceBuild: false
react-native-skia: PrebuiltDir: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build/react-native-0*/jni
react-native-skia: buildType: debug
react-native-skia: buildDir: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build
react-native-skia: node_modules: /home/expo/workingdir/build/node_modules
react-native-skia: Enable Prefab: true
react-native-skia: aar state post 70, do nothing
Checking the license for package Android SDK Build-Tools 34 in /home/expo/Android/Sdk/licenses
License for package Android SDK Build-Tools 34 accepted.
Preparing "Install Android SDK Build-Tools 34 v.34.0.0".
"Install Android SDK Build-Tools 34 v.34.0.0" ready.
Installing Android SDK Build-Tools 34 in /home/expo/Android/Sdk/build-tools/34.0.0
"Install Android SDK Build-Tools 34 v.34.0.0" complete.
"Install Android SDK Build-Tools 34 v.34.0.0" finished.
> Task :expo-asset:preBuild UP-TO-DATE
> Task :expo-application:preBuild UP-TO-DATE
> Task :expo-application:preDebugBuild UP-TO-DATE
> Task :expo-asset:preDebugBuild UP-TO-DATE
> Task :expo-application:writeDebugAarMetadata
> Task :expo-asset:writeDebugAarMetadata
> Task :expo-dev-client:preBuild UP-TO-DATE
> Task :expo-dev-client:preDebugBuild UP-TO-DATE
> Task :expo-dev-client:writeDebugAarMetadata
> Task :expo-dev-launcher:preBuild UP-TO-DATE
> Task :expo-dev-launcher:preDebugBuild UP-TO-DATE
> Task :expo-dev-launcher:writeDebugAarMetadata
> Task :expo-dev-menu:preBuild UP-TO-DATE
> Task :expo-dev-menu:preDebugBuild UP-TO-DATE
> Task :expo-dev-menu:writeDebugAarMetadata
> Task :expo-dev-menu-interface:preBuild UP-TO-DATE
> Task :expo-dev-menu-interface:preDebugBuild UP-TO-DATE
> Task :expo-dev-menu-interface:writeDebugAarMetadata
> Task :expo-eas-client:preBuild UP-TO-DATE
> Task :expo-eas-client:preDebugBuild UP-TO-DATE
> Task :expo-eas-client:writeDebugAarMetadata
> Task :expo-file-system:preBuild UP-TO-DATE
> Task :expo-file-system:preDebugBuild UP-TO-DATE
> Task :expo-file-system:writeDebugAarMetadata
> Task :expo-font:preBuild UP-TO-DATE
> Task :expo-font:preDebugBuild UP-TO-DATE
> Task :expo-font:writeDebugAarMetadata
> Task :expo-haptics:preBuild UP-TO-DATE
> Task :expo-haptics:preDebugBuild UP-TO-DATE
> Task :expo-haptics:writeDebugAarMetadata
> Task :expo-json-utils:preBuild UP-TO-DATE
> Task :expo-json-utils:preDebugBuild UP-TO-DATE
> Task :expo-json-utils:writeDebugAarMetadata
> Task :expo-keep-awake:preBuild UP-TO-DATE
> Task :expo-keep-awake:preDebugBuild UP-TO-DATE
> Task :expo-keep-awake:writeDebugAarMetadata
> Task :expo-linking:preBuild UP-TO-DATE
> Task :expo-linking:preDebugBuild UP-TO-DATE
> Task :expo-linking:writeDebugAarMetadata
> Task :expo-local-authentication:preBuild UP-TO-DATE
> Task :expo-local-authentication:preDebugBuild UP-TO-DATE
> Task :expo-local-authentication:writeDebugAarMetadata
> Task :expo-localization:preBuild UP-TO-DATE
> Task :expo-localization:preDebugBuild UP-TO-DATE
> Task :expo-localization:writeDebugAarMetadata
> Task :expo-manifests:preBuild UP-TO-DATE
> Task :expo-manifests:preDebugBuild UP-TO-DATE
> Task :expo-manifests:writeDebugAarMetadata
> Task :expo-modules-core:preBuild UP-TO-DATE
> Task :expo-modules-core:preDebugBuild UP-TO-DATE
> Task :expo-modules-core:writeDebugAarMetadata
> Task :expo-notifications:preBuild UP-TO-DATE
> Task :expo-notifications:preDebugBuild UP-TO-DATE
> Task :expo-notifications:writeDebugAarMetadata
> Task :expo-sharing:preBuild UP-TO-DATE
> Task :expo-sharing:preDebugBuild UP-TO-DATE
> Task :expo-sharing:writeDebugAarMetadata
> Task :expo-splash-screen:preBuild UP-TO-DATE
> Task :expo-splash-screen:preDebugBuild UP-TO-DATE
> Task :expo-splash-screen:writeDebugAarMetadata
> Task :expo-structured-headers:preBuild UP-TO-DATE
> Task :expo-structured-headers:preDebugBuild UP-TO-DATE
> Task :expo-structured-headers:writeDebugAarMetadata
> Task :expo-updates:preBuild UP-TO-DATE
> Task :expo-updates:preDebugBuild UP-TO-DATE
> Task :expo-updates:writeDebugAarMetadata
> Task :expo-updates-interface:preBuild UP-TO-DATE
> Task :expo-updates-interface:preDebugBuild UP-TO-DATE
> Task :expo-updates-interface:writeDebugAarMetadata
> Task :react-native-firebase_app:preBuild UP-TO-DATE
> Task :react-native-firebase_app:preDebugBuild UP-TO-DATE
> Task :react-native-firebase_app:writeDebugAarMetadata
> Task :react-native-firebase_auth:preBuild UP-TO-DATE
> Task :react-native-firebase_auth:preDebugBuild UP-TO-DATE
> Task :react-native-firebase_auth:writeDebugAarMetadata
> Task :react-native-firebase_firestore:preBuild UP-TO-DATE
> Task :react-native-firebase_firestore:preDebugBuild UP-TO-DATE
> Task :react-native-firebase_firestore:writeDebugAarMetadata
> Task :react-native-gesture-handler:preBuild UP-TO-DATE
> Task :react-native-gesture-handler:preDebugBuild UP-TO-DATE
> Task :react-native-gesture-handler:writeDebugAarMetadata
> Task :react-native-google-signin_google-signin:preBuild UP-TO-DATE
> Task :react-native-google-signin_google-signin:preDebugBuild UP-TO-DATE
> Task :react-native-google-signin_google-signin:writeDebugAarMetadata
> Task :react-native-mmkv:preBuild UP-TO-DATE
> Task :react-native-mmkv:preDebugBuild UP-TO-DATE
> Task :react-native-mmkv:writeDebugAarMetadata
> Task :react-native-reanimated:asEME9M9cSy9FvfHvcx2gMPkp1H5Dj4YaKufPRsAyon8Tf SKIPPED
> Task :react-native-reanimated:assertMinimalReactNativeVersionTask SKIPPED
> Task :react-native-reanimated:prepareReanimatedHeadersForPrefabs
> Task :react-native-reanimated:prepareWorkletsHeadersForPrefabs
> Task :react-native-reanimated:preBuild
> Task :react-native-reanimated:preDebugBuild
> Task :expo:generateExpoModulesPackageListTask
> Task :expo:preBuild
> Task :expo:preDebugBuild
> Task :react-native-reanimated:writeDebugAarMetadata
> Task :react-native-safe-area-context:preBuild UP-TO-DATE
> Task :react-native-safe-area-context:preDebugBuild UP-TO-DATE
> Task :expo:writeDebugAarMetadata
> Task :react-native-safe-area-context:writeDebugAarMetadata
> Task :react-native-screens:preBuild UP-TO-DATE
> Task :react-native-svg:preBuild UP-TO-DATE
> Task :react-native-screens:preDebugBuild UP-TO-DATE
> Task :react-native-svg:preDebugBuild UP-TO-DATE
> Task :react-native-screens:writeDebugAarMetadata
> Task :react-native-svg:writeDebugAarMetadata
> Task :expo:generateDebugResValues
> Task :expo:generateDebugResources
> Task :expo:packageDebugResources
> Task :expo-application:generateDebugResValues
> Task :expo-constants:createExpoConfig
> Task :expo-constants:preBuild
> Task :expo-constants:preDebugBuild
The NODE_ENV environment variable is required but was not specified. Ensure the project is bundled with Expo CLI or NODE_ENV is set.
Proceeding without mode-specific .env
> Task :expo-application:generateDebugResources
> Task :expo-application:packageDebugResources
> Task :expo-asset:generateDebugResValues
> Task :expo-asset:generateDebugResources
> Task :expo-asset:packageDebugResources
> Task :expo-constants:generateDebugResValues
> Task :expo-constants:generateDebugResources
> Task :expo-constants:packageDebugResources
> Task :expo-dev-client:generateDebugResValues
> Task :expo-dev-client:generateDebugResources
> Task :expo-dev-client:packageDebugResources
> Task :expo-dev-launcher:generateDebugResValues
> Task :expo-dev-launcher:generateDebugResources
> Task :shopify_react-native-skia:prepareHeaders
> Task :shopify_react-native-skia:preBuild
> Task :shopify_react-native-skia:preDebugBuild
> Task :expo-constants:writeDebugAarMetadata
> Task :expo-dev-menu:generateDebugResValues
> Task :expo-dev-menu:generateDebugResources
> Task :expo-dev-launcher:packageDebugResources
> Task :expo-dev-menu-interface:generateDebugResValues
> Task :expo-dev-menu-interface:generateDebugResources
> Task :expo-dev-menu-interface:packageDebugResources
> Task :expo-eas-client:generateDebugResValues
> Task :expo-eas-client:generateDebugResources
> Task :expo-eas-client:packageDebugResources
> Task :expo-file-system:generateDebugResValues
> Task :expo-dev-menu:packageDebugResources
> Task :expo-font:generateDebugResValues
> Task :expo-file-system:generateDebugResources
> Task :expo-font:generateDebugResources
> Task :expo-font:packageDebugResources
> Task :expo-file-system:packageDebugResources
> Task :expo-haptics:generateDebugResValues
> Task :expo-json-utils:generateDebugResValues
> Task :expo-json-utils:generateDebugResources
> Task :expo-haptics:generateDebugResources
> Task :expo-haptics:packageDebugResources
> Task :expo-json-utils:packageDebugResources
> Task :expo-keep-awake:generateDebugResValues
> Task :expo-linking:generateDebugResValues
> Task :expo-keep-awake:generateDebugResources
> Task :expo-linking:generateDebugResources
> Task :expo-keep-awake:packageDebugResources
> Task :expo-local-authentication:generateDebugResValues
> Task :expo-linking:packageDebugResources
> Task :expo-local-authentication:generateDebugResources
> Task :expo-localization:generateDebugResValues
> Task :expo-localization:generateDebugResources
> Task :expo-local-authentication:packageDebugResources
> Task :expo-manifests:generateDebugResValues
> Task :expo-localization:packageDebugResources
> Task :expo-manifests:generateDebugResources
> Task :expo-modules-core:generateDebugResValues
> Task :expo-modules-core:generateDebugResources
> Task :expo-manifests:packageDebugResources
> Task :expo-notifications:generateDebugResValues
> Task :expo-notifications:generateDebugResources
> Task :expo-modules-core:packageDebugResources
> Task :expo-sharing:generateDebugResValues
> Task :expo-notifications:packageDebugResources
> Task :expo-splash-screen:generateDebugResValues
> Task :expo-sharing:generateDebugResources
> Task :expo-splash-screen:generateDebugResources
> Task :expo-sharing:packageDebugResources
> Task :expo-structured-headers:generateDebugResValues
> Task :expo-structured-headers:generateDebugResources
> Task :expo-splash-screen:packageDebugResources
> Task :expo-updates:generateDebugResValues
> Task :expo-updates:generateDebugResources
> Task :expo-structured-headers:packageDebugResources
> Task :expo-updates-interface:generateDebugResValues
> Task :expo-updates-interface:generateDebugResources
> Task :expo-updates:packageDebugResources
> Task :react-native-firebase_app:generateDebugResValues
> Task :react-native-firebase_app:generateDebugResources
> Task :expo-updates-interface:packageDebugResources
> Task :react-native-firebase_auth:generateDebugResValues
> Task :react-native-firebase_auth:generateDebugResources
> Task :react-native-firebase_app:packageDebugResources
> Task :react-native-firebase_firestore:generateDebugResValues
> Task :react-native-firebase_firestore:generateDebugResources
> Task :react-native-firebase_auth:packageDebugResources
> Task :react-native-gesture-handler:generateDebugResValues
> Task :react-native-firebase_firestore:packageDebugResources
> Task :react-native-gesture-handler:generateDebugResources
> Task :react-native-google-signin_google-signin:generateDebugResValues
> Task :react-native-google-signin_google-signin:generateDebugResources
> Task :react-native-gesture-handler:packageDebugResources
> Task :react-native-mmkv:generateDebugResValues
> Task :react-native-mmkv:generateDebugResources
> Task :react-native-google-signin_google-signin:packageDebugResources
> Task :react-native-reanimated:generateDebugResValues
> Task :react-native-reanimated:generateDebugResources
> Task :react-native-mmkv:packageDebugResources
> Task :react-native-safe-area-context:generateDebugResValues
> Task :react-native-safe-area-context:generateDebugResources
> Task :react-native-reanimated:packageDebugResources
> Task :react-native-screens:generateDebugResValues
> Task :react-native-safe-area-context:packageDebugResources
> Task :react-native-svg:generateDebugResValues
> Task :react-native-screens:generateDebugResources
> Task :react-native-svg:generateDebugResources
> Task :react-native-screens:packageDebugResources
> Task :react-native-svg:packageDebugResources
> Task :shopify_react-native-skia:generateDebugResValues
> Task :expo:extractDeepLinksDebug
> Task :shopify_react-native-skia:generateDebugResources
> Task :shopify_react-native-skia:packageDebugResources
> Task :expo-application:extractDeepLinksDebug
> Task :shopify_react-native-skia:writeDebugAarMetadata
> Task :expo:processDebugManifest
> Task :expo-asset:extractDeepLinksDebug
> Task :expo-application:processDebugManifest
> Task :expo-constants:extractDeepLinksDebug
> Task :expo-constants:processDebugManifest
> Task :expo-dev-client:extractDeepLinksDebug
> Task :expo-asset:processDebugManifest
> Task :expo-dev-launcher:extractDeepLinksDebug
> Task :expo-dev-client:processDebugManifest
> Task :expo-dev-menu:extractDeepLinksDebug
> Task :expo-dev-launcher:processDebugManifest
> Task :expo-dev-menu-interface:extractDeepLinksDebug
> Task :expo-dev-menu:processDebugManifest
> Task :expo-eas-client:extractDeepLinksDebug
> Task :expo-eas-client:processDebugManifest
> Task :expo-file-system:extractDeepLinksDebug
> Task :expo-file-system:processDebugManifest
/home/expo/workingdir/build/node_modules/expo-file-system/android/src/main/AndroidManifest.xml:6:9-8:20 Warning:
	provider#expo.modules.filesystem.FileSystemFileProvider@android:authorities was tagged at AndroidManifest.xml:6 to replace other declarations but no other declaration present
> Task :expo-font:extractDeepLinksDebug
> Task :expo-dev-menu-interface:processDebugManifest
> Task :expo-haptics:extractDeepLinksDebug
> Task :expo-font:processDebugManifest
> Task :expo-json-utils:extractDeepLinksDebug
> Task :expo-json-utils:processDebugManifest
> Task :expo-keep-awake:extractDeepLinksDebug
> Task :expo-haptics:processDebugManifest
> Task :expo-linking:extractDeepLinksDebug
> Task :expo-linking:processDebugManifest
> Task :expo-local-authentication:extractDeepLinksDebug
> Task :expo-keep-awake:processDebugManifest
> Task :expo-localization:extractDeepLinksDebug
> Task :expo-localization:processDebugManifest
> Task :expo-manifests:extractDeepLinksDebug
> Task :expo-manifests:processDebugManifest
> Task :expo-modules-core:extractDeepLinksDebug
> Task :expo-modules-core:processDebugManifest
/home/expo/workingdir/build/node_modules/expo-modules-core/android/src/main/AndroidManifest.xml:8:9-11:45 Warning:
	meta-data#com.facebook.soloader.enabled@android:value was tagged at AndroidManifest.xml:8 to replace other declarations but no other declaration present
> Task :expo-notifications:extractDeepLinksDebug
> Task :expo-local-authentication:processDebugManifest
> Task :expo-notifications:processDebugManifest
> Task :expo-splash-screen:extractDeepLinksDebug
> Task :expo-sharing:extractDeepLinksDebug
> Task :expo-splash-screen:processDebugManifest
> Task :expo-sharing:processDebugManifest
> Task :expo-structured-headers:extractDeepLinksDebug
> Task :expo-updates:extractDeepLinksDebug
> Task :expo-updates:processDebugManifest
> Task :expo-structured-headers:processDebugManifest
> Task :expo-updates-interface:extractDeepLinksDebug
> Task :react-native-firebase_app:extractDeepLinksDebug
> Task :expo-updates-interface:processDebugManifest
> Task :react-native-firebase_app:processDebugManifest
package="io.invertase.firebase" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-firebase/app/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="io.invertase.firebase" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-firebase/app/android/src/main/AndroidManifest.xml.
> Task :react-native-firebase_auth:extractDeepLinksDebug
> Task :react-native-firebase_firestore:extractDeepLinksDebug
> Task :react-native-firebase_firestore:processDebugManifest
package="io.invertase.firebase.firestore" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-firebase/firestore/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="io.invertase.firebase.firestore" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-firebase/firestore/android/src/main/AndroidManifest.xml.
> Task :react-native-firebase_auth:processDebugManifest
package="io.invertase.firebase.auth" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-firebase/auth/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="io.invertase.firebase.auth" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-firebase/auth/android/src/main/AndroidManifest.xml.
> Task :react-native-gesture-handler:extractDeepLinksDebug
> Task :react-native-google-signin_google-signin:extractDeepLinksDebug
> Task :react-native-google-signin_google-signin:processDebugManifest
package="com.reactnativegooglesignin" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-google-signin/google-signin/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="com.reactnativegooglesignin" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@react-native-google-signin/google-signin/android/src/main/AndroidManifest.xml.
> Task :react-native-gesture-handler:processDebugManifest
> Task :react-native-mmkv:extractDeepLinksDebug
> Task :react-native-reanimated:extractDeepLinksDebug
> Task :react-native-mmkv:processDebugManifest
package="com.reactnativemmkv" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-mmkv/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="com.reactnativemmkv" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-mmkv/android/src/main/AndroidManifest.xml.
> Task :react-native-reanimated:processDebugManifest
> Task :react-native-safe-area-context:extractDeepLinksDebug
> Task :react-native-screens:extractDeepLinksDebug
> Task :react-native-safe-area-context:processDebugManifest
package="com.th3rdwave.safeareacontext" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-safe-area-context/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="com.th3rdwave.safeareacontext" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-safe-area-context/android/src/main/AndroidManifest.xml.
> Task :react-native-svg:extractDeepLinksDebug
> Task :react-native-screens:processDebugManifest
package="com.swmansion.rnscreens" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="com.swmansion.rnscreens" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/AndroidManifest.xml.
> Task :shopify_react-native-skia:extractDeepLinksDebug
> Task :react-native-svg:processDebugManifest
package="com.horcrux.svg" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-svg/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="com.horcrux.svg" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/react-native-svg/android/src/main/AndroidManifest.xml.
> Task :shopify_react-native-skia:processDebugManifest
package="com.shopify.reactnative.skia" found in source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/src/main/AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="com.shopify.reactnative.skia" from the source AndroidManifest.xml: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/src/main/AndroidManifest.xml.
> Task :expo-application:compileDebugLibraryResources
> Task :expo:compileDebugLibraryResources
> Task :expo:parseDebugLocalResources
> Task :expo-application:parseDebugLocalResources
> Task :expo-asset:compileDebugLibraryResources
> Task :expo:generateDebugRFile
> Task :expo-application:generateDebugRFile
> Task :expo-constants:compileDebugLibraryResources
> Task :expo-dev-client:compileDebugLibraryResources
> Task :expo-asset:parseDebugLocalResources
> Task :expo-constants:parseDebugLocalResources
> Task :expo-dev-client:parseDebugLocalResources
> Task :expo-constants:generateDebugRFile
> Task :expo-asset:generateDebugRFile
> Task :expo-dev-client:generateDebugRFile
> Task :expo-dev-launcher:parseDebugLocalResources
> Task :expo-dev-menu:compileDebugLibraryResources
> Task :expo-dev-launcher:compileDebugLibraryResources
> Task :expo-dev-menu-interface:compileDebugLibraryResources
> Task :expo-dev-launcher:generateDebugRFile
> Task :expo-eas-client:compileDebugLibraryResources
> Task :expo-dev-menu:parseDebugLocalResources
> Task :expo-dev-menu-interface:parseDebugLocalResources
> Task :expo-eas-client:parseDebugLocalResources
> Task :expo-dev-menu-interface:generateDebugRFile
> Task :expo-dev-menu:generateDebugRFile
> Task :expo-eas-client:generateDebugRFile
> Task :expo-file-system:compileDebugLibraryResources
> Task :expo-font:compileDebugLibraryResources
> Task :expo-file-system:parseDebugLocalResources
> Task :expo-haptics:compileDebugLibraryResources
> Task :expo-font:parseDebugLocalResources
> Task :expo-haptics:parseDebugLocalResources
> Task :expo-file-system:generateDebugRFile
> Task :expo-json-utils:compileDebugLibraryResources
> Task :expo-haptics:generateDebugRFile
> Task :expo-json-utils:parseDebugLocalResources
> Task :expo-font:generateDebugRFile
> Task :expo-keep-awake:compileDebugLibraryResources
> Task :expo-linking:compileDebugLibraryResources
> Task :expo-keep-awake:parseDebugLocalResources
> Task :expo-json-utils:generateDebugRFile
> Task :expo-linking:parseDebugLocalResources
> Task :expo-local-authentication:compileDebugLibraryResources
> Task :expo-keep-awake:generateDebugRFile
> Task :expo-linking:generateDebugRFile
> Task :expo-local-authentication:parseDebugLocalResources
> Task :expo-localization:compileDebugLibraryResources
> Task :expo-manifests:compileDebugLibraryResources
> Task :expo-localization:parseDebugLocalResources
> Task :expo-local-authentication:generateDebugRFile
> Task :expo-manifests:parseDebugLocalResources
> Task :expo-modules-core:compileDebugLibraryResources
> Task :expo-localization:generateDebugRFile
> Task :expo-modules-core:parseDebugLocalResources
> Task :expo-manifests:generateDebugRFile
> Task :expo-notifications:compileDebugLibraryResources
> Task :expo-modules-core:generateDebugRFile
> Task :expo-sharing:compileDebugLibraryResources
> Task :expo-notifications:parseDebugLocalResources
> Task :expo-splash-screen:compileDebugLibraryResources
> Task :expo-sharing:parseDebugLocalResources
> Task :expo-notifications:generateDebugRFile
> Task :expo-splash-screen:parseDebugLocalResources
> Task :expo-structured-headers:compileDebugLibraryResources
> Task :expo-splash-screen:generateDebugRFile
> Task :expo-updates:compileDebugLibraryResources
> Task :expo-sharing:generateDebugRFile
> Task :expo-structured-headers:parseDebugLocalResources
> Task :expo-updates:parseDebugLocalResources
> Task :expo-updates-interface:compileDebugLibraryResources
> Task :expo-updates:generateDebugRFile
> Task :expo-structured-headers:generateDebugRFile
> Task :expo-updates-interface:parseDebugLocalResources
> Task :expo-updates-interface:generateDebugRFile
> Task :react-native-firebase_auth:compileDebugLibraryResources
> Task :react-native-firebase_app:compileDebugLibraryResources
> Task :react-native-firebase_firestore:compileDebugLibraryResources
> Task :react-native-firebase_auth:parseDebugLocalResources
> Task :react-native-firebase_firestore:parseDebugLocalResources
> Task :react-native-firebase_app:parseDebugLocalResources
> Task :react-native-firebase_app:generateDebugRFile
> Task :react-native-firebase_auth:generateDebugRFile
> Task :react-native-firebase_firestore:generateDebugRFile
> Task :react-native-google-signin_google-signin:compileDebugLibraryResources
> Task :react-native-mmkv:compileDebugLibraryResources
> Task :react-native-google-signin_google-signin:parseDebugLocalResources
> Task :react-native-gesture-handler:compileDebugLibraryResources
> Task :react-native-gesture-handler:parseDebugLocalResources
> Task :react-native-mmkv:parseDebugLocalResources
> Task :react-native-google-signin_google-signin:generateDebugRFile
> Task :react-native-gesture-handler:generateDebugRFile
> Task :react-native-mmkv:generateDebugRFile
> Task :react-native-reanimated:compileDebugLibraryResources
> Task :react-native-safe-area-context:compileDebugLibraryResources
> Task :react-native-reanimated:parseDebugLocalResources
> Task :react-native-safe-area-context:parseDebugLocalResources
> Task :react-native-reanimated:generateDebugRFile
> Task :react-native-safe-area-context:generateDebugRFile
> Task :react-native-screens:parseDebugLocalResources
> Task :react-native-svg:compileDebugLibraryResources
> Task :react-native-svg:parseDebugLocalResources
> Task :react-native-screens:generateDebugRFile
> Task :react-native-screens:compileDebugLibraryResources
> Task :expo:checkKotlinGradlePluginConfigurationErrors
> Task :shopify_react-native-skia:compileDebugLibraryResources
> Task :react-native-svg:generateDebugRFile
> Task :expo-application:checkKotlinGradlePluginConfigurationErrors
> Task :shopify_react-native-skia:parseDebugLocalResources
> Task :expo:generateDebugBuildConfig
> Task :expo-application:generateDebugBuildConfig
> Task :expo-modules-core:checkKotlinGradlePluginConfigurationErrors
> Task :shopify_react-native-skia:generateDebugRFile
> Task :expo-asset:checkKotlinGradlePluginConfigurationErrors
> Task :expo-asset:generateDebugBuildConfig
> Task :expo-modules-core:generateDebugBuildConfig
> Task :expo-asset:javaPreCompileDebug
> Task :expo-constants:checkKotlinGradlePluginConfigurationErrors
> Task :expo-application:javaPreCompileDebug
> Task :expo-dev-client:checkKotlinGradlePluginConfigurationErrors
> Task :expo-constants:generateDebugBuildConfig
> Task :expo-constants:javaPreCompileDebug
> Task :expo-dev-launcher:checkKotlinGradlePluginConfigurationErrors
> Task :app:generateAutolinkingPackageList
> Task :app:generateCodegenSchemaFromJavaScript SKIPPED
> Task :app:generateCodegenArtifactsFromSchema SKIPPED
> Task :app:preBuild
> Task :app:preDebugBuild
> Task :app:mer9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8 NO-SOURCE
> Task :app:checkKotlinGradlePluginConfigurationErrors
> Task :app:generateDebugBuildConfig
> Task :expo-dev-client:dataBindingMergeDependencyArtifactsDebug
> Task :expo-modules-core:javaPreCompileDebug
> Task :expo-dev-launcher:dataBindingMergeDependencyArtifactsDebug
> Task :app:checkDebugAarMetadata
> Task :expo-dev-client:dataBindingGenBaseClassesDebug
> Task :app:generateDebugResValues
> Task :expo-dev-client:generateDebugBuildConfig
> Task :expo-dev-client:javaPreCompileDebug
> Task :expo-dev-menu:checkKotlinGradlePluginConfigurationErrors
> Task :app:processDebugGoogleServices
> Task :expo-dev-menu:generateDebugBuildConfig
> Task :expo-dev-menu-interface:checkKotlinGradlePluginConfigurationErrors
> Task :expo-dev-menu-interface:generateDebugBuildConfig
> Task :expo-dev-launcher:dataBindingGenBaseClassesDebug
> Task :expo-dev-launcher:generateDebugBuildConfig
> Task :expo-json-utils:checkKotlinGradlePluginConfigurationErrors
> Task :expo-json-utils:generateDebugBuildConfig
> Task :expo-json-utils:javaPreCompileDebug
> Task :expo-manifests:checkKotlinGradlePluginConfigurationErrors
> Task :expo-manifests:generateDebugBuildConfig
> Task :expo-dev-menu-interface:javaPreCompileDebug
> Task :expo-manifests:javaPreCompileDebug
> Task :expo-updates-interface:checkKotlinGradlePluginConfigurationErrors
> Task :expo-dev-menu:javaPreCompileDebug
> Task :expo-dev-launcher:javaPreCompileDebug
> Task :expo-eas-client:checkKotlinGradlePluginConfigurationErrors
> Task :expo-updates-interface:generateDebugBuildConfig
> Task :expo-eas-client:generateDebugBuildConfig
> Task :expo-updates-interface:javaPreCompileDebug
> Task :expo-file-system:checkKotlinGradlePluginConfigurationErrors
> Task :expo-eas-client:javaPreCompileDebug
> Task :expo-font:checkKotlinGradlePluginConfigurationErrors
> Task :expo-file-system:generateDebugBuildConfig
> Task :expo-file-system:javaPreCompileDebug
> Task :expo-font:generateDebugBuildConfig
> Task :app:mapDebugSourceSetPaths
> Task :expo-haptics:checkKotlinGradlePluginConfigurationErrors
> Task :expo-font:javaPreCompileDebug
> Task :expo-keep-awake:checkKotlinGradlePluginConfigurationErrors
> Task :app:generateDebugResources
> Task :expo-haptics:generateDebugBuildConfig
> Task :expo-keep-awake:generateDebugBuildConfig
> Task :expo-keep-awake:javaPreCompileDebug
> Task :expo-linking:checkKotlinGradlePluginConfigurationErrors
> Task :expo-haptics:javaPreCompileDebug
> Task :expo-local-authentication:checkKotlinGradlePluginConfigurationErrors
> Task :expo-linking:generateDebugBuildConfig
> Task :expo-local-authentication:generateDebugBuildConfig
> Task :expo-linking:javaPreCompileDebug
> Task :expo-local-authentication:javaPreCompileDebug
> Task :expo-notifications:checkKotlinGradlePluginConfigurationErrors
> Task :expo-localization:checkKotlinGradlePluginConfigurationErrors
> Task :expo-localization:generateDebugBuildConfig
> Task :expo-notifications:generateDebugBuildConfig
> Task :expo-localization:javaPreCompileDebug
> Task :expo-sharing:checkKotlinGradlePluginConfigurationErrors
> Task :expo-sharing:generateDebugBuildConfig
> Task :expo-notifications:javaPreCompileDebug
> Task :expo-splash-screen:checkKotlinGradlePluginConfigurationErrors
> Task :expo-sharing:javaPreCompileDebug
> Task :expo-structured-headers:checkKotlinGradlePluginConfigurationErrors
> Task :expo-splash-screen:generateDebugBuildConfig
> Task :expo-structured-headers:generateDebugBuildConfig
> Task :expo-splash-screen:javaPreCompileDebug
> Task :expo-updates:checkKotlinGradlePluginConfigurationErrors
> Task :expo-structured-headers:javaPreCompileDebug
> Task :expo-updates:generateDebugBuildConfig
> Task :expo:javaPreCompileDebug
> Task :react-native-firebase_app:generateDebugBuildConfig
> Task :react-native-firebase_app:javaPreCompileDebug
> Task :expo-updates:javaPreCompileDebug
> Task :react-native-firebase_auth:generateDebugBuildConfig
> Task :react-native-firebase_auth:javaPreCompileDebug
> Task :react-native-firebase_firestore:generateDebugBuildConfig
> Task :react-native-firebase_firestore:javaPreCompileDebug
> Task :react-native-gesture-handler:checkKotlinGradlePluginConfigurationErrors
> Task :react-native-gesture-handler:generateDebugBuildConfig
> Task :react-native-reanimated:generateDebugBuildConfig
> Task :react-native-reanimated:javaPreCompileDebug
> Task :react-native-reanimated:packageNdkLibs NO-SOURCE
> Task :app:mergeDebugResources
> Task :app:packageDebugResources
> Task :app:parseDebugLocalResources
> Task :app:createDebugCompatibleScreenManifests
> Task :app:extractDeepLinksDebug
> Task :app:processDebugMainManifest
/home/expo/workingdir/build/apps/mobile/android/app/src/debug/AndroidManifest.xml:6:5-162 Warning:
	application@android:usesCleartextTraffic was tagged at AndroidManifest.xml:6 to replace other declarations but no other declaration present
/home/expo/workingdir/build/apps/mobile/android/app/src/debug/AndroidManifest.xml Warning:
provider#expo.modules.filesystem.FileSystemFileProvider@android:authorities was tagged at AndroidManifest.xml:0 to replace other declarations but no other declaration present
> Task :app:processDebugManifest
> Task :app:processDebugManifestForPackage
> Task :react-native-firebase_app:compileDebugJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
> Task :react-native-reanimated:compileDebugJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: Some input files use unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.
> Task :react-native-reanimated:bundleLibCompileToJarDebug
> Task :react-native-firebase_app:bundleLibCompileToJarDebug
> Task :expo-modules-core:compileDebugKotlin
> Task :app:processDebugResources
> Task :react-native-firebase_auth:compileDebugJavaWithJavac
Note: /home/expo/workingdir/build/node_modules/@react-native-firebase/auth/android/src/main/java/io/invertase/firebase/auth/ReactNativeFirebaseAuthModule.java uses or overrides a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: /home/expo/workingdir/build/node_modules/@react-native-firebase/auth/android/src/main/java/io/invertase/firebase/auth/ReactNativeFirebaseAuthModule.java uses unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.
> Task :react-native-firebase_auth:bundleLibCompileToJarDebug
> Task :react-native-gesture-handler:javaPreCompileDebug
> Task :react-native-google-signin_google-signin:checkKotlinGradlePluginConfigurationErrors
> Task :react-native-google-signin_google-signin:generateDebugBuildConfig
> Task :react-native-firebase_firestore:compileDebugJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: Some input files use unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.
> Task :react-native-google-signin_google-signin:compileDebugKotlin
> Task :react-native-google-signin_google-signin:javaPreCompileDebug
> Task :react-native-firebase_firestore:bundleLibCompileToJarDebug
> Task :react-native-mmkv:generateDebugBuildConfig
> Task :react-native-mmkv:javaPreCompileDebug
> Task :react-native-mmkv:compileDebugJavaWithJavac
> Task :react-native-mmkv:bundleLibCompileToJarDebug
> Task :react-native-safe-area-context:checkKotlinGradlePluginConfigurationErrors
> Task :react-native-safe-area-context:generateDebugBuildConfig
> Task :react-native-google-signin_google-signin:compileDebugJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: /home/expo/workingdir/build/node_modules/@react-native-google-signin/google-signin/android/src/main/java/com/reactnativegooglesignin/RNGoogleSigninModule.java uses unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.
> Task :react-native-google-signin_google-signin:bundleLibCompileToJarDebug
> Task :react-native-safe-area-context:javaPreCompileDebug
> Task :react-native-screens:checkKotlinGradlePluginConfigurationErrors
> Task :react-native-screens:generateDebugBuildConfig
> Task :react-native-safe-area-context:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaContextPackage.kt:27:11 'constructor ReactModuleInfo(String, String, Boolean, Boolean, Boolean, Boolean, Boolean)' is deprecated. use ReactModuleInfo(String, String, boolean, boolean, boolean, boolean)]
w: file:///home/expo/workingdir/build/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaContextPackage.kt:33:27 'getter for hasConstants: Boolean' is deprecated. This property is unused and it's planning to be removed in a future version of
        React Native. Please refrain from using it.
w: file:///home/expo/workingdir/build/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaView.kt:59:23 'getter for uiImplementation: UIImplementation!' is deprecated. Deprecated in Java
> Task :react-native-safe-area-context:compileDebugJavaWithJavac
> Task :react-native-safe-area-context:bundleLibCompileToJarDebug
Note: /home/expo/workingdir/build/node_modules/react-native-safe-area-context/android/src/paper/java/com/th3rdwave/safeareacontext/NativeSafeAreaContextSpec.java uses or overrides a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
> Task :react-native-screens:javaPreCompileDebug
> Task :react-native-svg:generateDebugBuildConfig
> Task :react-native-svg:javaPreCompileDebug
> Task :react-native-svg:compileDebugJavaWithJavac
/home/expo/workingdir/build/node_modules/react-native-svg/android/src/main/java/com/horcrux/svg/RenderableViewManager.java:388: warning: [removal] processTransform(ReadableArray,double[]) in TransformHelper has been deprecated and marked for removal
    TransformHelper.processTransform(transforms, sTransformDecompositionArray);
                   ^
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: Some input files use unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.
1 warning
> Task :react-native-svg:bundleLibCompileToJarDebug
> Task :shopify_react-native-skia:generateDebugBuildConfig
> Task :shopify_react-native-skia:javaPreCompileDebug
> Task :shopify_react-native-skia:compileDebugJavaWithJavac
> Task :shopify_react-native-skia:bundleLibCompileToJarDebug
> Task :app:javaPreCompileDebug
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: Some input files use unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.
> Task :app:mergeDebugShaders
> Task :app:compileDebugShaders NO-SOURCE
> Task :app:cr9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8
> Task :app:generateDebugAssets UP-TO-DATE
> Task :expo:mergeDebugShaders
> Task :expo:compileDebugShaders NO-SOURCE
> Task :expo:generateDebugAssets UP-TO-DATE
> Task :expo:packageDebugAssets
> Task :expo-application:mergeDebugShaders
> Task :expo-application:compileDebugShaders NO-SOURCE
> Task :expo-application:generateDebugAssets UP-TO-DATE
> Task :expo-application:packageDebugAssets
> Task :expo-asset:mergeDebugShaders
> Task :expo-asset:compileDebugShaders NO-SOURCE
> Task :expo-asset:generateDebugAssets UP-TO-DATE
> Task :expo-asset:packageDebugAssets
> Task :expo-constants:mergeDebugShaders
> Task :expo-constants:compileDebugShaders NO-SOURCE
> Task :expo-constants:generateDebugAssets UP-TO-DATE
> Task :expo-constants:packageDebugAssets
> Task :expo-dev-client:mergeDebugShaders
> Task :expo-dev-client:compileDebugShaders NO-SOURCE
> Task :expo-dev-client:generateDebugAssets UP-TO-DATE
> Task :expo-dev-client:packageDebugAssets
> Task :expo-dev-launcher:mergeDebugShaders
> Task :expo-dev-launcher:compileDebugShaders NO-SOURCE
> Task :expo-dev-launcher:generateDebugAssets UP-TO-DATE
> Task :expo-dev-launcher:packageDebugAssets
> Task :expo-dev-menu:mergeDebugShaders
> Task :expo-dev-menu:compileDebugShaders NO-SOURCE
> Task :expo-dev-menu:clenupAssets UP-TO-DATE
> Task :expo-dev-menu:copyAssets
> Task :expo-dev-menu:generateDebugAssets UP-TO-DATE
> Task :expo-dev-menu:packageDebugAssets
> Task :expo-dev-menu-interface:mergeDebugShaders
> Task :expo-dev-menu-interface:compileDebugShaders NO-SOURCE
> Task :expo-dev-menu-interface:generateDebugAssets UP-TO-DATE
> Task :expo-dev-menu-interface:packageDebugAssets
> Task :expo-eas-client:mergeDebugShaders
> Task :expo-eas-client:compileDebugShaders NO-SOURCE
> Task :expo-eas-client:generateDebugAssets UP-TO-DATE
> Task :expo-eas-client:packageDebugAssets
> Task :expo-file-system:mergeDebugShaders
> Task :expo-file-system:compileDebugShaders NO-SOURCE
> Task :expo-file-system:generateDebugAssets UP-TO-DATE
> Task :expo-file-system:packageDebugAssets
> Task :expo-font:mergeDebugShaders
> Task :expo-font:compileDebugShaders NO-SOURCE
> Task :expo-font:generateDebugAssets UP-TO-DATE
> Task :expo-font:packageDebugAssets
> Task :expo-haptics:mergeDebugShaders
> Task :expo-haptics:compileDebugShaders NO-SOURCE
> Task :expo-haptics:generateDebugAssets UP-TO-DATE
> Task :expo-haptics:packageDebugAssets
> Task :expo-json-utils:mergeDebugShaders
> Task :expo-json-utils:compileDebugShaders NO-SOURCE
> Task :expo-json-utils:generateDebugAssets UP-TO-DATE
> Task :expo-json-utils:packageDebugAssets
> Task :expo-keep-awake:mergeDebugShaders
> Task :expo-keep-awake:compileDebugShaders NO-SOURCE
> Task :expo-keep-awake:generateDebugAssets UP-TO-DATE
> Task :expo-keep-awake:packageDebugAssets
> Task :expo-linking:mergeDebugShaders
> Task :expo-linking:compileDebugShaders NO-SOURCE
> Task :expo-linking:generateDebugAssets UP-TO-DATE
> Task :expo-linking:packageDebugAssets
> Task :expo-local-authentication:mergeDebugShaders
> Task :expo-local-authentication:compileDebugShaders NO-SOURCE
> Task :expo-local-authentication:generateDebugAssets UP-TO-DATE
> Task :expo-local-authentication:packageDebugAssets
> Task :expo-localization:mergeDebugShaders
> Task :expo-localization:compileDebugShaders NO-SOURCE
> Task :expo-localization:generateDebugAssets UP-TO-DATE
> Task :expo-localization:packageDebugAssets
> Task :expo-manifests:mergeDebugShaders
> Task :expo-manifests:compileDebugShaders NO-SOURCE
> Task :expo-manifests:generateDebugAssets UP-TO-DATE
> Task :expo-manifests:packageDebugAssets
> Task :expo-modules-core:mergeDebugShaders
> Task :expo-modules-core:compileDebugShaders NO-SOURCE
> Task :expo-modules-core:generateDebugAssets UP-TO-DATE
> Task :expo-modules-core:packageDebugAssets
> Task :expo-notifications:mergeDebugShaders
> Task :expo-notifications:compileDebugShaders NO-SOURCE
> Task :expo-notifications:generateDebugAssets UP-TO-DATE
> Task :expo-notifications:packageDebugAssets
> Task :expo-sharing:mergeDebugShaders
> Task :expo-sharing:compileDebugShaders NO-SOURCE
> Task :expo-sharing:generateDebugAssets UP-TO-DATE
> Task :expo-sharing:packageDebugAssets
> Task :expo-splash-screen:mergeDebugShaders
> Task :expo-splash-screen:compileDebugShaders NO-SOURCE
> Task :expo-splash-screen:generateDebugAssets UP-TO-DATE
> Task :expo-splash-screen:packageDebugAssets
> Task :expo-structured-headers:mergeDebugShaders
> Task :expo-structured-headers:compileDebugShaders NO-SOURCE
> Task :expo-structured-headers:generateDebugAssets UP-TO-DATE
> Task :expo-structured-headers:packageDebugAssets
> Task :expo-updates:mergeDebugShaders
> Task :expo-updates:compileDebugShaders NO-SOURCE
> Task :expo-updates:generateDebugAssets UP-TO-DATE
> Task :expo-updates:packageDebugAssets
> Task :expo-updates-interface:mergeDebugShaders
> Task :expo-updates-interface:compileDebugShaders NO-SOURCE
> Task :expo-updates-interface:generateDebugAssets UP-TO-DATE
> Task :expo-updates-interface:packageDebugAssets
> Task :react-native-firebase_app:mergeDebugShaders
> Task :react-native-firebase_app:compileDebugShaders NO-SOURCE
> Task :react-native-firebase_app:generateDebugAssets UP-TO-DATE
> Task :react-native-firebase_app:packageDebugAssets
> Task :react-native-firebase_auth:mergeDebugShaders
> Task :react-native-firebase_auth:compileDebugShaders NO-SOURCE
> Task :react-native-firebase_auth:generateDebugAssets UP-TO-DATE
> Task :react-native-firebase_auth:packageDebugAssets
> Task :react-native-firebase_firestore:mergeDebugShaders
> Task :react-native-firebase_firestore:compileDebugShaders NO-SOURCE
> Task :react-native-firebase_firestore:generateDebugAssets
UP-TO-DATE
> Task :react-native-firebase_firestore:packageDebugAssets
> Task :react-native-gesture-handler:mergeDebugShaders
> Task :react-native-gesture-handler:compileDebugShaders NO-SOURCE
> Task :react-native-gesture-handler:generateDebugAssets UP-TO-DATE
> Task :react-native-gesture-handler:packageDebugAssets
> Task :react-native-google-signin_google-signin:mergeDebugShaders
> Task :react-native-google-signin_google-signin:compileDebugShaders NO-SOURCE
> Task :react-native-google-signin_google-signin:generateDebugAssets UP-TO-DATE
> Task :react-native-google-signin_google-signin:packageDebugAssets
> Task :react-native-mmkv:mergeDebugShaders
> Task :react-native-mmkv:compileDebugShaders NO-SOURCE
> Task :react-native-mmkv:generateDebugAssets UP-TO-DATE
> Task :react-native-mmkv:packageDebugAssets
> Task :react-native-reanimated:mergeDebugShaders
> Task :react-native-reanimated:compileDebugShaders NO-SOURCE
> Task :react-native-reanimated:generateDebugAssets UP-TO-DATE
> Task :react-native-reanimated:packageDebugAssets
> Task :react-native-safe-area-context:mergeDebugShaders
> Task :react-native-safe-area-context:compileDebugShaders NO-SOURCE
> Task :react-native-safe-area-context:generateDebugAssets UP-TO-DATE
> Task :react-native-safe-area-context:packageDebugAssets
> Task :react-native-screens:mergeDebugShaders
> Task :react-native-screens:compileDebugShaders NO-SOURCE
> Task :react-native-screens:generateDebugAssets UP-TO-DATE
> Task :react-native-screens:packageDebugAssets
> Task :react-native-svg:mergeDebugShaders
> Task :react-native-svg:compileDebugShaders NO-SOURCE
> Task :react-native-svg:generateDebugAssets UP-TO-DATE
> Task :react-native-svg:packageDebugAssets
> Task :shopify_react-native-skia:mergeDebugShaders
> Task :shopify_react-native-skia:compileDebugShaders NO-SOURCE
> Task :shopify_react-native-skia:generateDebugAssets UP-TO-DATE
> Task :shopify_react-native-skia:packageDebugAssets
> Task :app:mergeDebugAssets
> Task :app:compressDebugAssets
> Task :react-native-safe-area-context:bundleLibRuntimeToJarDebug
> Task :react-native-gesture-handler:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/RNGestureHandlerPackage.kt:69:42 'constructor ReactModuleInfo(String, String, Boolean, Boolean, Boolean, Boolean, Boolean)' is deprecated. use ReactModuleInfo(String, String, boolean, boolean, boolean, boolean)]
w: file:///home/expo/workingdir/build/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/FlingGestureHandler.kt:25:26 Parameter 'event' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt:72:62 The corresponding parameter in the supertype 'ViewGroupManager' is named 'borderRadius'. This may cause problems when calling this function with named arguments.
w: file:///home/expo/workingdir/build/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt:77:63 The corresponding parameter in the supertype 'ViewGroupManager' is named 'borderRadius'. This may cause problems when calling this function with named arguments.
w: file:///home/expo/workingdir/build/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt:82:65 The corresponding parameter in the supertype 'ViewGroupManager' is named 'borderRadius'. This may cause problems when calling this function with named arguments.
w: file:///home/expo/workingdir/build/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt:87:66 The corresponding parameter in the supertype 'ViewGroupManager' is named 'borderRadius'. This may cause problems when calling this function with named arguments.
> Task :react-native-gesture-handler:compileDebugJavaWithJavac
> Task :react-native-gesture-handler:bundleLibCompileToJarDebug
> Task :react-native-google-signin_google-signin:bundleLibRuntimeToJarDebug
Note: /home/expo/workingdir/build/node_modules/react-native-gesture-handler/android/paper/src/main/java/com/swmansion/gesturehandler/NativeRNGestureHandlerModuleSpec.java uses or overrides a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
> Task :react-native-gesture-handler:bundleLibRuntimeToJarDebug
> Task :react-native-reanimated:bundleLibRuntimeToJarDebug
> Task :react-native-firebase_auth:bundleLibRuntimeToJarDebug
> Task :react-native-firebase_app:bundleLibRuntimeToJarDebug
> Task :react-native-firebase_firestore:bundleLibRuntimeToJarDebug
> Task :react-native-mmkv:bundleLibRuntimeToJarDebug
> Task :react-native-svg:bundleLibRuntimeToJarDebug
> Task :shopify_react-native-skia:bundleLibRuntimeToJarDebug
> Task :app:desugarDebugFileDependencies
> Task :react-native-firebase_app:processDebugJavaRes NO-SOURCE
> Task :react-native-firebase_auth:processDebugJavaRes NO-SOURCE
> Task :react-native-firebase_firestore:processDebugJavaRes NO-SOURCE
> Task :react-native-gesture-handler:processDebugJavaRes
> Task :react-native-google-signin_google-signin:processDebugJavaRes
> Task :react-native-mmkv:processDebugJavaRes NO-SOURCE
> Task :react-native-reanimated:processDebugJavaRes NO-SOURCE
> Task :react-native-safe-area-context:processDebugJavaRes
> Task :react-native-svg:processDebugJavaRes NO-SOURCE
> Task :shopify_react-native-skia:processDebugJavaRes NO-SOURCE
> Task :react-native-screens:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/CustomToolbar.kt:19:53 'FrameCallback' is deprecated. Use Choreographer.FrameCallback instead
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/CustomToolbar.kt:20:38 'FrameCallback' is deprecated. Use Choreographer.FrameCallback instead
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/RNScreensPackage.kt:64:17 'constructor ReactModuleInfo(String, String, Boolean, Boolean, Boolean, Boolean, Boolean)' is deprecated. use ReactModuleInfo(String, String, boolean, boolean, boolean, boolean)]
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/Screen.kt:45:77 Unchecked cast: CoordinatorLayout.Behavior<(raw) View!>? to BottomSheetBehavior<Screen>
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenContainer.kt:33:53 'FrameCallback' is deprecated. Use Choreographer.FrameCallback instead
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenContainer.kt:34:38 'FrameCallback' is deprecated. Use Choreographer.FrameCallback instead
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFooter.kt:252:9 Parameter 'changed' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFooter.kt:253:9 Parameter 'left' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFooter.kt:254:9 Parameter 'top' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFooter.kt:255:9 Parameter 'right' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFooter.kt:256:9 Parameter 'bottom' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:257:31 'setter for targetElevation: Float' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:260:13 'setHasOptionsMenu(Boolean): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:496:22 'onPrepareOptionsMenu(Menu): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:504:22 'onCreateOptionsMenu(Menu, MenuInflater): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfig.kt:100:38 'getter for systemWindowInsetTop: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfigViewManager.kt:7:34 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfigViewManager.kt:209:9 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfigViewManager.kt:211:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfigViewManager.kt:213:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:7:34 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:375:48 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:376:49 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:377:45 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:378:52 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:379:48 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:380:51 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:381:56 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:382:57 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenViewManager.kt:383:51 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:55:42 'replaceSystemWindowInsets(Int, Int, Int, Int): WindowInsetsCompat' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:56:39 'getter for systemWindowInsetLeft: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:58:39 'getter for systemWindowInsetRight: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:59:39 'getter for systemWindowInsetBottom: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:98:53 'getter for statusBarColor: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:109:48 'getter for statusBarColor: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:112:32 'setter for statusBarColor: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:208:72 'getter for navigationBarColor: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:214:16 'setter for navigationBarColor: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:5:34 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:138:66 Elvis operator (?:) always returns the left operand of non-nullable type Boolean
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:142:9 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:144:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:146:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:148:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:150:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:152:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarManager.kt:154:13 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarView.kt:153:43 Parameter 'flag' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:7:34 'ReactFeatureFlags' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:25:13 'ReactFeatureFlags' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/FabricEnabledHeaderConfigViewGroup.kt:17:25 Parameter 'wrapper' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/FabricEnabledViewGroup.kt:10:25 Parameter 'wrapper' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/FabricEnabledViewGroup.kt:13:9 Parameter 'width' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/FabricEnabledViewGroup.kt:14:9 Parameter 'height' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/FabricEnabledViewGroup.kt:15:9 Parameter 'headerHeight' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/NativeProxy.kt:7:36 Parameter 'fabricUIManager' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/NativeProxy.kt:11:13 Parameter 'tag' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/NativeProxy.kt:12:13 Parameter 'view' is never used
w: file:///home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/NativeProxy.kt:15:33 Parameter 'tag' is never used
> Task :app:checkDebugDuplicateClasses
> Task :expo:mergeDebugJniLibFolders
> Task :expo:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-screens:compileDebugJavaWithJavac
Note: /home/expo/workingdir/build/node_modules/react-native-screens/android/src/paper/java/com/swmansion/rnscreens/NativeScreensModuleSpec.java uses or overrides a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
> Task :expo-modules-core:compileDebugJavaWithJavac
> Task :react-native-screens:bundleLibCompileToJarDebug
> Task :expo-modules-core:bundleLibCompileToJarDebug
> Task :app:mergeExtDexDebug
> Task :expo:copyDebugJniLibsProjectOnly
> Task :expo-modules-core:bundleLibRuntimeToJarDebug
> Task :expo-application:compileDebugKotlin
> Task :expo-asset:compileDebugKotlin
> Task :expo-asset:compileDebugJavaWithJavac
> Task :expo-constants:compileDebugKotlin
> Task :expo-asset:bundleLibCompileToJarDebug
> Task :expo-dev-client:compileDebugKotlin NO-SOURCE
> Task :expo-dev-client:compileDebugJavaWithJavac
> Task :expo-dev-client:bundleLibCompileToJarDebug
> Task :expo-constants:compileDebugJavaWithJavac
> Task :expo-constants:bundleLibCompileToJarDebug
> Task :expo-application:compileDebugJavaWithJavac
> Task :expo-application:bundleLibCompileToJarDebug
> Task :expo-json-utils:compileDebugKotlin
> Task :expo-json-utils:compileDebugJavaWithJavac
> Task :expo-json-utils:bundleLibCompileToJarDebug
> Task :expo-updates-interface:compileDebugKotlin
> Task :expo-dev-menu-interface:compileDebugKotlin
> Task :expo-updates-interface:compileDebugJavaWithJavac
> Task :expo-updates-interface:bundleLibCompileToJarDebug
> Task :expo-dev-menu-interface:compileDebugJavaWithJavac
> Task :expo-dev-menu-interface:bundleLibCompileToJarDebug
> Task :expo-eas-client:compileDebugKotlin
> Task :expo-eas-client:compileDebugJavaWithJavac
> Task :expo-eas-client:bundleLibCompileToJarDebug
> Task :expo-manifests:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo-manifests/android/src/main/java/expo/modules/manifests/core/EmbeddedManifest.kt:19:16 This declaration overrides deprecated member but not marked as deprecated itself. Please add @Deprecated annotation or suppress. See https://youtrack.jetbrains.com/issue/KT-47902 for details
w: file:///home/expo/workingdir/build/node_modules/expo-manifests/android/src/main/java/expo/modules/manifests/core/EmbeddedManifest.kt:19:86 'getLegacyID(): String' is deprecated. Prefer scopeKey or projectId depending on use case
w: file:///home/expo/workingdir/build/node_modules/expo-manifests/android/src/main/java/expo/modules/manifests/core/ExpoUpdatesManifest.kt:16:16 This declaration overrides deprecated member but not marked as deprecated itself. Please add @Deprecated annotation or suppress. See https://youtrack.jetbrains.com/issue/KT-47902 for details
w: file:///home/expo/workingdir/build/node_modules/expo-manifests/android/src/main/java/expo/modules/manifests/core/Manifest.kt:15:12 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
> Task :expo-manifests:compileDebugJavaWithJavac
> Task :expo-manifests:bundleLibCompileToJarDebug
> Task :expo-font:compileDebugKotlin
> Task :expo-font:compileDebugJavaWithJavac
> Task :expo-font:bundleLibCompileToJarDebug
> Task :expo-haptics:compileDebugKotlin
> Task :expo-haptics:compileDebugJavaWithJavac
> Task :expo-haptics:bundleLibCompileToJarDebug
> Task :expo-keep-awake:compileDebugKotlin
> Task :expo-keep-awake:compileDebugJavaWithJavac
> Task :expo-keep-awake:bundleLibCompileToJarDebug
> Task :expo-linking:compileDebugKotlin
> Task :expo-linking:compileDebugJavaWithJavac
> Task :expo-linking:bundleLibCompileToJarDebug
> Task :expo-local-authentication:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo-local-authentication/android/src/main/java/expo/modules/localauthentication/LocalAuthenticationModule.kt:130:19 'onActivityResult(Int, Int, Intent?): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-local-authentication/android/src/main/java/expo/modules/localauthentication/LocalAuthenticationModule.kt:258:60 'createConfirmDeviceCredentialIntent(CharSequence!, CharSequence!): Intent!' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-local-authentication/android/src/main/java/expo/modules/localauthentication/LocalAuthenticationModule.kt:259:26 'startActivityForResult(Intent, Int): Unit' is deprecated. Deprecated in Java
> Task :expo-local-authentication:compileDebugJavaWithJavac
> Task :expo-local-authentication:bundleLibCompileToJarDebug
> Task :expo-file-system:compileDebugKotlin
> Task :expo-file-system:compileDebugJavaWithJavac
> Task :expo-file-system:bundleLibCompileToJarDebug
> Task :expo-localization:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo-localization/android/src/main/java/expo/modules/localization/LocalizationModule.kt:240:16 'get(String!): Any?' is deprecated. Deprecated in Java
> Task :expo-localization:compileDebugJavaWithJavac
> Task :expo-localization:bundleLibCompileToJarDebug
> Task :expo-sharing:compileDebugKotlin
> Task :expo-dev-menu:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/DevMenuManager.kt:18:38 'ReactFontManager' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/DevMenuManager.kt:205:7 'ReactFontManager' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/DevMenuManager.kt:429:43 The corresponding parameter in the supertype 'DevMenuManagerInterface' is named 'shouldAutoLaunch'. This may cause problems when calling this function with named arguments.
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/main/java/com/facebook/react/devsupport/DevMenuSettingsBase.kt:6:27 'PreferenceManager' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/main/java/com/facebook/react/devsupport/DevMenuSettingsBase.kt:18:51 'PreferenceManager' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/main/java/com/facebook/react/devsupport/DevMenuSettingsBase.kt:18:69 'getDefaultSharedPreferences(Context!): SharedPreferences!' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/main/java/com/facebook/react/devsupport/DevMenuSettingsBase.kt:56:16 This declaration overrides deprecated member but not marked as deprecated itself. Please add @Deprecated annotation or suppress. See https://youtrack.jetbrains.com/issue/KT-47902 for details
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/main/java/expo/modules/devmenu/fab/MovableFloatingActionButton.kt:173:17 'computeBounds(RectF, Boolean): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/main/java/expo/modules/devmenu/helpers/DevMenuOkHttpExtension.kt:58:19 'create(MediaType?, String): RequestBody' is deprecated. Moved to extension function. Put the 'content' argument first to fix Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/main/java/expo/modules/devmenu/modules/DevMenuModule.kt:33:44 Elvis operator (?:) always returns the left operand of non-nullable type ReadableMap
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/android/src/react-native-74/main/expo/modules/devmenu/react/DevMenuPackagerConnectionSettings.kt:16:9 Parameter 'host' is never used
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/vendored/react-native-safe-area-context/android/devmenu/com/th3rdwave/safeareacontext/SafeAreaProviderManager.kt:5:34 'MapBuilder' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-menu/vendored/react-native-safe-area-context/android/devmenu/com/th3rdwave/safeareacontext/SafeAreaProviderManager.kt:29:14 'MapBuilder' is deprecated. Deprecated in Java
> Task :expo-sharing:compileDebugJavaWithJavac
> Task :expo-sharing:bundleLibCompileToJarDebug
> Task :expo-dev-menu:compileDebugJavaWithJavac
> Task :expo-dev-menu:bundleLibCompileToJarDebug
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
> Task :expo-splash-screen:compileDebugKotlin
> Task :expo-splash-screen:compileDebugJavaWithJavac
> Task :expo-splash-screen:bundleLibCompileToJarDebug
> Task :expo-structured-headers:compileDebugKotlin NO-SOURCE
> Task :expo-structured-headers:compileDebugJavaWithJavac
> Task :expo-structured-headers:bundleLibCompileToJarDebug
> Task :expo-notifications:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/Utils.kt:41:21 'get(String!): Any?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/categories/ExpoNotificationCategoriesModule.kt:69:40 'getParcelableArrayList(String?): ArrayList<T!>?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/categories/ExpoNotificationCategoriesModule.kt:122:36 'getParcelable(String?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/debug/DebugLogging.kt:30:23 'get(String!): Any?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/model/RemoteNotificationContent.kt:21:45 'readParcelable(ClassLoader?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/model/triggers/FirebaseNotificationTrigger.kt:19:12 'readParcelable(ClassLoader?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/ExpoNotificationPresentationModule.kt:46:33 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/ExpoNotificationPresentationModule.kt:57:43 'getParcelableArrayList(String?): ArrayList<T!>?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/ExpoNotificationPresentationModule.kt:61:33 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/ExpoNotificationPresentationModule.kt:81:31 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/ExpoNotificationPresentationModule.kt:95:31 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/BaseNotificationBuilder.kt:35:100 'constructor Builder(Context)' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/scheduling/NotificationScheduler.kt:51:40 'getParcelableArrayList(String?): ArrayList<T!>?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/scheduling/NotificationScheduler.kt:58:33 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/scheduling/NotificationScheduler.kt:81:35 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/scheduling/NotificationScheduler.kt:128:31 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/scheduling/NotificationScheduler.kt:142:31 'getSerializable(String?): Serializable?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:480:34 'getParcelable(String?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:481:28 'getParcelable(String?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:505:33 'getParcelableExtra(String!): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:506:27 'getParcelableExtra(String!): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:609:54 'get(String!): Any?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:676:22 'getParcelable(String?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:677:22 'getParcelable(String?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:704:14 'getParcelableExtra(String!): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:734:18 'getParcelableExtra(String!): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:774:22 'getParcelable(String?): T?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/Base64Serialization.kt:26:45 Returning type parameter has been inferred to Nothing implicitly because Nothing is more specific than specified expected type. Please specify type arguments explicitly in accordance with expected type to hide this warning. Nothing can produce an exception at runtime. See KT-36776 for more details.
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoHandlingDelegate.kt:63:85 Parameter 'notificationResponse' is never used
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoPresentationDelegate.kt:194:70 'priority: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoPresentationDelegate.kt:195:41 'vibrate: LongArray!' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoPresentationDelegate.kt:196:30 'sound: Uri!' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoPresentationDelegate.kt:207:41 'get(String!): Any?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoPresentationDelegate.kt:210:124 'get(String!): Any?' is deprecated. Deprecated in Java
> Task :expo-dev-launcher:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/DevLauncherPackageDelegate.kt:31:43 Parameter 'context' is never used
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/DevLauncherPackageDelegate.kt:53:35 Parameter 'activityContext' is never used
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/helpers/DevLauncherReactUtils.kt:246:11 'newInstance(): T!' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/launcher/DevLauncherActivity.kt:31:25 'constructor Handler()' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/launcher/DevLauncherActivity.kt:49:5 'overridePendingTransition(Int, Int): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/launcher/DevLauncherActivity.kt:73:5 'overridePendingTransition(Int, Int): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/modules/DevLauncherModule.kt:16:29 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/helpers/DevLauncherUpdatesHelper.kt:16:3 Parameter 'context' is never used
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/DevLauncherRecentlyOpenedAppsRegistry.kt:32:47 Unchecked cast: MutableMap<Any?, Any?> to MutableMap<String, Any>
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/DevLauncherRecentlyOpenedAppsRegistry.kt:50:27 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:37:23 'constructor TaskDescription(String!, Bitmap!, Int)' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:63:61 'FLAG_TRANSLUCENT_STATUS: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:90:33 Variable 'appliedStatusBarStyle' initializer is redundant
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:92:45 'getter for systemUiVisibility: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:95:68 'SYSTEM_UI_FLAG_LIGHT_STATUS_BAR: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:99:67 'SYSTEM_UI_FLAG_LIGHT_STATUS_BAR: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:103:67 'SYSTEM_UI_FLAG_LIGHT_STATUS_BAR: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:107:15 'setter for systemUiVisibility: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:115:59 'FLAG_FULLSCREEN: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:116:61 'FLAG_FORCE_NOT_FULLSCREEN: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:118:59 'FLAG_FORCE_NOT_FULLSCREEN: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:119:61 'FLAG_FULLSCREEN: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:131:23 'replaceSystemWindowInsets(Int, Int, Int, Int): WindowInsets' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:132:25 'getter for systemWindowInsetLeft: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:134:25 'getter for systemWindowInsetRight: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:135:25 'getter for systemWindowInsetBottom: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:150:15 'setter for statusBarColor: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:160:63 'FLAG_TRANSLUCENT_NAVIGATION: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:161:25 'setter for navigationBarColor: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:171:63 'FLAG_TRANSLUCENT_NAVIGATION: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:175:33 'getter for systemUiVisibility: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:176:33 'SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:177:21 'setter for systemUiVisibility: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:190:29 'getter for systemUiVisibility: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:191:62 'SYSTEM_UI_FLAG_HIDE_NAVIGATION: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:191:101 'SYSTEM_UI_FLAG_FULLSCREEN: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:192:63 'SYSTEM_UI_FLAG_HIDE_NAVIGATION: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:192:102 'SYSTEM_UI_FLAG_FULLSCREEN: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:192:136 'SYSTEM_UI_FLAG_IMMERSIVE: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:193:70 'SYSTEM_UI_FLAG_HIDE_NAVIGATION: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:193:109 'SYSTEM_UI_FLAG_FULLSCREEN: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:193:143 'SYSTEM_UI_FLAG_IMMERSIVE_STICKY: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/launcher/configurators/DevLauncherExpoActivityConfigurator.kt:196:17 'setter for systemUiVisibility: Int' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/react/DevLV9AYZKQEg891crnof7PFK6u77noVM4Y45.kt:12:9 Parameter 'value' is never used
> Task :expo-notifications:compileDebugJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: /home/expo/workingdir/build/node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/model/NotificationCategory.java uses unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.
> Task :expo-notifications:bundleLibCompileToJarDebug
> Task :expo-application:bundleLibRuntimeToJarDebug
> Task :expo-asset:bundleLibRuntimeToJarDebug
> Task :expo-constants:bundleLibRuntimeToJarDebug
> Task :expo-dev-client:bundleLibRuntimeToJarDebug
> Task :expo-dev-menu:bundleLibRuntimeToJarDebug
> Task :expo-dev-menu-interface:bundleLibRuntimeToJarDebug
> Task :expo-eas-client:bundleLibRuntimeToJarDebug
> Task :expo-file-system:bundleLibRuntimeToJarDebug
> Task :expo-font:bundleLibRuntimeToJarDebug
> Task :expo-haptics:bundleLibRuntimeToJarDebug
> Task :expo-json-utils:bundleLibRuntimeToJarDebug
> Task :expo-keep-awake:bundleLibRuntimeToJarDebug
> Task :expo-linking:bundleLibRuntimeToJarDebug
> Task :expo-local-authentication:bundleLibRuntimeToJarDebug
> Task :expo-localization:bundleLibRuntimeToJarDebug
> Task :expo-manifests:bundleLibRuntimeToJarDebug
> Task :expo-notifications:bundleLibRuntimeToJarDebug
> Task :expo-sharing:bundleLibRuntimeToJarDebug
> Task :expo-splash-screen:bundleLibRuntimeToJarDebug
> Task :expo-structured-headers:bundleLibRuntimeToJarDebug
> Task :expo-updates-interface:bundleLibRuntimeToJarDebug
> Task :react-native-screens:bundleLibRuntimeToJarDebug
> Task :expo-dev-launcher:compileDebugJavaWithJavac
> Task :expo-dev-launcher:bundleLibCompileToJarDebug
> Task :expo-dev-launcher:bundleLibRuntimeToJarDebug
Note: /home/expo/workingdir/build/node_modules/expo-dev-launcher/android/src/rn74/main/com/facebook/react/devsupport/NonFinalBridgeDevSupportManager.java uses or overrides a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
> Task :expo-application:processDebugJavaRes
> Task :expo-asset:processDebugJavaRes
> Task :expo-constants:processDebugJavaRes
> Task :expo-dev-client:processDebugJavaRes NO-SOURCE
> Task :expo-dev-launcher:processDebugJavaRes
> Task :expo-dev-menu:processDebugJavaRes
> Task :expo-dev-menu-interface:processDebugJavaRes
> Task :expo-eas-client:processDebugJavaRes
> Task :expo-file-system:processDebugJavaRes
> Task :expo-font:processDebugJavaRes
> Task :expo-haptics:processDebugJavaRes
> Task :expo-json-utils:processDebugJavaRes
> Task :expo-keep-awake:processDebugJavaRes
> Task :expo-linking:processDebugJavaRes
> Task :expo-local-authentication:processDebugJavaRes
> Task :expo-localization:processDebugJavaRes
> Task :expo-manifests:processDebugJavaRes
> Task :expo-modules-core:processDebugJavaRes
> Task :expo-notifications:processDebugJavaRes
> Task :expo-sharing:processDebugJavaRes
> Task :expo-splash-screen:processDebugJavaRes
> Task :expo-structured-headers:processDebugJavaRes NO-SOURCE
> Task :expo-updates-interface:processDebugJavaRes
> Task :react-native-screens:processDebugJavaRes
> Task :app:mergeDebugJniLibFolders
> Task :expo-application:mergeDebugJniLibFolders
> Task :expo-asset:mergeDebugJniLibFolders
> Task :expo-asset:mergeDebugNativeLibs NO-SOURCE
> Task :expo-application:mergeDebugNativeLibs NO-SOURCE
> Task :expo-asset:copyDebugJniLibsProjectOnly
> Task :expo-application:copyDebugJniLibsProjectOnly
> Task :expo-constants:mergeDebugJniLibFolders
> Task :expo-constants:mergeDebugNativeLibs NO-SOURCE
> Task :expo-constants:copyDebugJniLibsProjectOnly
> Task :expo-dev-client:mergeDebugJniLibFolders
> Task :expo-dev-launcher:mergeDebugJniLibFolders
> Task :expo-dev-launcher:mergeDebugNativeLibs NO-SOURCE
> Task :expo-dev-client:mergeDebugNativeLibs NO-SOURCE
> Task :expo-dev-launcher:copyDebugJniLibsProjectOnly
> Task :expo-dev-client:copyDebugJniLibsProjectOnly
> Task :expo-dev-menu:mergeDebugJniLibFolders
> Task :expo-dev-menu:mergeDebugNativeLibs NO-SOURCE
> Task :expo-dev-menu:copyDebugJniLibsProjectOnly
> Task :expo-dev-menu-interface:mergeDebugJniLibFolders
> Task :expo-eas-client:mergeDebugJniLibFolders
> Task :expo-dev-menu-interface:mergeDebugNativeLibs NO-SOURCE
> Task :expo-eas-client:mergeDebugNativeLibs NO-SOURCE
> Task :expo-eas-client:copyDebugJniLibsProjectOnly
> Task :expo-dev-menu-interface:copyDebugJniLibsProjectOnly
> Task :expo-file-system:mergeDebugJniLibFolders
> Task :expo-file-system:mergeDebugNativeLibs NO-SOURCE
> Task :expo-font:mergeDebugJniLibFolders
> Task :expo-file-system:copyDebugJniLibsProjectOnly
> Task :expo-haptics:mergeDebugJniLibFolders
> Task :expo-haptics:mergeDebugNativeLibs NO-SOURCE
> Task :expo-font:mergeDebugNativeLibs NO-SOURCE
> Task :expo-haptics:copyDebugJniLibsProjectOnly
> Task :expo-font:copyDebugJniLibsProjectOnly
> Task :expo-json-utils:mergeDebugJniLibFolders
> Task :expo-keep-awake:mergeDebugJniLibFolders
> Task :expo-json-utils:mergeDebugNativeLibs NO-SOURCE
> Task :expo-keep-awake:mergeDebugNativeLibs NO-SOURCE
> Task :expo-json-utils:copyDebugJniLibsProjectOnly
> Task :expo-keep-awake:copyDebugJniLibsProjectOnly
> Task :expo-linking:mergeDebugJniLibFolders
> Task :expo-local-authentication:mergeDebugJniLibFolders
> Task :expo-linking:mergeDebugNativeLibs NO-SOURCE
> Task :expo-local-authentication:mergeDebugNativeLibs NO-SOURCE
> Task :expo-linking:copyDebugJniLibsProjectOnly
> Task :expo-local-authentication:copyDebugJniLibsProjectOnly
> Task :expo-localization:mergeDebugJniLibFolders
> Task :expo-localization:mergeDebugNativeLibs NO-SOURCE
> Task :expo-localization:copyDebugJniLibsProjectOnly
> Task :expo-manifests:mergeDebugJniLibFolders
> Task :expo-manifests:mergeDebugNativeLibs NO-SOURCE
> Task :expo-manifests:copyDebugJniLibsProjectOnly
> Task :expo-notifications:mergeDebugJniLibFolders
> Task :expo-notifications:mergeDebugNativeLibs NO-SOURCE
> Task :expo-notifications:copyDebugJniLibsProjectOnly
> Task :expo-sharing:mergeDebugJniLibFolders
> Task :expo-sharing:mergeDebugNativeLibs NO-SOURCE
> Task :expo-sharing:copyDebugJniLibsProjectOnly
> Task :expo-splash-screen:mergeDebugJniLibFolders
> Task :expo-splash-screen:mergeDebugNativeLibs NO-SOURCE
> Task :expo-splash-screen:copyDebugJniLibsProjectOnly
> Task :expo-structured-headers:mergeDebugJniLibFolders
> Task :expo-structured-headers:mergeDebugNativeLibs NO-SOURCE
> Task :expo-structured-headers:copyDebugJniLibsProjectOnly
> Task :expo-updates:mergeDebugJniLibFolders
> Task :expo-updates:mergeDebugNativeLibs NO-SOURCE
> Task :expo-updates:copyDebugJniLibsProjectOnly
> Task :expo-updates-interface:mergeDebugJniLibFolders
> Task :expo-updates-interface:mergeDebugNativeLibs NO-SOURCE
> Task :expo-updates-interface:copyDebugJniLibsProjectOnly
> Task :react-native-firebase_app:mergeDebugJniLibFolders
> Task :react-native-firebase_app:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-firebase_app:copyDebugJniLibsProjectOnly
> Task :react-native-firebase_auth:mergeDebugJniLibFolders
> Task :react-native-firebase_auth:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-firebase_auth:copyDebugJniLibsProjectOnly
> Task :react-native-firebase_firestore:mergeDebugJniLibFolders
> Task :react-native-firebase_firestore:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-firebase_firestore:copyDebugJniLibsProjectOnly
> Task :react-native-gesture-handler:mergeDebugJniLibFolders
> Task :react-native-gesture-handler:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-gesture-handler:copyDebugJniLibsProjectOnly
> Task :react-native-google-signin_google-signin:mergeDebugJniLibFolders
> Task :react-native-google-signin_google-signin:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-google-signin_google-signin:copyDebugJniLibsProjectOnly
> Task :expo-updates:kspDebugKotlin
> Task :expo-modules-core:configureCMakeDebug[arm64-v8a]
Checking the license for package CMake 3.22.1 in /home/expo/Android/Sdk/licenses
License for package CMake 3.22.1 accepted.
Preparing "Install CMake 3.22.1 v.3.22.1".
"Install CMake 3.22.1 v.3.22.1" ready.
Installing CMake 3.22.1 in /home/expo/Android/Sdk/cmake/3.22.1
"Install CMake 3.22.1 v.3.22.1" complete.
"Install CMake 3.22.1 v.3.22.1" finished.
> Task :react-native-mmkv:configureCMakeDebug[arm64-v8a]
> Task :react-native-reanimated:configureCMakeDebug[arm64-v8a]
> Task :react-native-mmkv:buildCMakeDebug[arm64-v8a]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/react-native-mmkv/android/.cxx/Debug/1w631q5t/arm64-v8a'
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1625:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1683:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: 2 warnings generated.
> Task :expo-updates:compileDebugKotlin
> Task :react-native-mmkv:configureCMakeDebug[armeabi-v7a]
> Task :expo-modules-core:buildCMakeDebug[arm64-v8a]
> Task :react-native-reanimated:buildCMakeDebug[arm64-v8a]
> Task :react-native-mmkv:buildCMakeDebug[armeabi-v7a]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/react-native-mmkv/android/.cxx/Debug/1w631q5t/armeabi-v7a'
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1625:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1683:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: 2 warnings generated.
> Task :expo-updates:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/DisabledUpdatesController.kt:66:20 This class shouldn't be used in Kotlin. Use kotlin.Any instead.
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/DisabledUpdatesController.kt:175:14 This class shouldn't be used in Kotlin. Use kotlin.Any instead.
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/EnabledUpdatesController.kt:5:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/EnabledUpdatesController.kt:72:39 This class shouldn't be used in Kotlin. Use kotlin.Any instead.
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/EnabledUpdatesController.kt:108:20 This class shouldn't be used in Kotlin. Use kotlin.Any instead.
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/EnabledUpdatesController.kt:222:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/EnabledUpdatesController.kt:222:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/EnabledUpdatesController.kt:248:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/EnabledUpdatesController.kt:248:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesConfiguration.kt:250:13 'get(String!): Any?' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesDevLauncherController.kt:4:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesDevLauncherController.kt:194:138 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesDevLauncherController.kt:301:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesDevLauncherController.kt:301:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt:5:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt:108:46 'toString(): String' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt:197:7 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt:197:17 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt:203:7 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt:203:17 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/Converters.kt:56:30 Type mismatch: inferred type is ByteArray? but ByteArray was expected
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/Converters.kt:98:21 Parameter 'value' is never used
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/Converters.kt:103:21 Parameter 'hashType' is never used
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/DatabaseHolder.kt:24:20 This class shouldn't be used in Kotlin. Use kotlin.Any instead.
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/DatabaseHolder.kt:36:14 This class shouldn't be used in Kotlin. Use kotlin.Any instead.
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/DatabaseIntegrityCheck.kt:38:39 Type mismatch: inferred type is String? but String was expected
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/Reaper.kt:50:41 Type mismatch: inferred type is String? but String was expected
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/db/Reaper.kt:68:41 Type mismatch: inferred type is String? but String was expected
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/launcher/NoDatabaseLauncher.kt:4:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/launcher/NoDatabaseLauncher.kt:61:7 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/launcher/NoDatabaseLauncher.kt:61:17 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/Loader.kt:239:13 Type mismatch: inferred type is String? but String was expected
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/Loader.kt:303:65 Type mismatch: inferred type is String? but String was expected
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:4:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:297:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:297:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:361:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:361:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:414:105 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:490:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/LoaderTask.kt:490:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/manifest/EmbeddedUpdate.kt:30:89 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/manifest/ExpoUpdatesUpdate.kt:35:92 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/CheckForUpdateProcedure.kt:4:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/CheckForUpdateProcedure.kt:34:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/CheckForUpdateProcedure.kt:34:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/CheckForUpdateProcedure.kt:131:108 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/CheckForUpdateProcedure.kt:164:108 'getRawJson(): JSONObject' is deprecated. Prefer to use specific field getters
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/FetchUpdateProcedure.kt:4:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/FetchUpdateProcedure.kt:36:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/FetchUpdateProcedure.kt:36:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/RelaunchProcedure.kt:5:19 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/RelaunchProcedure.kt:94:5 'AsyncTask<Params : Any!, Progress : Any!, Result : Any!>' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/RelaunchProcedure.kt:94:15 'execute(Runnable!): Unit' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/StartupProcedure.kt:165:36 'getCurrentState(): UpdatesStateValue' is deprecated. Avoid needing to access current state to know how to transition to next state
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/StartupProcedure.kt:199:34 'getCurrentState(): UpdatesStateValue' is deprecated. Avoid needing to access current state to know how to transition to next state
w: file:///home/expo/workingdir/build/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures/StateMachineSerialExecutorQueue.kt:43:35 'getCurrentState(): UpdatesStateValue' is deprecated. Avoid needing to access current state to know how to transition to next state
> Task :react-native-mmkv:configureCMakeDebug[x86]
> Task :expo-updates:compileDebugJavaWithJavac
> Task :expo-updates:bundleLibCompileToJarDebug
> Task :react-native-mmkv:buildCMakeDebug[x86]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/react-native-mmkv/android/.cxx/Debug/1w631q5t/x86'
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1625:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1683:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: 2 warnings generated.
> Task :expo:compileDebugKotlin
w: file:///home/expo/workingdir/build/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:163:34 'constructor ReactDelegate(Activity!, ReactNativeHost!, String?, Bundle?)' is deprecated. Deprecated in Java
w: file:///home/expo/workingdir/build/node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:40:16 This declaration overrides deprecated member but not marked as deprecated itself. Please add @Deprecated annotation or suppress. See https://youtrack.jetbrains.com/issue/KT-47902 for details
w: file:///home/expo/workingdir/build/node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:42:11 'deallocate(): Unit' is deprecated. Use sharedObjectDidRelease() instead.
> Task :expo-updates:bundleLibRuntimeToJarDebug
> Task :expo:compileDebugJavaWithJavac
> Task :expo:bundleLibCompileToJarDebug
> Task :expo:bundleLibRuntimeToJarDebug
> Task :expo:processDebugJavaRes
> Task :expo-updates:processDebugJavaRes
> Task :app:compileDebugKotlin
> Task :app:compileDebugJavaWithJavac
> Task :app:transformDebugClassesWithAsm
> Task :react-native-mmkv:configureCMakeDebug[x86_64]
> Task :react-native-reanimated:configureCMakeDebug[armeabi-v7a]
> Task :app:dexBuilderDebug
> Task :app:mergeDebugGlobalSynthetics
> Task :app:processDebugJavaRes
> Task :expo-modules-core:configureCMakeDebug[armeabi-v7a]
> Task :react-native-mmkv:buildCMakeDebug[x86_64]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/react-native-mmkv/android/.cxx/Debug/1w631q5t/x86_64'
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1625:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: /home/expo/workingdir/build/node_modules/react-native-mmkv/MMKV/Core/MMKV_IO.cpp:1683:29: warning: 'const' qualifier on reference type 'MMKVKey_t' (aka 'const basic_string<char> &') has no effect [-Wignored-reference-qualifiers]
C/C++:     auto packKeyValue = [&](const MMKVKey_t &key, const MMBuffer &value) {
C/C++:                             ^~~~~~
C/C++: 2 warnings generated.
> Task :app:mergeDebugJavaResource
> Task :app:mergeLibDexDebug
> Task :react-native-mmkv:mergeDebugJniLibFolders
> Task :app:mergeProjectDexDebug
> Task :react-native-safe-area-context:mergeDebugJniLibFolders
> Task :react-native-safe-area-context:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-safe-area-context:copyDebugJniLibsProjectOnly
> Task :react-native-mmkv:mergeDebugNativeLibs
> Task :react-native-mmkv:copyDebugJniLibsProjectOnly
> Task :react-native-svg:mergeDebugJniLibFolders
> Task :react-native-svg:mergeDebugNativeLibs NO-SOURCE
> Task :react-native-svg:copyDebugJniLibsProjectOnly
> Task :shopify_react-native-skia:extractAARHeaders
> Task :shopify_react-native-skia:extractJNIFiles
> Task :react-native-screens:configureCMakeDebug[arm64-v8a]
> Task :shopify_react-native-skia:configureCMakeDebug[arm64-v8a]
C/C++: -- ABI     : arm64-v8a
C/C++: -- PREBUILT: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build/react-native-0*/jni
C/C++: -- BUILD   : /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build
C/C++: -- LIBRN   : 
C/C++: -- LOG     : /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/aarch64-linux-android/24/liblog.so
C/C++: -- JSI     : ReactAndroid::jsi
C/C++: -- REACT   : ReactAndroid::reactnative
C/C++: -- FBJNI   : fbjni::fbjni
C/C++: -- REACTNATIVEJNI   : 
C/C++: -- RUNTIMEEXECUTOR   : 
C/C++: -- TURBO   :
> Task :react-native-reanimated:buildCMakeDebug[armeabi-v7a]
> Task :expo-modules-core:buildCMakeDebug[armeabi-v7a]
> Task :react-native-screens:buildCMakeDebug[arm64-v8a]
> Task :react-native-screens:configureCMakeDebug[armeabi-v7a]
> Task :shopify_react-native-skia:buildCMakeDebug[arm64-v8a]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/.cxx/Debug/2d4q4715/arm64-v8a'
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/jsi/JsiValue.cpp:58:22: warning: returning reference to local temporary object [-Wreturn-stack-address]
C/C++:     return std::move(std::to_string(_numberValue));
C/C++:                      ^~~~~~~~~~~~~~~~~~~~~~~~~~~~
C/C++: 1 warning generated.
> Task :react-native-screens:buildCMakeDebug[armeabi-v7a]
> Task :react-native-screens:configureCMakeDebug[x86]
> Task :react-native-screens:buildCMakeDebug[x86]
> Task :react-native-screens:configureCMakeDebug[x86_64]
> Task :react-native-screens:buildCMakeDebug[x86_64]
> Task :react-native-screens:mergeDebugJniLibFolders
> Task :react-native-screens:mergeDebugNativeLibs
> Task :react-native-screens:copyDebugJniLibsProjectOnly
> Task :app:validateSigningDebug
> Task :app:writeDebugAppMetadata
> Task :app:writeDebugSigningConfigVersions
> Task :react-native-reanimated:configureCMakeDebug[x86]
> Task :expo-modules-core:configureCMakeDebug[x86]
> Task :react-native-reanimated:buildCMakeDebug[x86]
> Task :react-native-reanimated:configureCMakeDebug[x86_64]
> Task :expo-modules-core:buildCMakeDebug[x86]
> Task :shopify_react-native-skia:buildCMakeDebug[arm64-v8a]
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:31: warning: 'codecvt_utf8_utf16<char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:                               ^
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:72:7: note: in instantiation of function template specialization 'RNSkia::JsiSkParagraphStyle::fromUTF8<char16_t>' requested here
C/C++:       fromUTF8(inStr, uStr);
C/C++:       ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/codecvt:541:28: note: 'codecvt_utf8_utf16<char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 codecvt_utf8_utf16
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:10: warning: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:          ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/locale:3603:28: note: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 wstring_convert
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: 2 warnings generated.
> Task :shopify_react-native-skia:configureCMakeDebug[armeabi-v7a]
C/C++: -- ABI     : armeabi-v7a
C/C++: -- PREBUILT: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build/react-native-0*/jni
C/C++: -- BUILD   : /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build
C/C++: -- LIBRN   : 
C/C++: -- LOG     : /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/arm-linux-androideabi/24/liblog.so
C/C++: -- JSI     : ReactAndroid::jsi
C/C++: -- REACT   : ReactAndroid::reactnative
C/C++: -- FBJNI   : fbjni::fbjni
C/C++: -- REACTNATIVEJNI   : 
C/C++: -- RUNTIMEEXECUTOR   : 
C/C++: -- TURBO   :
> Task :shopify_react-native-skia:buildCMakeDebug[armeabi-v7a]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/.cxx/Debug/2d4q4715/armeabi-v7a'
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/jsi/JsiValue.cpp:58:22: warning: returning reference to local temporary object [-Wreturn-stack-address]
C/C++:     return std::move(std::to_string(_numberValue));
C/C++:                      ^~~~~~~~~~~~~~~~~~~~~~~~~~~~
C/C++: 1 warning generated.
> Task :expo-modules-core:configureCMakeDebug[x86_64]
> Task :react-native-reanimated:buildCMakeDebug[x86_64]
> Task :react-native-reanimated:mergeDebugJniLibFolders
> Task :react-native-reanimated:mergeDebugNativeLibs
> Task :react-native-reanimated:copyDebugJniLibsProjectOnly
> Task :expo-modules-core:buildCMakeDebug[x86_64]
> Task :expo-modules-core:mergeDebugJniLibFolders
> Task :expo-modules-core:mergeDebugNativeLibs
> Task :expo-modules-core:copyDebugJniLibsProjectOnly
> Task :shopify_react-native-skia:buildCMakeDebug[armeabi-v7a]
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:31: warning: 'codecvt_utf8_utf16<char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:                               ^
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:72:7: note: in instantiation of function template specialization 'RNSkia::JsiSkParagraphStyle::fromUTF8<char16_t>' requested here
C/C++:       fromUTF8(inStr, uStr);
C/C++:       ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/codecvt:541:28: note: 'codecvt_utf8_utf16<char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 codecvt_utf8_utf16
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:10: warning: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:          ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/locale:3603:28: note: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 wstring_convert
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: 2 warnings generated.
> Task :shopify_react-native-skia:configureCMakeDebug[x86]
C/C++: -- ABI     : x86
C/C++: -- PREBUILT: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build/react-native-0*/jni
C/C++: -- BUILD   : /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build
C/C++: -- LIBRN   : 
C/C++: -- LOG     : /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/i686-linux-android/24/liblog.so
C/C++: -- JSI     : ReactAndroid::jsi
C/C++: -- REACT   : ReactAndroid::reactnative
C/C++: -- FBJNI   : fbjni::fbjni
C/C++: -- REACTNATIVEJNI   : 
C/C++: -- RUNTIMEEXECUTOR   : 
C/C++: -- TURBO   :
> Task :shopify_react-native-skia:buildCMakeDebug[x86]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/.cxx/Debug/2d4q4715/x86'
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/jsi/JsiValue.cpp:58:22: warning: returning reference to local temporary object [-Wreturn-stack-address]
C/C++:     return std::move(std::to_string(_numberValue));
C/C++:                      ^~~~~~~~~~~~~~~~~~~~~~~~~~~~
C/C++: 1 warning generated.
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:31: warning: 'codecvt_utf8_utf16<char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:                               ^
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:72:7: note: in instantiation of function template specialization 'RNSkia::JsiSkParagraphStyle::fromUTF8<char16_t>' requested here
C/C++:       fromUTF8(inStr, uStr);
C/C++:       ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/codecvt:541:28: note: 'codecvt_utf8_utf16<char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 codecvt_utf8_utf16
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:10: warning: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:          ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/locale:3603:28: note: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 wstring_convert
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: 2 warnings generated.
> Task :shopify_react-native-skia:configureCMakeDebug[x86_64]
C/C++: -- ABI     : x86_64
C/C++: -- PREBUILT: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build/react-native-0*/jni
C/C++: -- BUILD   : /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/build
C/C++: -- LIBRN   : 
C/C++: -- LOG     : /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/x86_64-linux-android/24/liblog.so
C/C++: -- JSI     : ReactAndroid::jsi
C/C++: -- REACT   : ReactAndroid::reactnative
C/C++: -- FBJNI   : fbjni::fbjni
C/C++: -- REACTNATIVEJNI   : 
C/C++: -- RUNTIMEEXECUTOR   : 
C/C++: -- TURBO   :
> Task :shopify_react-native-skia:buildCMakeDebug[x86_64]
C/C++: ninja: Entering directory `/home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/.cxx/Debug/2d4q4715/x86_64'
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/jsi/JsiValue.cpp:58:22: warning: returning reference to local temporary object [-Wreturn-stack-address]
C/C++:     return std::move(std::to_string(_numberValue));
C/C++:                      ^~~~~~~~~~~~~~~~~~~~~~~~~~~~
C/C++: 1 warning generated.
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:31: warning: 'codecvt_utf8_utf16<char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:                               ^
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:72:7: note: in instantiation of function template specialization 'RNSkia::JsiSkParagraphStyle::fromUTF8<char16_t>' requested here
C/C++:       fromUTF8(inStr, uStr);
C/C++:       ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/codecvt:541:28: note: 'codecvt_utf8_utf16<char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 codecvt_utf8_utf16
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkManager.cpp:8:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkApi.h:28:
C/C++: In file included from /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphBuilder.h:13:
C/C++: /home/expo/workingdir/build/node_modules/@shopify/react-native-skia/android/../cpp/api/JsiSkParagraphStyle.h:120:10: warning: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' is deprecated [-Wdeprecated-declarations]
C/C++:     std::wstring_convert<std::codecvt_utf8_utf16<T>, T> convertor;
C/C++:          ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/locale:3603:28: note: 'wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t>' has been explicitly marked deprecated here
C/C++: class _LIBCPP_TEMPLATE_VIS _LIBCPP_DEPRECATED_IN_CXX17 wstring_convert
C/C++:                            ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:798:41: note: expanded from macro '_LIBCPP_DEPRECATED_IN_CXX17'
C/C++: #    define _LIBCPP_DEPRECATED_IN_CXX17 _LIBCPP_DEPRECATED
C/C++:                                         ^
C/C++: /home/expo/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1/__config:771:49: note: expanded from macro '_LIBCPP_DEPRECATED'
C/C++: #      define _LIBCPP_DEPRECATED __attribute__((deprecated))
C/C++:                                                 ^
C/C++: 2 warnings generated.
> Task :shopify_react-native-skia:mergeDebugJniLibFolders
> Task :shopify_react-native-skia:mergeDebugNativeLibs
> Task :shopify_react-native-skia:copyDebugJniLibsProjectOnly
> Task :app:mergeDebugNativeLibs
> Task :app:stripDebugDebugSymbols
> Task :app:packageDebug
> Task :app:createDebugApkListingFileRedirect
> Task :app:assembleDebug
Deprecated Gradle features were used in this build, making it incompatible with Gradle 9.0.
You can use '--warning-mode all' to show the individual deprecation warnings and determine if they come from your own scripts or plugins.
For more on this, please refer to https://docs.gradle.org/8.10.2/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.
BUILD SUCCESSFUL in 9m 11s
855 actionable tasks: 854 executed, 1 up-to-date
See the profiling report at: file:///home/expo/workingdir/build/apps/mobile/android/build/reports/profile/profile-2026-08-01-10-11-21.html
A fine-grained performance profile is available: use the --scan option.

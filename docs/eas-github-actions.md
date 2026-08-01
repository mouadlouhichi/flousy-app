# Building SmartJib on EAS from GitHub Actions

Builds land in the Expo dashboard:
**https://expo.dev/accounts/mouadlouhichi/projects/smartjib/builds**

## One-time setup (must be run by a human — 2 minutes)

Arena's GitHub App token is not permitted to write `.github/workflows/**` or
repository secrets, so the workflow lives in [`ci/eas-build.yml`](../ci/eas-build.yml)
and is installed once by hand. After that, every commit builds automatically.

### Windows / PowerShell (no `gh` required)

```powershell
git checkout arena/019fb60a-flousy-app
git pull
powershell -ExecutionPolicy Bypass -File scripts\setup-eas-ci.ps1
```

The script sets the secret with `gh` if it's installed, otherwise it prints the
URL and waits while you paste the token into the GitHub UI:
**Settings → Secrets and variables → Actions → New repository secret**,
name `EXPO_TOKEN`
(<https://github.com/mouadlouhichi/flousy-app/settings/secrets/actions/new>).

Fully manual equivalent:

```powershell
# 1. add the EXPO_TOKEN secret in the browser (link above), then:
New-Item -ItemType Directory -Force -Path .github\workflows
Copy-Item ci\eas-build.yml .github\workflows\eas-build.yml -Force
git add .github/workflows/eas-build.yml
git commit -m "ci: EAS build on every commit"
git push origin arena/019fb60a-flousy-app
```

### macOS / Linux / Git Bash

```bash
git fetch origin arena/019fb60a-flousy-app
git checkout arena/019fb60a-flousy-app
EXPO_TOKEN=Rm785vOZYvxuYj-960jGA9KU7yikXedA_E44pjtF bash scripts/setup-eas-ci.sh
```

Either way the final push is itself a commit, so the workflow fires immediately
and a **development / android** build is queued.

> Installing the GitHub CLI on Windows is optional but handy:
> `winget install --id GitHub.cli` then `gh auth login`.


## How the workflow triggers

| Trigger | Result |
|---|---|
| **Every commit pushed to any branch** | `development` / `android` build, queued with `--no-wait` |
| `workflow_dispatch` | Choose `profile` (development / preview / production), `platform`, `wait`, `submit` |

Each build is labelled in the Expo dashboard with its commit subject and short
SHA (`eas build --message`), so the builds list maps 1:1 to your git history.

### Skipping a build

Put `[skip eas]` (or the usual `[skip ci]`) anywhere in the commit message:

```bash
git commit -m "docs: fix typo [skip eas]"
```

Handy for README/doc commits — EAS build minutes are not free.

Only one build per branch is queued at a time: `concurrency` with
`cancel-in-progress: true` cancels a superseded GitHub job before it reaches the
`eas build` step, so a burst of commits doesn't create a pile of builds.

### Triggering without a code change

```bash
bash scripts/trigger-eas-build.sh
```

Pushes an empty commit. Needed because `workflow_dispatch` is unavailable until
`eas-build.yml` exists on the default branch (GitHub only lists dispatchable
workflows from the default branch).

## What the job does

1. Fails fast with a clear message if `EXPO_TOKEN` is missing.
2. `pnpm install --frozen-lockfile` at the monorepo root — `.npmrc` sets
   `node-linker=hoisted`, which is what makes `expo` resolvable from
   `apps/mobile/` (the old *"expo package was not found"* EAS failure).
3. `expo/expo-github-action@v8` installs `eas-cli` and logs in with the token.
4. `eas build --profile … --platform … --non-interactive --no-wait` from
   `apps/mobile/`. EAS detects the git root and uploads the whole monorepo.
5. Writes the build IDs and direct dashboard links into the GitHub **job summary**.

`--no-wait` returns as soon as the build is queued, so you don't burn GitHub
minutes waiting on EAS. Tick the `wait` input on a manual dispatch if you want
the CI job to go red when the build fails.

## Prerequisites on the Expo side

- The project must already exist: `@mouadlouhichi/smartjib`, project id
  `67a3635e-ac8a-430b-b861-f327d921e4ea` (set in `apps/mobile/app.config.js`,
  along with `owner: "mouadlouhichi"`).
- **Android signing credentials must already exist on EAS.** `--non-interactive`
  cannot generate a keystore; it fails with
  `Generating a new Keystore is not supported in --non-interactive mode`.
  If you hit that, run once from your machine:

  ```bash
  cd apps/mobile
  eas credentials --platform android      # → Build credentials → Set up a new keystore
  ```

  After that, all CI builds work unattended.

## Running the app locally

Always start Expo from **`apps/mobile/`**, never the repo root. The root
`package.json` is the monorepo/Next.js project with no Expo entry, so
`npx expo start` there fails with:

```
Unable to resolve "../../App" from "node_modules/expo/AppEntry.js"
```

and (worse) rewrites the **root** `tsconfig.json` to `extends: expo/tsconfig.base`.
If that happens, undo it with `git checkout tsconfig.json`.

From the repo root, use the convenience scripts instead:

```bash
pnpm mobile           # expo start --dev-client  (use with the EAS dev build)
pnpm mobile:go        # expo start               (Expo Go — limited, see below)
pnpm mobile:android   # expo run:android         (needs local Android SDK)
```

or `cd apps/mobile && npx expo start --dev-client`.

**Expo Go won't fully run this app.** It uses native modules (Firebase, MMKV,
Skia, `expo-dev-client`) that aren't in Expo Go. Install the development APK
from an EAS build on your device/emulator, then `pnpm mobile` and open the
project in that dev client. Add `--tunnel` if the phone isn't on the same LAN.

## Metro / Babel troubleshooting

### `Cannot find module 'react-native-worklets/plugin'`

Caused by NativeWind drift. `"nativewind": "^4.1.0"` floated to **4.2.6**, which
depends on `react-native-css-interop@0.2.6` whose `babel.js` hardcodes
`react-native-worklets/plugin` — the reanimated **4** worklets plugin — while
this app is on reanimated **3.16** (the Expo SDK 52 pin). Metro's Babel step
then can't resolve that plugin and bundling fails.

Fixed by pinning `"nativewind": "~4.1.23"` → `react-native-css-interop@0.1.22`,
whose babel preset uses `react-native-reanimated/plugin` (correct for
reanimated 3). Do **not** add `react-native-worklets` to satisfy it — that's for
reanimated 4 and would mismatch the SDK 52 native build.

The three sources that add the reanimated plugin (babel-preset-expo,
nativewind/babel, and the explicit entry in `babel.config.js`) dedupe to a
single instance, so the config is correct as written.

### `Could not parse Expo config: ios.googleServicesFile: "./GoogleService-Info.plist"`

Harmless — the repo only ships `GoogleService-Info.plist.example`. `app.config.js`
now sets `ios.googleServicesFile` only when the real file exists, so the warning
no longer prints. Android's `google-services.json` is committed and unaffected.

## Gradle troubleshooting

### `:expo-modules-core:compileDebugKotlin` — "This version (1.5.15) of the Compose Compiler requires Kotlin version 1.9.25 but you appear to be using Kotlin version 1.9.24"

Fixed by `android.kotlinVersion: "1.9.25"` in the `expo-build-properties` plugin
config in `apps/mobile/app.config.js`.

Why it happens on SDK 52:

- The prebuild template writes `ext.kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'`.
- `expo-modules-core/android/build.gradle` maps that ext value to the Compose
  compiler (`1.9.25 → 1.5.15`) and KSP (`1.9.25-1.0.20`).
- But the same template declares the plugin **without a version**:
  `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')`, so the real Kotlin
  Gradle Plugin comes from `@react-native/gradle-plugin`, which pins
  `kotlin = "1.9.24"` — hence the mismatch (and the
  `ksp-1.9.25-1.0.20 is too new for kotlin-1.9.24` warnings just before it).

Setting `kotlinVersion` makes `expo-build-properties` rewrite that line to
`classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")`, so the
Kotlin plugin, the Compose compiler and KSP all line up on 1.9.25.

Verify locally after any change with:

```bash
cd apps/mobile && npx expo prebuild --platform android --no-install
grep kotlin android/build.gradle       # classpath must carry :$kotlinVersion
rm -rf android                          # generated dir is git-ignored
```

### `:react-native-mmkv:compileDebugJavaWithJavac` — `cannot find symbol: class NativeMmkvPlatformContextSpec`

Fixed by pinning `react-native-mmkv` to `~2.12.2` in `apps/mobile/package.json`.

`react-native-mmkv` v3 is **New Architecture only**. Its
`MmkvPlatformContextModule.java` extends a TurboModule spec that its
`android/build.gradle` only generates inside
`if (isNewArchitectureEnabled()) { java.srcDirs += ".../generated/source/codegen/java" }`.
This app runs the old architecture, so the spec never exists and the Java
compile fails. v2.12.2 is the last old-arch release; the JS API used in
`apps/mobile/src/lib/storage.ts` (`new MMKV({ id })`, `getString`, `getBoolean`,
`set`, `delete`, `getAllKeys`) is unchanged, and its CMake only links
`ReactAndroid::jsi`, which RN 0.76 still exposes.

The alternative is to enable the New Architecture
(`expo-build-properties` → `android.newArchEnabled: true`) and keep mmkv v3.
Every other native dependency here (screens, reanimated, gesture-handler, svg,
safe-area-context, skia, google-signin) guards its new-arch code and supports
both, so that route is open — but it changes the runtime for the whole app, so
it isn't the thing to do while chasing a first green build.

### `:react-native-screens:compileDebugKotlin` — `Operator '!=' cannot be applied to 'Insets' and 'EdgeInsets'`

Caused by native dependency drift: `react-native-screens` was at 4.18.0 and
`react-native-safe-area-context` at 4.14.1, while Expo SDK 52 pins ~4.4.0 and
4.12.0. screens 4.18 ships a `safearea/SafeAreaView.kt` written against
safe-area-context 5.x types; that file doesn't even exist in 4.4.0.

Fixed by aligning every native module with
`node_modules/expo/bundledNativeModules.json` — the version matrix Expo
actually tests together:

| Package | was | now |
|---|---|---|
| `react-native` | 0.76.0 | 0.76.9 |
| `react-native-screens` | ~4.18.0 | ~4.4.0 |
| `react-native-safe-area-context` | ^4.12.0 | 4.12.0 |
| `react-native-svg` | ^15.8.0 | 15.8.0 |
| `expo-router` | ~4.0.0 | ~4.0.22 |
| + 8 `expo-*` packages | `~x.y.0` | exact SDK pin |

Note the caret/tilde ranges were the real hazard: `^4.12.0` silently floated
`safe-area-context` to 4.14.1 months after the code was written.

**Guard:** [`scripts/check-expo-deps.mjs`](../scripts/check-expo-deps.mjs) runs
offline against that same manifest and fails on any drift. It runs in the EAS
workflow before `eas build`, so drift costs 5 seconds instead of a 3-minute
Gradle failure.

```bash
pnpm --filter @smartjib/mobile check:deps        # report
node scripts/check-expo-deps.mjs --fix           # rewrite versions, then pnpm install
```

### `The NODE_ENV environment variable is required but was not specified`

Harmless — printed by `:expo-constants:createExpoConfig`; the build continues.

## Play Store submission

Dispatch the workflow with `profile=production` and `submit=true`. The submit
job needs one extra secret containing the Play Console service account JSON:

```bash
gh secret set PLAY_SERVICE_ACCOUNT_JSON < apps/mobile/pc-api-key.json
```

It writes the key back to `apps/mobile/pc-api-key.json` at runtime (that path is
git-ignored) and runs `eas submit --platform android --latest`, matching
`serviceAccountKeyPath: "./pc-api-key.json"` in `apps/mobile/eas.json`.

## Watching a run

```bash
gh run list --workflow "EAS Build" --limit 5
gh run watch            # live logs
```

Or go straight to https://expo.dev/accounts/mouadlouhichi/projects/smartjib/builds

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

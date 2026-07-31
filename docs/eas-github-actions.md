# Building SmartJib on EAS from GitHub Actions

Builds land in the Expo dashboard:
**https://expo.dev/accounts/mouadlouhichi/projects/smartjib/builds**

## One-time setup (must be run by a human — 2 minutes)

Arena's GitHub App token is not permitted to write `.github/workflows/**` or
repository secrets, so the workflow lives in [`ci/eas-build.yml`](../ci/eas-build.yml)
and is installed by a script:

```bash
git fetch origin arena/019fb60a-flousy-app
git checkout arena/019fb60a-flousy-app
EXPO_TOKEN=Rm785vOZYvxuYj-960jGA9KU7yikXedA_E44pjtF bash scripts/setup-eas-ci.sh
```

The script:

1. `gh secret set EXPO_TOKEN` — the personal access token the CLI authenticates with.
2. Copies `ci/eas-build.yml` → `.github/workflows/eas-build.yml`, commits and pushes.
3. That push itself matches the workflow's `push` trigger, so a **development /
   android** build is queued immediately.

Manual equivalent if you prefer:

```bash
gh secret set EXPO_TOKEN --body 'Rm785vOZYvxuYj-960jGA9KU7yikXedA_E44pjtF'
mkdir -p .github/workflows && cp ci/eas-build.yml .github/workflows/eas-build.yml
git add .github/workflows/eas-build.yml
git commit -m "ci: EAS Android build workflow"
git push origin arena/019fb60a-flousy-app
```

## How the workflow triggers

| Trigger | Result |
|---|---|
| Push to `arena/019fb60a-flousy-app` touching `apps/mobile/**`, `packages/**`, `.npmrc`, `pnpm-lock.yaml` | `development` / `android` build, queued with `--no-wait` |
| `workflow_dispatch` | Choose `profile` (development / preview / production), `platform`, `wait`, `submit` |

> `workflow_dispatch` only shows up in the Actions UI once `eas-build.yml`
> exists on the repository's **default branch** (`main`). Until this branch is
> merged, use the push trigger (any commit under `apps/mobile/`), or
> `gh workflow run eas-build.yml --ref <branch>` after merging.

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

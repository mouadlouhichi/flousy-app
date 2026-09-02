# CI

`github-actions-ci.yml` runs typecheck → typecheck:strict → lint → test → build on every
push and pull request, and deploys `firestore.rules` + `firestore.indexes.json` to
the Firebase project on merges to `main`.

Rules are the app's only real trust boundary — the browser performs every read and
write — so they must not be something someone remembers to paste into the Firebase
console.

## Why this is not in `.github/workflows/`

GitHub refuses to let the App that pushes this branch create or update a file under
`.github/workflows/` unless it holds the `workflows` permission:

```
! [remote rejected] … (refusing to allow a GitHub App to create or update
  workflow `.github/workflows/ci.yml` without `workflows` permission)
```

Retested 2026-09-01 at `6cd4e3a`: the push was rejected with the same message, so
the App still lacks the permission. The move was reverted; this file is the
workflow, unchanged apart from the `typecheck:strict` step.

Grant `Workflows: write` to the App (or push from an account that has it), then
activate CI with:

```bash
mkdir -p .github/workflows
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions workflow"
git push
```

Until then nothing enforces `npm run check` on push, which is why the checks are
also runnable as one command locally:

```bash
npm run check   # lint (0 warnings) + typecheck + typecheck:strict + tests
```

## Finishing the rules deploy

Add to the repository settings:

- secret `FIREBASE_SERVICE_ACCOUNT` — the service-account JSON
- variable `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — the Firebase project id

Without them the deploy step skips, so it never reddens unrelated pull requests.

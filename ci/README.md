# CI

`../.github/workflows/ci.yml` runs typecheck → lint → test → build on every push
and pull request, and deploys `firestore.rules` + `firestore.indexes.json` to the
Firebase project on merges to `main`.

Rules are the app's only real trust boundary — the browser performs every read
and write — so they must not be something someone remembers to paste into the
Firebase console. This directory previously held a copy of the workflow because
the pushing account lacked the `workflows` permission; that is no longer the
case, and the file now lives where GitHub Actions actually reads it.

To finish wiring the deploy step, add to the repository:

- secret `FIREBASE_SERVICE_ACCOUNT` — the service-account JSON
- variable `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — the Firebase project id

Without them the deploy step skips (it never reddens unrelated pull requests).

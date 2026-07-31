#!/usr/bin/env bash
# Installs the EAS Build GitHub Actions workflow and the EXPO_TOKEN secret.
#
# Run this from your own machine (not from the Arena sandbox): Arena's GitHub
# App token is not allowed to write .github/workflows/** or repository secrets.
#
#   EXPO_TOKEN=xxxxx bash scripts/setup-eas-ci.sh
#
# Requires: git, gh (logged in as a user with admin rights on the repo).

set -euo pipefail

BRANCH="arena/019fb60a-flousy-app"
SRC="ci/eas-build.yml"
DEST=".github/workflows/eas-build.yml"

cd "$(git rev-parse --show-toplevel)"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "$BRANCH" ]; then
  echo "==> Switching to $BRANCH"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

# 1. EXPO_TOKEN repository secret ------------------------------------------------
if [ -n "${EXPO_TOKEN:-}" ]; then
  echo "==> Setting EXPO_TOKEN repository secret"
  gh secret set EXPO_TOKEN --body "$EXPO_TOKEN"
else
  echo "!! EXPO_TOKEN env var not set — skipping secret creation."
  echo "   Set it later with: gh secret set EXPO_TOKEN --body '<your expo token>'"
fi

# 2. Install the workflow --------------------------------------------------------
echo "==> Installing $DEST"
mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"

if git diff --quiet -- "$DEST"; then
  echo "    workflow already up to date"
else
  git add "$DEST"
  git commit -m "ci: EAS Android build workflow (dispatch + push on session branch)"
fi

echo "==> Pushing $BRANCH"
git push origin "$BRANCH"

echo
echo "Done. Watch the run with:  gh run watch"
echo "Builds appear at: https://expo.dev/accounts/mouadlouhichi/projects/smartjib/builds"

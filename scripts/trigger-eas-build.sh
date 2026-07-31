#!/usr/bin/env bash
# Kick off a new EAS build from GitHub Actions.
#
#   bash scripts/trigger-eas-build.sh
#
# The "EAS Build" workflow runs on pushes to the session branch that touch
# apps/mobile/**, so this writes a timestamp to apps/mobile/.build-trigger and
# pushes it. (workflow_dispatch cannot be used until eas-build.yml lives on the
# repository's default branch — a GitHub limitation, not a config problem.)

set -euo pipefail

BRANCH="arena/019fb60a-flousy-app"

cd "$(git rev-parse --show-toplevel)"

if [ ! -f .github/workflows/eas-build.yml ]; then
  echo "!! .github/workflows/eas-build.yml is missing — run scripts/setup-eas-ci.sh first."
  exit 1
fi

date -u +"%Y-%m-%dT%H:%M:%SZ" > apps/mobile/.build-trigger
git add apps/mobile/.build-trigger
git commit -m "chore: trigger EAS build ($(cat apps/mobile/.build-trigger))"
git push origin "$BRANCH"

echo
echo "Queued. Follow the GitHub job:"
echo "  gh run watch"
echo "Then the build itself:"
echo "  https://expo.dev/accounts/mouadlouhichi/projects/smartjib/builds"

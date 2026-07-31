#!/usr/bin/env bash
# Kick off a new EAS build from GitHub Actions.
#
#   bash scripts/trigger-eas-build.sh
#
# The "EAS Build" workflow runs on every push, so this just pushes an empty
# commit. (workflow_dispatch cannot be used until eas-build.yml lives on the
# repository's default branch — a GitHub limitation, not a config problem.)

set -euo pipefail

BRANCH="arena/019fb60a-flousy-app"

cd "$(git rev-parse --show-toplevel)"

if [ ! -f .github/workflows/eas-build.yml ]; then
  echo "!! .github/workflows/eas-build.yml is missing — run scripts/setup-eas-ci.sh first."
  exit 1
fi

git commit --allow-empty -m "chore: trigger EAS build ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
git push origin "$BRANCH"

echo
echo "Queued. Follow the GitHub job:"
echo "  gh run watch"
echo "Then the build itself:"
echo "  https://expo.dev/accounts/mouadlouhichi/projects/smartjib/builds"

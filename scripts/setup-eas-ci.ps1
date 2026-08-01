# Installs the EAS Build GitHub Actions workflow (PowerShell / Windows).
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-eas-ci.ps1
#
# The EXPO_TOKEN repository secret must exist too. If the GitHub CLI (gh) is
# installed this script sets it for you; otherwise it prints the URL to add it
# by hand.

$ErrorActionPreference = "Stop"

$Branch    = "arena/019fb60a-flousy-app"
$Src       = "ci/eas-build.yml"
$Dest      = ".github/workflows/eas-build.yml"
$ExpoToken = "Rm785vOZYvxuYj-960jGA9KU7yikXedA_E44pjtF"
$SecretUrl = "https://github.com/mouadlouhichi/flousy-app/settings/secrets/actions/new"

Set-Location (git rev-parse --show-toplevel)

# --- branch -------------------------------------------------------------------
$current = (git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne $Branch) {
    Write-Host "==> Switching to $Branch"
    git fetch origin $Branch
    git checkout $Branch
}
git pull --ff-only origin $Branch

# --- EXPO_TOKEN secret ---------------------------------------------------------
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "==> Setting EXPO_TOKEN repository secret via gh"
    gh secret set EXPO_TOKEN --body $ExpoToken
} else {
    Write-Host ""
    Write-Host "!! GitHub CLI (gh) not found - add the secret in your browser:" -ForegroundColor Yellow
    Write-Host "     $SecretUrl"
    Write-Host "     Name:   EXPO_TOKEN"
    Write-Host "     Secret: $ExpoToken"
    Write-Host ""
    Read-Host "Press Enter once the secret is saved (or Ctrl+C to abort)"
}

# --- install the workflow ------------------------------------------------------
Write-Host "==> Installing $Dest"
New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null
Copy-Item $Src $Dest -Force

git add $Dest
$staged = git diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($staged)) {
    Write-Host "    workflow already up to date - pushing an empty commit to trigger a build"
    git commit --allow-empty -m "chore: trigger EAS build"
} else {
    git commit -m "ci: EAS Android build on every commit"
}

Write-Host "==> Pushing $Branch"
git push origin $Branch

Write-Host ""
Write-Host "Done. GitHub Actions run:  https://github.com/mouadlouhichi/flousy-app/actions"
Write-Host "EAS builds:                https://expo.dev/accounts/mouadlouhichi/projects/smartjib/builds"

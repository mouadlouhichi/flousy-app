#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# SmartJib — Build & Deploy to Google Play Store
# ═══════════════════════════════════════════════════════════════════
# Run this script on your local machine (macOS/Linux with Node.js).
# It handles: EAS init → dev build → test → production build → submit
#
# Prerequisites:
#   - Node.js 18+ and pnpm installed
#   - Android Studio / Android SDK (for local testing)
#   - Expo account (you'll be prompted to login)
#   - Google Play Developer account ($25 fee)
#
# Usage:
#   chmod +x build-and-deploy.sh
#   ./build-and-deploy.sh              # Full flow (interactive)
#   ./build-and-deploy.sh --init-only  # Just initialize EAS project
#   ./build-and-deploy.sh --dev-build  # Build dev APK only
#   ./build-and-deploy.sh --prod-build # Build production AAB only
#   ./build-and-deploy.sh --submit     # Submit to Play Store
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}ℹ ${1}${NC}"; }
ok()    { echo -e "${GREEN}✅ ${1}${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  ${1}${NC}"; }
err()   { echo -e "${RED}❌ ${1}${NC}"; }

# ─── Config ─────────────────────────────────────────────────────────
APP_NAME="SmartJib"
PACKAGE_NAME="com.luigiagentz.smartjib"
FIREBASE_PROJECT="luigi-wallet"
WEB_CLIENT_ID="636070498350-g7pjc8019fm4cggpepdvk2es3532k1b8.apps.googleusercontent.com"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── Parse Args ─────────────────────────────────────────────────────
MODE="full"
if [[ "${1:-}" == "--init-only" ]]; then MODE="init"; fi
if [[ "${1:-}" == "--dev-build" ]]; then MODE="dev"; fi
if [[ "${1:-}" == "--prod-build" ]]; then MODE="prod"; fi
if [[ "${1:-}" == "--submit" ]]; then MODE="submit"; fi

# ─── Step 1: Install Dependencies ──────────────────────────────────
install_deps() {
  info "Installing monorepo dependencies..."
  cd "$SCRIPT_DIR/../.."
  pnpm install
  ok "Dependencies installed"
}

# ─── Step 2: Verify google-services.json ────────────────────────────
verify_firebase() {
  info "Verifying Firebase configuration..."
  
  if [[ ! -f "$SCRIPT_DIR/google-services.json" ]]; then
    err "google-services.json not found at $SCRIPT_DIR/google-services.json"
    err "Download it from Firebase Console → Project Settings → Your App → google-services.json"
    exit 1
  fi
  
  # Verify the API key is not a placeholder
  if grep -q "AIzaSyDummyKey" "$SCRIPT_DIR/google-services.json"; then
    err "google-services.json has a DUMMY API key!"
    err "Replace it with the real file from Firebase Console"
    exit 1
  fi
  
  # Verify package name matches
  if ! grep -q "$PACKAGE_NAME" "$SCRIPT_DIR/google-services.json"; then
    err "google-services.json doesn't contain package name '$PACKAGE_NAME'"
    err "Make sure you registered the correct Android app in Firebase Console"
    exit 1
  fi
  
  ok "Firebase configuration verified (project: $FIREBASE_PROJECT)"
}

# ─── Step 3: Initialize EAS ────────────────────────────────────────
eas_init() {
  info "Initializing EAS project..."
  cd "$SCRIPT_DIR"
  
  # Check if already logged in
  if ! npx eas-cli whoami &>/dev/null; then
    warn "Not logged in to Expo. Logging in..."
    npx eas-cli login
  fi
  
  # Check if project ID already exists
  CURRENT_ID=$(node -e "
    const cfg = require('./app.config.ts');
    // Can't easily eval the TS config, so check the file directly
    const fs = require('fs');
    const content = fs.readFileSync('./app.config.ts', 'utf8');
    const match = content.match(/projectId:\s*['\"]([^'\"]+)['\"]/);
    console.log(match ? match[1] : '');
  " 2>/dev/null || echo "")
  
  if [[ "$CURRENT_ID" == "your-eas-project-id-here" || -z "$CURRENT_ID" ]]; then
    info "Running eas init to create project..."
    npx eas-cli init --id
    ok "EAS project initialized"
  else
    ok "EAS project already initialized (ID: $CURRENT_ID)"
  fi
  
  # Verify eas.json
  npx eas-cli build:configure
  ok "EAS build configuration verified"
}

# ─── Step 4: Generate Release Keystore ──────────────────────────────
generate_keystore() {
  info "Checking for release keystore..."
  
  KEYSTORE_PATH="$SCRIPT_DIR/smartjib-upload.keystore"
  
  if [[ -f "$KEYSTORE_PATH" ]]; then
    ok "Release keystore already exists at $KEYSTORE_PATH"
    return
  fi
  
  # Check for keytool
  if ! command -v keytool &>/dev/null; then
    err "keytool not found. Install Java JDK first:"
    err "  macOS: brew install openjdk@17"
    err "  Ubuntu: sudo apt install openjdk-17-jdk-headless"
    exit 1
  fi
  
  warn "Generating release keystore for Play Store signing..."
  warn "Store the keystore password SECURELY — you'll need it for every update!"
  echo ""
  
  keytool -genkey -v \
    -keystore "$KEYSTORE_PATH" \
    -alias smartjib \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000
  
  ok "Keystore generated at $KEYSTORE_PATH"
  warn "⚠️  BACK UP THIS KEYSTORE — losing it means you can't update your app on Play Store!"
}

# ─── Step 5: Build Development APK ─────────────────────────────────
build_dev() {
  info "Building development APK (for testing)..."
  cd "$SCRIPT_DIR"
  
  npx eas-cli build --profile development --platform android --wait
  
  ok "Development build complete!"
  info "Install the APK on your test device and verify:"
  info "  - App launches correctly"
  info "  - Google Sign-In works"
  info "  - Firebase Auth (email/password) works"
  info "  - Firestore reads/writes work"
  info "  - All 7 tabs are functional"
  info "  - Biometric lock works"
  info "  - Notifications work"
}

# ─── Step 6: Build Production AAB ──────────────────────────────────
build_prod() {
  info "Building production AAB (for Play Store)..."
  cd "$SCRIPT_DIR"
  
  npx eas-cli build --profile production --platform android --wait
  
  ok "Production build complete!"
  info "Download the AAB from the EAS dashboard"
}

# ─── Step 7: Submit to Google Play ──────────────────────────────────
submit_play() {
  info "Submitting to Google Play Store..."
  cd "$SCRIPT_DIR"
  
  # Check for service account key
  if [[ ! -f "$SCRIPT_DIR/pc-api-key.json" ]]; then
    warn "Google Play service account key not found at $SCRIPT_DIR/pc-api-key.json"
    info "Create one in Google Play Console → Setup → API access"
    info "Or submit manually via the Play Console web UI"
    echo ""
    read -p "Do you want to submit manually instead? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      info "Download the AAB from EAS dashboard and upload it at:"
      info "  https://play.google.com/console → Production → Create new release"
      return
    fi
  fi
  
  npx eas-cli submit --profile production --platform android
  ok "Submitted to Google Play Store!"
}

# ─── Step 8: Run prebuild locally (optional) ────────────────────────
local_prebuild() {
  info "Generating native Android project..."
  cd "$SCRIPT_DIR"
  
  npx expo prebuild --platform android
  
  ok "Native project generated at $SCRIPT_DIR/android/"
  info "Run on emulator: cd $SCRIPT_DIR && npx expo run:android"
}

# ═══════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          SmartJib — Android Build & Deploy                  ║"
echo "║          Package: $PACKAGE_NAME           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

case "$MODE" in
  init)
    install_deps
    verify_firebase
    eas_init
    ;;
  dev)
    install_deps
    verify_firebase
    build_dev
    ;;
  prod)
    install_deps
    verify_firebase
    generate_keystore
    build_prod
    ;;
  submit)
    submit_play
    ;;
  full)
    install_deps
    verify_firebase
    eas_init
    generate_keystore
    build_dev
    echo ""
    warn "═══════════════════════════════════════════════════════════"
    warn "  TEST THE DEVELOPMENT APK BEFORE PROCEEDING!"
    warn "  Install it on a real device and verify all features."
    warn "═══════════════════════════════════════════════════════════"
    echo ""
    read -p "Have you tested the dev build and want to proceed with production? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      build_prod
      submit_play
    else
      info "Run './build-and-deploy.sh --prod-build' when ready"
    fi
    ;;
esac

echo ""
ok "Done! 🎉"

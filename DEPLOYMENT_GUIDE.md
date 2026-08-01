# 🚀 SmartJib — Complete Deployment Guide

> **Status as of 2026-07-30:**
> - ✅ Web app deployed on Vercel (preview passing)
> - ✅ Real Firebase credentials in place (luigi-wallet project)
> - ✅ Code pushed to GitHub (branch `arena/019fab5a-flousy-app`)
> - 🔲 EAS project needs initialization
> - 🔲 Android build needs to be triggered
> - 🔲 Play Store submission

---

## ⚡ Quick Start (5 minutes)

If you have Node.js + pnpm on your machine, run:

```bash
git clone https://github.com/mouadlouhichi/flousy-app.git
cd flousy-app
git checkout arena/019fab5a-flousy-app
pnpm install

# Build the Android app
cd apps/mobile
chmod +x build-and-deploy.sh
./build-and-deploy.sh --dev-build
```

This will:
1. Install all dependencies
2. Verify your Firebase config
3. Log you into Expo (if not already)
4. Build a development APK on EAS cloud

---

## 📋 Step-by-Step: Android Build & Play Store

### Step 1: Add EXPO_TOKEN to GitHub Secrets

1. Go to https://expo.dev/settings/access-tokens
2. Create a new token (name it "GitHub Actions")
3. Copy the token
4. Go to https://github.com/mouadlouhichi/flousy-app/settings/secrets/actions
5. Click "New repository secret"
6. Name: `EXPO_TOKEN`, Value: paste your token
7. Click "Add secret"

### Step 2: Install GitHub Actions Workflows

The workflow files are in `docs/workflows/` (the bot couldn't push to `.github/workflows/`). Move them:

```bash
mkdir -p .github/workflows
cp docs/workflows/eas-build.yml .github/workflows/
cp docs/workflows/ci.yml .github/workflows/
git add .github/workflows/
git commit -m "ci: add GitHub Actions workflows"
git push
```

### Step 3: Initialize EAS Project

```bash
cd apps/mobile
npx eas-cli login          # Login to your Expo account
npx eas-cli init           # Creates the EAS project ID
```

This will update `app.config.ts` with the real project ID. Commit and push.

### Step 4: Build Development APK

**Option A: Via GitHub Actions** (recommended)
1. Go to https://github.com/mouadlouhichi/flousy-app/actions/workflows/eas-build.yml
2. Click "Run workflow"
3. Select profile: `development`, platform: `android`
4. Click "Run workflow"
5. Wait for the build to complete (~15 min)
6. Download the APK from the EAS dashboard

**Option B: Via local CLI**
```bash
cd apps/mobile
npx eas-cli build --profile development --platform android
```

### Step 5: Test on Device

1. Install the APK on your Android phone
2. Test these features:
   - [ ] App launches
   - [ ] Google Sign-In works
   - [ ] Email/password login works
   - [ ] All 7 tabs are functional
   - [ ] Biometric lock works
   - [ ] Notifications work
   - [ ] Offline mode works

### Step 6: Generate Release Keystore

```bash
cd apps/mobile
keytool -genkey -v \
  -keystore smartjib-upload.keystore \
  -alias smartjib \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

⚠️ **BACK UP THIS KEYSTORE!** If you lose it, you can NEVER update your app on Play Store.

### Step 7: Build Production AAB

**Via GitHub Actions:**
1. Go to Actions → EAS Build
2. Select profile: `production`, platform: `android`
3. Run workflow

**Via local CLI:**
```bash
cd apps/mobile
npx eas-cli build --profile production --platform android
```

### Step 8: Submit to Google Play Store

**Prerequisites:**
- Google Play Developer account ($25 one-time fee): https://play.google.com/console
- Complete the store listing (see `PLAY_STORE_TODO.md` Phase 5)

**Via GitHub Actions:**
1. Go to Actions → EAS Build
2. Select profile: `production`, platform: `android`
3. Run workflow (auto-submits after build)

**Via local CLI:**
```bash
cd apps/mobile
npx eas-cli submit --profile production --platform android
```

**Or manually:**
1. Download the AAB from the EAS dashboard
2. Go to Google Play Console → Production → Create new release
3. Upload the AAB

---

## 🌐 Web App (Vercel) — Already Deployed!

The web app is already deploying successfully on Vercel:

- **Preview URL**: https://flousy-47ypskaoi-mouadlouhichis-projects.vercel.app
- **PR**: https://github.com/mouadlouhichi/flousy-app/pull/18
- **Status**: ✅ Vercel checks passing

### To promote to production:
1. Merge the PR into `feat/expo-mobile-monorepo`
2. Vercel will auto-deploy to production

---

## 🔑 Key Configuration

| Setting | Value |
|---|---|
| **Package Name** | `com.luigiagentz.smartjib` |
| **Firebase Project** | `luigi-wallet` |
| **Project Number** | `636070498350` |
| **Web Client ID** | `636070498350-g7pjc8019fm4cggpepdvk2es3532k1b8.apps.googleusercontent.com` |
| **API Key** | `AIzaSyDS4y-zAgXbc2xdAwMQumwNivSpZPkAD40` |
| **App ID** | `1:636070498350:android:081dcba372125b99238fbf` |

---

## 📁 Important Files

| File | Purpose |
|---|---|
| `apps/mobile/google-services.json` | Firebase config (real, gitignored) |
| `apps/mobile/.env` | Web Client ID (gitignored) |
| `apps/mobile/app.config.ts` | Dynamic Expo config |
| `apps/mobile/eas.json` | EAS build profiles |
| `apps/mobile/build-and-deploy.sh` | Local build script |
| `docs/workflows/eas-build.yml` | GitHub Actions EAS build |
| `docs/workflows/ci.yml` | GitHub Actions CI |
| `vercel.json` | Vercel monorepo config |
| `PLAY_STORE_TODO.md` | 10-phase Play Store checklist |

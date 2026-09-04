'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  deleteUser,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { setAuthCookie } from './auth-status';
import { UserProfile } from './store';
import { getUserProfile, setUserProfile, deleteUserAccountData, deleteUserBudgetData, type DeletionReport } from './db';
import { resolveProEntitlement } from './pro-features';

/** Firebase refuses destructive calls on an older session; the UI must ask for the password. */
export class RequiresRecentLoginError extends Error {
  code = 'auth/requires-recent-login';
  constructor() {
    super('This action needs a recent sign-in. Confirm your password to continue.');
    this.name = 'RequiresRecentLoginError';
  }
}

/** Some documents could not be erased; the account is deliberately kept alive for a retry. */
export class AccountDeletionIncompleteError extends Error {
  code = 'account-deletion-incomplete';
  constructor(public report: DeletionReport) {
    super(`Could not delete: ${report.failed.join(', ')}`);
    this.name = 'AccountDeletionIncompleteError';
  }
}
import { CONSENT_STORAGE_KEY, trackEvent } from './analytics';
import { clearFinanceOutbox } from './finance-sync';
import { clearDemoResidue, isDemoMode } from './demo-mode';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signInEmail: (e: string, p: string) => Promise<UserProfile | null>;
  signUpEmail: (e: string, p: string, displayName?: string) => Promise<UserProfile | null>;
  signInGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  updateProfileData: (
    data: Partial<UserProfile>,
    householdIdChange?: { add?: string; remove?: string },
  ) => Promise<void>;
  deleteAccount: (password?: string) => Promise<DeletionReport>;
  deleteAllData: () => Promise<DeletionReport>;
  profileUnavailable: boolean;
  retryProfileSync: () => Promise<void>;
  /** Raw ID token for server endpoints that must know who is calling. */
  getIdToken: () => Promise<string | null>;
  dismissVerificationBanner: boolean;
  setDismissVerificationBanner: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Client-side profile cache. Lets the dashboard paint immediately from the
 * last known profile while Firestore re-validates in the background,
 * removing one network round-trip from the critical path of the first
 * authenticated load.
 */
const PROFILE_CACHE_PREFIX = 'flousy_profile_';

/**
 * A tampered or half-written cache entry must not be able to hand the app an
 * object that lies about `plan` (Pro entitlement) or `onboardingComplete`
 * (which screens are skipped). Everything else is re-fetched from Firestore
 * immediately, so only the fields the UI acts on before that fetch are pinned.
 */
function sanitizeCachedProfile(value: unknown): UserProfile | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.currency !== 'string') return null;
  return {
    ...(raw as unknown as UserProfile),
    // localStorage has no integrity protection. A cache may make the shell paint
    // faster, but only the fresh Firestore profile may grant paid entitlement.
    plan: 'free',
    onboardingComplete: raw.onboardingComplete === true,
    theme: raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : 'light',
    activeWorkspace: raw.activeWorkspace === 'household' ? 'household' : 'personal',
  };
}

function readCachedProfile(uid: string): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    return raw ? sanitizeCachedProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(uid: string, profile: UserProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${PROFILE_CACHE_PREFIX}${uid}`, JSON.stringify(profile));
  } catch {
    /* ignore quota errors */
  }
}

/** Wipe every device-local `flousy_*` cache key (budget months, goals, pro
 * flags, onboarding state) plus session storage. Used on sign-out and when
 * deleting account data so the UI never re-hydrates from a stale cache. */
async function clearLocalData() {
  if (typeof window === 'undefined') return;
  await clearFinanceOutbox().catch((error) => console.warn('Error clearing finance outbox:', error));
  try {
    Object.keys(localStorage).forEach((key) => {
      // The analytics-consent answer is a device preference, not user budget
      // data: wiping it on sign-out made the privacy bar re-appear on every
      // subsequent login, which reads as a bug rather than a choice.
      if (key.startsWith('flousy_') && key !== CONSENT_STORAGE_KEY) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
  } catch (e) {
    console.warn('Error clearing storage:', e);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dismissVerificationBanner, setDismissVerificationBanner] = useState<boolean>(false);
  const [profileUnavailable, setProfileUnavailable] = useState<boolean>(false);
  const [entitlementTick, setEntitlementTick] = useState(0);

  // Re-render the provider at the exact entitlement boundary. A 90-day timeout
  // exceeds browsers' maximum timer delay, so long waits are safely chunked.
  useEffect(() => {
    const endsAtMs = resolveProEntitlement(profile).endsAtMs;
    if (!endsAtMs) return;
    const remaining = endsAtMs - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(
      () => setEntitlementTick((value) => value + 1),
      Math.min(remaining + 1_000, 2_147_000_000),
    );
    return () => window.clearTimeout(timer);
  }, [profile, entitlementTick]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Check for redirect result on boot
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          void syncUserProfile(res.user);
        }
      })
      .catch((err) => console.error('Redirect sign in error:', err));

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthCookie(Boolean(u));
      if (u) {
        // A real account is now signed in on this browser: any demo-session
        // residue (demo flag, global onboarding flag, cached demo months) must
        // not masquerade as this account's local state — it used to skip
        // onboarding for brand-new users who tried the demo first.
        if (isDemoMode()) clearDemoResidue();
        const cached = readCachedProfile(u.uid);
        if (cached) setProfile(cached);
        setLoading(false);
        await syncUserProfile(u);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const syncUserProfile = async (
    u: User,
    displayName?: string,
  ): Promise<{ profile: UserProfile | null; isNewUser: boolean }> => {
    let isNewUser = false;
    const read = await getUserProfile(u.uid);
    if (read.status === 'unavailable') {
      // Keep a previously verified cache visible, but never synthesize defaults
      // and never write while the existence of a cloud profile is unknown.
      const cached = readCachedProfile(u.uid);
      if (cached) setProfile(cached);
      setProfileUnavailable(true);
      return { profile: cached, isNewUser: false };
    }

    let result: UserProfile;
    let optionalProfileWriteFailed = false;
    if (read.status === 'missing') {
      isNewUser = true;
      result = {
        plan: 'free',
        currency: 'MAD',
        onboardingComplete: false,
        theme: 'system',
        displayName: displayName || u.displayName || undefined,
        avatarUrl: u.photoURL || undefined,
      };
      try {
        await setUserProfile(u.uid, result);
      } catch (error) {
        console.error('Error creating profile:', error);
        setProfileUnavailable(true);
        return { profile: null, isNewUser: true };
      }
    } else {
      result = read.profile;
      const patch: Partial<UserProfile> = {};
      if (displayName && !result.displayName) patch.displayName = displayName;
      // `undefined` means this older profile has never chosen/saved an avatar.
      if (result.avatarUrl === undefined && u.photoURL) patch.avatarUrl = u.photoURL;
      if (Object.keys(patch).length > 0) {
        try {
          await setUserProfile(u.uid, patch);
          result = { ...result, ...patch };
        } catch (error) {
          // The read succeeded, so retaining the cloud snapshot is safe; only
          // the optional enrichment remains pending.
          console.error('Error updating profile:', error);
          optionalProfileWriteFailed = true;
        }
      }
    }

    setProfileUnavailable(optionalProfileWriteFailed);
    setProfile(result);
    writeCachedProfile(u.uid, result);
    return { profile: result, isNewUser };
  };

  const signInEmail = async (e: string, p: string): Promise<UserProfile | null> => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const res = await signInWithEmailAndPassword(auth, e, p);
    setUser(res.user);
    setLoading(false);
    trackEvent('login', { method: 'email' });
    try {
      const { profile: synced } = await syncUserProfile(res.user);
      return synced;
    } catch (err) {
      console.error('Profile sync after login failed:', err);
      return null;
    }
  };

  const signUpEmail = async (e: string, p: string, displayName?: string): Promise<UserProfile | null> => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const res = await createUserWithEmailAndPassword(auth, e, p);
    setUser(res.user);
    setLoading(false);
    if (displayName && res.user) {
      try {
        await firebaseUpdateProfile(res.user, { displayName });
      } catch {
        // non-blocking
      }
    }
    trackEvent('sign_up', { method: 'email' });
    if (res.user && !res.user.emailVerified) {
      try {
        await firebaseSendEmailVerification(res.user);
      } catch {
        // non-blocking
      }
    }
    try {
      const { profile: synced } = await syncUserProfile(res.user, displayName);
      return synced;
    } catch (err) {
      console.error('Profile sync after signup failed:', err);
      return null;
    }
  };

  const signInGoogle = async (): Promise<boolean> => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      setUser(res.user);
      setLoading(false);
      trackEvent('login', { method: 'google' });
      try {
        const { isNewUser: isNew } = await syncUserProfile(res.user);
        if (isNew) trackEvent('sign_up', { method: 'google' });
        return isNew;
      } catch (err) {
        console.error('Profile sync after Google login failed:', err);
        return false;
      }
    } catch (err: any) {
      // In-app browsers or popup blocked fallback
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        navigator.userAgent.includes('Instagram') ||
        navigator.userAgent.includes('FBAN')
      ) {
        await signInWithRedirect(auth, googleProvider);
        return false;
      } else {
        throw err;
      }
    }
  };

  const signOut = async () => {
    await clearLocalData();
    if (auth) {
      await firebaseSignOut(auth);
    }
    trackEvent('logout');
    setUser(null);
    setProfile(null);
  };

  const sendResetEmail = async (email: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    await firebaseSendPasswordResetEmail(auth, email);
  };

  const sendVerificationEmail = async () => {
    if (auth?.currentUser) {
      await firebaseSendEmailVerification(auth.currentUser);
    }
  };

  const updateProfileData = async (
    data: Partial<UserProfile>,
    householdIdChange?: { add?: string; remove?: string },
  ) => {
    if (user) {
      // `householdIdChange` writes householdIds atomically server-side; the
      // computed array in `data` only mirrors the expected result locally.
      await setUserProfile(user.uid, data, householdIdChange);
      const next = (prev: UserProfile | null) => (prev ? { ...prev, ...data } : null);
      setProfile(next);
      const current = next(profile);
      if (current) writeCachedProfile(user.uid, current);
    }
  };

  /**
   * Prove recent ownership before Firebase allows an erasure, then erase.
   *
   * `deleteUser` fails with `auth/requires-recent-login` for any session older
   * than five minutes — i.e. almost always — and the data wipe used to run
   * first with every Firestore error swallowed, so a partial failure left
   * documents owned by nobody (unrecoverable, and contrary to the "everything
   * is permanently removed" promise in /privacy). Order is now: re-auth, delete
   * data, verify nothing failed, only then delete the account.
   */
  const deleteAccount = async (password?: string): Promise<DeletionReport> => {
    if (!user || !auth) throw new Error('Not signed in');
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== user.uid) throw new Error('Not signed in');
    const uid = currentUser.uid;
    const email = currentUser.email;
    const providers = new Set(currentUser.providerData.map((provider) => provider.providerId));

    // Reauthenticate *before* touching Firestore. Previously the app erased all
    // finance data and only then discovered that Firebase Auth considered the
    // session stale, leaving an empty but still-live account.
    try {
      if (password !== undefined && providers.has('password') && email) {
        await reauthenticateWithCredential(
          currentUser,
          EmailAuthProvider.credential(email, password),
        );
      } else if (providers.has('google.com') && googleProvider) {
        await reauthenticateWithPopup(currentUser, googleProvider);
      } else {
        // Email/password and unsupported providers need an explicit credential
        // from the account panel before deletion can begin.
        throw new RequiresRecentLoginError();
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (error instanceof RequiresRecentLoginError || code === 'auth/requires-recent-login') {
        throw new RequiresRecentLoginError();
      }
      throw error;
    }

    const report = await deleteUserAccountData(uid, {
      email,
      householdIds: profile?.householdIds || [],
    });
    if (report.failed.length > 0) {
      // The profile still exists, so the user can retry — say so instead of
      // half-deleting them.
      throw new AccountDeletionIncompleteError(report);
    }

    try {
      await deleteUser(currentUser);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        throw new RequiresRecentLoginError();
      }
      throw err;
    }

    await clearLocalData();
    setUser(null);
    setProfile(null);
    return report;
  };

  /**
   * Permanently wipe all of the user's budget data (every month, expenses,
   * savings goals) from Firestore and the local cache, while keeping the
   * account and profile preferences. The live Firestore listeners re-hydrate
   * the dashboard with an empty budget right away.
   */
  const deleteAllData = async (): Promise<DeletionReport> => {
    if (!user || !auth) return { removed: [], failed: [] };
    const uid = user.uid;
    const report = await deleteUserBudgetData(uid);
    // Keep the local recovery copy until the cloud has confirmed every delete.
    if (report.failed.length === 0) {
      await clearLocalData();
      trackEvent('delete_all_data');
    } else {
      throw new AccountDeletionIncompleteError(report);
    }
    return report;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isConfigured: isFirebaseConfigured,
        signInEmail,
        signUpEmail,
        signInGoogle,
        signOut,
        sendResetEmail,
        sendVerificationEmail,
        updateProfileData,
        deleteAccount,
        deleteAllData,
        dismissVerificationBanner,
        setDismissVerificationBanner,
        profileUnavailable,
        retryProfileSync: async () => {
          if (auth?.currentUser) await syncUserProfile(auth.currentUser);
        },
        getIdToken: async () => (auth?.currentUser ? auth.currentUser.getIdToken() : null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

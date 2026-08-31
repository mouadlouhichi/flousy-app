'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
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
import { getUserProfile, setUserProfile, deleteUserAccountData, deleteUserBudgetData } from './db';
import { trackEvent } from './analytics';

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
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  deleteAllData: () => Promise<void>;
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

function readCachedProfile(uid: string): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
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
function clearLocalData() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('flousy_')) {
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

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Check for redirect result on boot
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          syncUserProfile(res.user);
        }
      })
      .catch((err) => console.error('Redirect sign in error:', err));

    const loadingTimeout = window.setTimeout(() => setLoading(false), 8000);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      // Keep the public-site CTA cookie in sync without any network call.
      setAuthCookie(Boolean(u));
      if (u) {
        // Paint instantly from the local profile cache, then re-validate
        // against Firestore in the background.
        const cached = readCachedProfile(u.uid);
        if (cached) {
          setProfile(cached);
          setLoading(false);
        }
        await syncUserProfile(u);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      window.clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, []);

  const syncUserProfile = async (
    u: User,
    displayName?: string,
  ): Promise<{ profile: UserProfile | null; isNewUser: boolean }> => {
    let isNewUser = false;
    let result: UserProfile | null = null;
    try {
      let p = await getUserProfile(u.uid);
      if (!p) {
        isNewUser = true;
        p = {
          plan: 'free',
          currency: 'MAD',
          onboardingComplete: false,
          theme: 'system',
          displayName: displayName || u.displayName || undefined,
          // Store the provider image with the rest of the profile the first
          // time we see it. That keeps the avatar stable across reloads even
          // when an identity provider refreshes its photo URL later.
          avatarUrl: u.photoURL || undefined,
        };
        try {
          await setUserProfile(u.uid, p);
        } catch (writeErr) {
          console.error('Error creating profile:', writeErr);
        }
      } else {
        const patch: Partial<UserProfile> = {};
        if (displayName && !p.displayName) patch.displayName = displayName;
        // `undefined` means this older profile has never chosen/saved an
        // avatar. An intentionally blank string is left alone as a user's
        // explicit choice to fall back to their account photo/initials.
        if (p.avatarUrl === undefined && u.photoURL) patch.avatarUrl = u.photoURL;
        if (Object.keys(patch).length > 0) {
          p = { ...p, ...patch };
          try {
            await setUserProfile(u.uid, patch);
          } catch (writeErr) {
            console.error('Error updating profile:', writeErr);
          }
        }
      }
      result = p;
      setProfile(p);
      writeCachedProfile(u.uid, p);
    } catch (err) {
      console.error('Error fetching/creating profile:', err);
      if (!result) {
        result = {
          plan: 'free',
          currency: 'MAD',
          onboardingComplete: true,
          theme: 'system',
          displayName: displayName || u.displayName || undefined,
          avatarUrl: u.photoURL || undefined,
        };
        setProfile(result);
      }
    }
    return { profile: result, isNewUser };
  };

  const signInEmail = async (e: string, p: string): Promise<UserProfile | null> => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const res = await signInWithEmailAndPassword(auth, e, p);
    const { profile: synced } = await syncUserProfile(res.user);
    trackEvent('login', { method: 'email' });
    return synced;
  };

  const signUpEmail = async (e: string, p: string, displayName?: string): Promise<UserProfile | null> => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const res = await createUserWithEmailAndPassword(auth, e, p);
    if (displayName && res.user) {
      try {
        await firebaseUpdateProfile(res.user, { displayName });
      } catch {
        // non-blocking
      }
    }
    const { profile: synced } = await syncUserProfile(res.user, displayName);
    trackEvent('sign_up', { method: 'email' });
    if (res.user && !res.user.emailVerified) {
      try {
        await firebaseSendEmailVerification(res.user);
      } catch {
        // non-blocking
      }
    }
    return synced;
  };

  const signInGoogle = async (): Promise<boolean> => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const { isNewUser: isNew } = await syncUserProfile(res.user);
      trackEvent(isNew ? 'sign_up' : 'login', { method: 'google' });
      return isNew;
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
    clearLocalData();
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

  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (user) {
      await setUserProfile(user.uid, data);
      const next = (prev: UserProfile | null) => (prev ? { ...prev, ...data } : null);
      setProfile(next);
      const current = next(profile);
      if (current) writeCachedProfile(user.uid, current);
    }
  };

  const deleteAccount = async () => {
    if (!user || !auth) return;
    const uid = user.uid;
    await deleteUserAccountData(uid);
    await deleteUser(user);
    setUser(null);
    setProfile(null);
  };

  /**
   * Permanently wipe all of the user's budget data (every month, expenses,
   * savings goals) from Firestore and the local cache, while keeping the
   * account and profile preferences. The live Firestore listeners re-hydrate
   * the dashboard with an empty budget right away.
   */
  const deleteAllData = async () => {
    if (!user || !auth) return;
    const uid = user.uid;
    // Clear the local cache first so the subscriptions never re-hydrate from it.
    clearLocalData();
    await deleteUserBudgetData(uid);
    trackEvent('delete_all_data');
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

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
import { UserProfile } from './store';
import { getUserProfile, setUserProfile, deleteUserAccountData } from './db';
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
  dismissVerificationBanner: boolean;
  setDismissVerificationBanner: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await syncUserProfile(u);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
        };
        await setUserProfile(u.uid, p);
      } else if (displayName && !p.displayName) {
        p.displayName = displayName;
        await setUserProfile(u.uid, { displayName });
      }
      result = p;
      setProfile(p);
    } catch (err) {
      console.error('Error fetching/creating profile:', err);
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
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('flousy_')) {
            localStorage.removeItem(key);
          }
        });
        sessionStorage.clear();
      } catch (e) {
        console.warn('Error clearing storage on logout:', e);
      }
    }
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
      setProfile((prev: UserProfile | null) => (prev ? { ...prev, ...data } : null));
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

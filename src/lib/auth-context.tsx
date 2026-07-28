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
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { UserProfile } from './store';
import { getUserProfile, setUserProfile, deleteUserAccountData } from './db';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signInEmail: (e: string, p: string) => Promise<void>;
  signUpEmail: (e: string, p: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
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

  const syncUserProfile = async (u: User) => {
    try {
      let p = await getUserProfile(u.uid);
      if (!p) {
        p = {
          plan: 'free',
          currency: 'MAD',
          onboardingComplete: false,
          theme: 'system',
        };
        await setUserProfile(u.uid, p);
      }
      setProfile(p);
    } catch (err) {
      console.error('Error fetching/creating profile:', err);
    }
  };

  const signInEmail = async (e: string, p: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const res = await signInWithEmailAndPassword(auth, e, p);
    await syncUserProfile(res.user);
  };

  const signUpEmail = async (e: string, p: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const res = await createUserWithEmailAndPassword(auth, e, p);
    await syncUserProfile(res.user);
    if (res.user && !res.user.emailVerified) {
      try {
        await firebaseSendEmailVerification(res.user);
      } catch {
        // non-blocking
      }
    }
  };

  const signInGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(res.user);
    } catch (err: any) {
      // In-app browsers or popup blocked fallback
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        navigator.userAgent.includes('Instagram') ||
        navigator.userAgent.includes('FBAN')
      ) {
        await signInWithRedirect(auth, googleProvider);
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

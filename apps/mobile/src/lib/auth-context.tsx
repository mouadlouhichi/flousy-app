import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { isDemoMode, setDemoMode as saveDemoMode, clearDemoData } from './storage';

export interface MobileAuthContextType {
  user: FirebaseAuthTypes.User | null;
  authLoading: boolean;
  demoMode: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  enableDemoMode: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const MobileAuthContext = createContext<MobileAuthContextType | null>(null);

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [demoMode, setDemoModeState] = useState<boolean>(() => isDemoMode());

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser && demoMode) {
        setDemoModeState(false);
        saveDemoMode(false);
      }
    });
    return () => unsubscribe();
  }, [demoMode]);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    await auth().signInWithEmailAndPassword(email, pass);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string) => {
    await auth().createUserWithEmailAndPassword(email, pass);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;
    if (!idToken) {
      throw new Error('No ID token returned from Google Sign-In');
    }
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    await auth().signInWithCredential(googleCredential);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await auth().sendPasswordResetEmail(email);
  }, []);

  const sendEmailVerification = useCallback(async () => {
    const currentUser = auth().currentUser;
    if (currentUser && !currentUser.emailVerified) {
      await currentUser.sendEmailVerification();
    }
  }, []);

  const enableDemoMode = useCallback(() => {
    saveDemoMode(true);
    setDemoModeState(true);
  }, []);

  const signOut = useCallback(async () => {
    saveDemoMode(false);
    setDemoModeState(false);
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore if not signed in with Google
    }
    await auth().signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    const currentUser = auth().currentUser;
    if (demoMode) {
      clearDemoData();
      setDemoModeState(false);
      return;
    }
    if (currentUser) {
      await currentUser.delete();
      setUser(null);
    }
  }, [demoMode]);

  return (
    <MobileAuthContext.Provider
      value={{
        user,
        authLoading,
        demoMode,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        sendPasswordReset,
        sendEmailVerification,
        enableDemoMode,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </MobileAuthContext.Provider>
  );
}

export function useMobileAuth(): MobileAuthContextType {
  const context = useContext(MobileAuthContext);
  if (!context) {
    throw new Error('useMobileAuth must be used within a MobileAuthProvider');
  }
  return context;
}

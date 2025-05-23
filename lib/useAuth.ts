// lib/useAuth.ts
import { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  onboardingCompleted: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  interests?: string[];
  expertise?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const signInPromiseRef = useRef<Promise<void> | null>(null);

  const updateUserProfile = async (userId: string) => {
    const userDocRef = doc(db, 'users', userId);
    return onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    });
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        if (signInPromiseRef.current) {
          try {
            await signInPromiseRef.current;
          } catch {
            // signInPromiseRef should have already set an error if one occurred
          }
        }

        // Set up real-time listener for profile updates
        unsubscribeProfile = await updateUserProfile(currentUser.uid);
      } else {
        setUserProfile(null);
        if (errorRef.current === "User profile not found. Please try signing in again." || errorRef.current === "User profile not found. Please try signing in again or complete onboarding.") {
            setError(null);
        }
      }
      setLoading(false);
      setAuthReady(true);
    });

    // Cleanup function
    return () => {
      unsubscribe();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'stanford.edu' });
    setError(null);

    const signInProcess = async () => {
      try {
        const result = await signInWithPopup(auth, provider);

        if (result.user && result.user.email && result.user.email.endsWith('@stanford.edu')) {
          const userDocRef = doc(db, 'users', result.user.uid);
          const userDocSnap = await getDoc(userDocRef);

          let currentProfile: UserProfile;
          if (!userDocSnap.exists()) {
            const newUserProfileData: UserProfile = {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
              onboardingCompleted: false,
              createdAt: serverTimestamp() as Timestamp,
              lastLoginAt: serverTimestamp() as Timestamp,
            };
            await setDoc(userDocRef, newUserProfileData);
            currentProfile = newUserProfileData;
          } else {
            await setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true });
            currentProfile = { ...userDocSnap.data(), lastLoginAt: serverTimestamp() } as UserProfile;
          }
          setUserProfile(currentProfile);
          setError(null);
        } else {
          await signOut(auth);
          setError('Please sign in with your @stanford.edu email address.');
          setUserProfile(null);
        }
      } catch (err: unknown) {
        console.error("Authentication error in signInProcess:", err);
        let errorMessage = 'An unknown error occurred during sign in.';

        if (err instanceof Error) {
          errorMessage = err.message;
        }

        if (typeof err === 'object' && err !== null && 'code' in err) {
          const errorCode = (err as { code: string }).code;
          if (errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request') {
            errorMessage = '';
          } else if (errorCode === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with the same email address but different sign-in credentials. Try signing in using a provider associated with this email address.';
          } else if (errorCode === 'auth/hd-not-allowed') {
             errorMessage = 'The account you tried to sign in with is not from the stanford.edu domain. Please use your @stanford.edu email.';
          }
        }
        
        if (errorMessage) {
            setError(errorMessage);
        } else {
            setError(null);
        }
        setUserProfile(null);
      }
    };

    signInPromiseRef.current = signInProcess();

    try {
      await signInPromiseRef.current;
    } catch (e) {
      console.warn("Error awaiting signInPromiseRef.current:", e);
      if (errorRef.current === null) {
          setError('An unexpected issue occurred during sign-in preparation.');
      }
    } finally {
      signInPromiseRef.current = null;
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (err: unknown) {
      console.error("Sign out error:", err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to sign out.');
      } else {
        setError('An unknown error occurred during sign out.');
      }
    }
  };

  return { user, userProfile, error, loading, authReady, signInWithGoogle, logOut, updateUserProfile };
} 
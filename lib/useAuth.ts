// lib/useAuth.ts
import { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        if (signInPromiseRef.current) {
          try {
            await signInPromiseRef.current;
          } catch {
            // signInWithGoogle should have already set an error if one occurred.
            // console.warn("signInPromiseRef settlement caused an error, handled by signInWithGoogle:");
          }
        }

        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data() as UserProfile);
          if (errorRef.current === "User profile not found. Please try signing in again.") {
            setError(null);
          }
        } else {
          // If user is authenticated but Firestore doc is missing
          setUserProfile(null);
          setError("User profile not found. Please try signing in again or complete onboarding.");
        }
      } else {
        setUserProfile(null);
        if (errorRef.current === "User profile not found. Please try signing in again." || errorRef.current === "User profile not found. Please try signing in again or complete onboarding.") {
            setError(null);
        }
      }
      setLoading(false);
      setAuthReady(true);
    });
    return () => unsubscribe();
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
        console.error("Authentication error:", err);
        let errorMessage = 'An unknown error occurred during sign in.';
        if (err instanceof Error) {
          errorMessage = err.message || 'Failed to sign in with Google.';
        }
        if (typeof err === 'object' && err !== null && 'code' in err && ((err as {code: unknown}).code === 'auth/popup-closed-by-user' || (err as {code: unknown}).code === 'auth/cancelled-popup-request')) {
            setError(null);
        } else {
            setError(errorMessage);
        }
        setUserProfile(null);
      } finally {
      }
    };

    signInPromiseRef.current = signInProcess();

    try {
      await signInPromiseRef.current;
    } catch {
      // Errors are handled within signInProcess and set to the error state.
      // This catch is to prevent unhandled promise rejection if signInProcess itself throws
      // *outside* of its own try/catch (which it shouldn't, but as a safeguard).
      // console.warn("signInPromiseRef.current threw an error that propagated: ", e)
    }finally {
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

  return { user, userProfile, error, loading, authReady, signInWithGoogle, logOut };
} 